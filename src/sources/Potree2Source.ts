/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, Vector3 } from 'three';

import type {
    GetNodeDataOptions,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudNodeData,
} from './PointCloudSource';
import type Potree2Metadata from './potree/Potree2Metadata';
import type Potree2Node from './potree/Potree2Node';

import OperationCounter from '../core/OperationCounter';
import Fetcher from '../utils/Fetcher';
import { nonNull } from '../utils/tsutils';
import { PointCloudSourceBase } from './PointCloudSource';
import createChildAABB from './potree/createChildAABB';
import { NodeType } from './potree/Potree2Node';

export interface Potree2SourceConstructorOptions {
    /** The URL to the metadata.json file. */
    url: string;
}

export default class Potree2Source extends PointCloudSourceBase {
    public readonly isPotree2Source = true as const;
    public override type = 'Potree2Source' as const;

    private readonly _opCounter = new OperationCounter();

    private _potreeMetadata: Potree2Metadata | null = null;
    private _metadata: PointCloudMetadata | null = null;

    private readonly _url: string;
    private readonly _octreeUrl: URL;
    private readonly _hierarchyUrl: URL;

    public constructor(options: Potree2SourceConstructorOptions) {
        super();
        this._url = options.url;
        this._hierarchyUrl = new URL('hierarchy.bin', new URL(this._url));
        this._octreeUrl = new URL('octree.bin', new URL(this._url));
    }

    private async fetchMetadataFile(): Promise<Potree2Metadata> {
        const metadata = await Fetcher.json<Potree2Metadata>(this._url);
        return metadata;
    }

    private async fetchHierarchyFile(): Promise<ArrayBuffer> {
        // TODO only first chunk is loaded
        const end = nonNull(this._potreeMetadata).hierarchy.firstChunkSize - 1;
        const result = await this.fetchBytes(this._hierarchyUrl, 0, end);

        return result;
    }

    protected override async initializeOnce(): Promise<this> {
        const potreeMetadata = await this.fetchMetadataFile();

        this._potreeMetadata = potreeMetadata;

        const result: PointCloudMetadata = {
            pointCount: potreeMetadata.points,
            volume: new Box3(
                new Vector3().fromArray(potreeMetadata.boundingBox.min),
                new Vector3().fromArray(potreeMetadata.boundingBox.max),
            ),
            // TODO
            // attributes: potreeMetadata.attributes.map(toPointCloudAttribute),
            attributes: [
                {
                    dimension: 1,
                    interpretation: 'unknown',
                    name: 'fake',
                    size: 1,
                    type: 'unsigned',
                    min: 0,
                    max: 255,
                },
            ],
        };

        this._metadata = result;

        return this;
    }

    public override async getHierarchy(): Promise<PointCloudNode> {
        const hierarchyBin = await this.fetchHierarchyFile();
        const view = new DataView(hierarchyBin);

        const BYTES_PER_NODE = 22;

        const nodeCount = view.byteLength / BYTES_PER_NODE;

        const nodes: Potree2Node[] = new Array(nodeCount);

        const potreeMetadata = nonNull(this._potreeMetadata);
        const metadata = nonNull(this._metadata);

        const rootNode: Potree2Node = {
            depth: 0,
            volume: nonNull(metadata.volume),
            center: nonNull(metadata.volume).getCenter(new Vector3()),
            hasData: false,
            id: 'r',
            sourceId: this.id,
            geometricError: potreeMetadata.spacing,

            // Potree-specific metadata
            nodeType: NodeType.Proxy,
            hierarchyByteOffset: 0n,
            hierarchyByteSize: BigInt(hierarchyBin.byteLength), // TODO check
            byteOffset: 0n,
            children: [],
        };

        nodes[0] = rootNode;
        let nodePos = 1;

        for (let i = 0; i < nodeCount; i++) {
            const current = nodes[i];

            // TODO
            if (current == null) {
                continue;
            }

            const type: NodeType = view.getUint8(i * BYTES_PER_NODE + 0);
            const childMask = view.getUint8(i * BYTES_PER_NODE + 1);
            const numPoints = view.getUint32(i * BYTES_PER_NODE + 2, true);
            const byteOffset = view.getBigInt64(i * BYTES_PER_NODE + 6, true);
            const byteSize = view.getBigInt64(i * BYTES_PER_NODE + 14, true);

            if (current.nodeType === NodeType.Proxy) {
                // replace proxy with real node
                current.byteOffset = byteOffset;
                current.byteSize = byteSize;
                current.pointCount = numPoints;
            } else if (type === 2) {
                // load proxy
                current.hierarchyByteOffset = byteOffset;
                current.hierarchyByteSize = byteSize;
                current.pointCount = numPoints;
            } else {
                // load real node
                current.byteOffset = byteOffset;
                current.byteSize = byteSize;
                current.pointCount = numPoints;
            }

            if (current.byteSize === 0n) {
                // workaround for issue #1125
                // some inner nodes erroneously report >0 points even though have 0 points
                // however, they still report a byteSize of 0, so based on that we now set node.numPoints to 0
                current.pointCount = 0;
            }

            current.nodeType = type;

            if (current.nodeType === NodeType.Proxy) {
                continue;
            }

            for (let childIndex = 0; childIndex < 8; childIndex++) {
                const childExists = ((1 << childIndex) & childMask) !== 0;

                if (!childExists) {
                    continue;
                }

                const childAABB = createChildAABB(current.volume, childIndex);
                // const child: Potree2Node = new OctreeGeometryNode(childName, octree, childAABB);

                const child: Partial<Potree2Node> = {
                    id: current.id + childIndex,
                    geometricError: current.geometricError / 2,
                    depth: current.depth + 1,
                    children: [],
                    parent: current,
                    volume: childAABB,
                    center: childAABB.getCenter(new Vector3()),
                };

                // @ts-expect-error partial definition, updated above
                current.children[childIndex] = child;
                // @ts-expect-error partial definition, updated above
                nodes[nodePos] = child;

                nodePos++;
            }
        }

        return rootNode;
    }

    public override async getMetadata(): Promise<PointCloudMetadata> {
        return nonNull(this._metadata, 'this source is not initialized');
    }

    public override async getNodeData(params: GetNodeDataOptions): Promise<PointCloudNodeData> {
        const metadata = nonNull(this._potreeMetadata);
        const potreeNode = params.node as Potree2Node;

        const { byteOffset, byteSize } = potreeNode;
        const first = byteOffset;
        const last = byteOffset + nonNull(byteSize) - 1n;

        const buf = await this.fetchBytes(this._octreeUrl, first, last);

        switch (metadata.encoding) {
            case 'DEFAULT':
            case 'UNCOMPRESSED':
                break;
            case 'BROTLI':
            default:
                throw new Error('unsupported encoding: ' + metadata.encoding);
        }
    }

    private fetchBytes(
        url: string | URL,
        first: number | bigint,
        last: number | bigint,
    ): Promise<ArrayBuffer> {
        return Fetcher.arrayBuffer(url, {
            headers: {
                'content-type': 'multipart/byteranges',
                Range: `bytes=${first}-${last}`,
            },
        });
    }

    public override get progress(): number {
        return this._opCounter.progress;
    }

    public override get loading(): boolean {
        return this._opCounter.loading;
    }

    public override dispose(): void {
        // Nothing to dispose.
    }

    public override getMemoryUsage(): void {
        // No memory usage.
    }
}
