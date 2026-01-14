/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Dimension, Getter, Hierarchy, View } from 'copc';

import { Copc, Las } from 'copc';
import { Box3, BufferAttribute, Vector3 } from 'three';

import type { CommonOptions } from './las/CommonOptions';
import type { DimensionName } from './las/dimension';
import type { ReadViewResult } from './las/worker';
import type {
    GetNodeDataOptions,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudNodeData,
} from './PointCloudSource';

import { GlobalCache } from '../core/Cache';
import CoordinateSystem from '../core/geographic/CoordinateSystem';
import * as Octree from '../core/Octree';
import OperationCounter from '../core/OperationCounter';
import RequestQueue from '../core/RequestQueue';
import Fetcher from '../utils/Fetcher';
import { nonNull } from '../utils/tsutils';
import { getLazPerf } from './las/config';
import { extractAttributes, getDimensionsToRead } from './las/dimension';
import { type DimensionFilter } from './las/filter';
import LASWorkerPool from './las/LASWorkerPool';
import { createBufferAttribute } from './las/readers';
import { readView, type Metadata } from './las/worker';
import { PointCloudSourceBase } from './PointCloudSource';

const deduplicatedQueue = new RequestQueue();

/**
 * Inject Fetcher into copc.js to perform range requests.
 */
const createGetter: (url: string) => Getter = url => {
    return async (begin, end) => {
        const blob = await Fetcher.blob(url, {
            headers: {
                Range: `bytes=${begin}-${end - 1}`,
            },
        });

        const arrayBuffer = await blob.arrayBuffer();

        return new Uint8Array(arrayBuffer);
    };
};

interface PerfOptions {
    decimate: number;
    enableWorkers: boolean;
    compressColorsToUint8: boolean;
}

async function decodeLazChunkSync(chunk: Uint8Array, metadata: Metadata): Promise<Uint8Array> {
    const lp = await getLazPerf();
    return Las.PointData.decompressChunk(chunk, metadata, lp);
}

async function decodeLazChunkUsingWorker(
    chunk: Uint8Array,
    metadata: Metadata,
): Promise<Uint8Array> {
    const pool = await LASWorkerPool.get();

    return pool
        .queue('DecodeLazChunk', { buffer: chunk.buffer, metadata }, [chunk.buffer])
        .then(res => new Uint8Array(res));
}

export interface COPCSourceOptions extends CommonOptions {
    /**
     * The URL to the remote COPC LAS file, or a copc.js `Getter` function to directly access the file byte range.
     */
    url: string | Getter;
}

/**
 * Data acquired from the remote file during initialization.
 */
interface RemoteData {
    copc: Copc;
    /**
     * The actual volume of the LAS file. This is different from the volume of the octree.
     */
    volume: Box3;
    nodes: Map<string, Hierarchy.Node>;
    dimensions: Dimension.Map;
}

interface NodeInternalData extends PointCloudNode {
    x: number;
    y: number;
    z: number;
    depth: number;
}

const tmpCenter = new Vector3();
const tmpSize = new Vector3();

function createChild(
    sourceId: string,
    nodes: Map<string, Hierarchy.Node>,
    node: Octree.Octree<NodeInternalData>,
    geometricError: number,
    qx: 0 | 1,
    qy: 0 | 1,
    qz: 0 | 1,
): Octree.Octree<NodeInternalData> | undefined {
    const depth = node.depth + 1;
    const x = node.x * 2 + qx;
    const y = node.y * 2 + qy;
    const z = node.z * 2 + qz;

    const id = `${depth}-${x}-${y}-${z}`;

    const childNode = nodes.get(id);
    if (!childNode) {
        return undefined;
    }

    const parentCenter = node.volume.getCenter(tmpCenter);
    const halfSize = node.volume.getSize(tmpSize).divideScalar(2);

    const sign = (v: number): number => (v === 0 ? -1 : 0);

    const minx = parentCenter.x + halfSize.x * sign(qx);
    const miny = parentCenter.y + halfSize.y * sign(qy);
    const minz = parentCenter.z + halfSize.z * sign(qz);

    const min = new Vector3(minx, miny, minz);
    const max = min.clone().add(halfSize);

    const volume = new Box3(min, max);

    const center = volume.getCenter(new Vector3());

    const child = Octree.create<NodeInternalData>(
        {
            depth,
            x,
            y,
            z,
            id,
            center,
            pointCount: childNode.pointCount,
            geometricError,
            hasData: childNode.pointCount > 0,
            sourceId,
            volume,
        },
        volume,
        node,
    );

    return child;
}

async function loadSubtree(
    getter: Getter,
    root: Hierarchy.Page,
    nodeMap: Map<string, Hierarchy.Node | undefined>,
): Promise<void> {
    const { nodes, pages } = await Copc.loadHierarchyPage(getter, root);

    for (const [id, node] of Object.entries(nodes)) {
        nodeMap.set(id, node);
    }

    for (const page of Object.values(pages)) {
        if (page) {
            await loadSubtree(getter, page, nodeMap);
        }
    }
}

/**
 * A source that reads from a remote [Cloud Optimized Point Cloud (COPC)](https://copc.io/) LAS file.
 *
 * LAZ decompression is done in background threads using workers. If you wish to disable workers
 * (for a noticeable cost in performance), you can set {@link COPCSourceOptions.enableWorkers} to
 * `false` in constructor options.
 *
 * Note: this source uses the **laz-perf** package to perform decoding of point cloud data. This
 * package uses WebAssembly. If you wish to override the path to the required .wasm file, use
 * {@link sources.las.config.setLazPerfPath | setLazPerfPath()} before using this source.
 * The default path is {@link sources.las.config.DEFAULT_LAZPERF_PATH | DEFAULT_LAZPERF_PATH}.
 *
 * ### Decimation
 *
 * This source supports decimation. By passing the {@link COPCSourceOptions.decimate} argument to
 * a value other than 1, every Nth point will be kept and other points will be discarded during
 * read operations.
 *
 * ### Dimensions filtering
 *
 * This source supports filtering over dimensions (also known as attributes) to eliminate points
 * during reads. For example, it is possible to remove unwanted classifications such as noise
 * from the output points.
 *
 * Note that dimension filtering is independent from the selected attribute. In other words, it is
 * possible to select the dimension `"Intensity"`, while filtering on dimensions `"Classification"`
 * and `"ReturnNumber"` for example.
 *
 * For example, if we wish to remove all points that have the dimension "High noise" (dimension 18
 * in the ASPRS classification list), as well as removing all points whose intensity is lower than
 * 1000:
 *
 * ```ts
 * const source = new COPCSource(...);
 *
 * source.filters = [
 *  { dimension: 'Classification', operator: 'not', value: 18 },
 *  { dimension: 'Intensity', operator: 'greaterequal', value: 1000 },
 * ];
 * ```
 */
export default class COPCSource extends PointCloudSourceBase {
    /** Readonly flag to indicate that this object is a COPCSource. */
    public readonly isCOPCSource = true as const;
    public readonly type = 'COPCSource';

    private readonly _getter: Getter;
    private readonly _opCounter = new OperationCounter();
    private readonly _nodeMap: Map<string, Octree.Octree<NodeInternalData>> = new Map();
    private readonly _filters: DimensionFilter[] = [];
    private readonly _options: PerfOptions = {
        decimate: 1,
        enableWorkers: true,
        compressColorsToUint8: true,
    };

    // Available after initialization
    private _data?: RemoteData;

    public get loading(): boolean {
        return this._opCounter.loading;
    }

    public get progress(): number {
        return this._opCounter.progress;
    }

    /**
     * Gets or sets the dimension filters.
     * @defaultValue `[]`
     */
    public get filters(): Readonly<DimensionFilter[]> {
        return this._filters;
    }

    public set filters(v: Readonly<DimensionFilter[]> | null | undefined) {
        this._filters.length = 0;
        if (v != null) {
            this._filters.push(...v);
        }
        this.dispatchEvent({ type: 'updated' });
    }

    public constructor(options: COPCSourceOptions) {
        super();

        this._opCounter.addEventListener('changed', () => this.dispatchEvent({ type: 'progress' }));

        this._options.compressColorsToUint8 =
            options.compressColorsTo8Bit ?? this._options.compressColorsToUint8;

        this._options.decimate = options.decimate ?? 1;
        if (this._options.decimate < 1) {
            throw new Error('decimate should be at least 1');
        }

        this._options.enableWorkers = options.enableWorkers ?? true;

        if (options.filters != null && options.filters.length > 0) {
            this._filters.push(...options.filters);
        }

        this._getter = typeof options.url === 'string' ? createGetter(options.url) : options.url;
    }

    protected async initializeOnce(): Promise<this> {
        const counter = this._opCounter;

        // Pre-increment for the upcoming operations
        counter.increment(3);

        const copc = await Copc.create(this._getter).finally(() => counter.decrement());

        const [minx, miny, minz] = copc.header.min;
        const [maxx, maxy, maxz] = copc.header.max;

        const volume = new Box3(new Vector3(minx, miny, minz), new Vector3(maxx, maxy, maxz));

        const nodes = new Map<string, Hierarchy.Node>();

        await loadSubtree(this._getter, copc.info.rootHierarchyPage, nodes).finally(() =>
            counter.decrement(),
        );

        const rootNode = nonNull(nodes.get('0-0-0-0'), 'FATAL: no root node in the LAS file.');

        const rootView = await this.loadPointDataView(this._getter, copc, rootNode).finally(() =>
            counter.decrement(),
        );

        this._data = {
            copc,
            nodes,
            volume,
            dimensions: rootView.dimensions,
        };

        return this;
    }

    public getMetadata(): Promise<PointCloudMetadata> {
        const remoteData = this.ensureInitialized();

        let crs = CoordinateSystem.unknown;
        if (typeof remoteData.copc.wkt !== 'undefined') {
            try {
                crs = CoordinateSystem.fromWkt(remoteData.copc.wkt);
            } catch (error: unknown) {
                console.error(`Failed to parse WKT for COPC "${this.id}": `, error);
            }
        }

        const result: PointCloudMetadata = {
            pointCount: remoteData.copc.header.pointCount,
            attributes: extractAttributes(
                remoteData.dimensions,
                remoteData.volume,
                this._options.compressColorsToUint8,
                remoteData.copc.info.gpsTimeRange,
            ),
            volume: remoteData.volume,
            crs,
        };

        return Promise.resolve(result);
    }

    public getHierarchy(): Promise<PointCloudNode> {
        const { copc, nodes } = this.ensureInitialized();

        const [xmin, ymin, zmin, xmax, ymax, zmax] = copc.info.cube;

        const volume = new Box3(new Vector3(xmin, ymin, zmin), new Vector3(xmax, ymax, zmax));

        const rootNode = nonNull(nodes.get('0-0-0-0'));

        const rootGeometricError = copc.info.spacing;

        const root = Octree.create<NodeInternalData>(
            {
                depth: 0,
                x: 0,
                y: 0,
                z: 0,
                id: '0-0-0-0',
                volume,
                center: volume.getCenter(new Vector3()),
                pointCount: rootNode.pointCount,
                geometricError: rootGeometricError,
                hasData: rootNode.pointCount > 0,
                sourceId: this.id,
            },
            volume,
        );

        const createChildren: (
            node: Octree.Octree<NodeInternalData>,
        ) => Octree.ChildrenList<Octree.Octree<NodeInternalData>> | undefined = node => {
            const geometricError = rootGeometricError / 2 ** (node.depth + 1);
            return [
                // bottom nodes
                createChild(this.id, nodes, node, geometricError, 0, 0, 0),
                createChild(this.id, nodes, node, geometricError, 1, 0, 0),
                createChild(this.id, nodes, node, geometricError, 1, 1, 0),
                createChild(this.id, nodes, node, geometricError, 0, 1, 0),

                // top nodes
                createChild(this.id, nodes, node, geometricError, 0, 0, 1),
                createChild(this.id, nodes, node, geometricError, 1, 0, 1),
                createChild(this.id, nodes, node, geometricError, 1, 1, 1),
                createChild(this.id, nodes, node, geometricError, 0, 1, 1),
            ];
        };

        Octree.populate(root, createChildren);

        Octree.traverse(root, n => {
            this._nodeMap.set(n.id, n);
            return true;
        });

        return Promise.resolve(root);
    }

    public async getNodeData(params: GetNodeDataOptions): Promise<PointCloudNodeData> {
        const { nodes, copc } = this.ensureInitialized();

        const id = params.node.id;
        const priority = -params.node.depth;

        const node = nodes.get(id);

        if (!node) {
            throw new Error('no such node: ' + id);
        }

        const signal = params.signal;

        signal?.throwIfAborted();

        const paramsAttributes = params.attributes ?? [];

        const dimensions = getDimensionsToRead(paramsAttributes, params.position, this._filters);

        const octree = nonNull(this._nodeMap.get(id));

        const stride = this._options.decimate;

        const { x, y, z } = params.node.center;
        const metadata = {
            pointCount: node.pointCount,
            pointDataRecordFormat: copc.header.pointDataRecordFormat,
            pointDataRecordLength: copc.header.pointDataRecordLength,
        };

        let result: ReadViewResult;

        // Note: this source is heavily optimized to avoid loading unnecessary data, such
        // as position buffers when only attribute buffers are requested.
        // This means that some position-related metadata, such as bounding box, are not available
        // when position is not requested.
        // Generally, position data will be requested once, when the point cloud is being created
        // for the first time. Switching the optional attribute should not require the recomputation
        // of the position buffer, as they are completely independent.
        // However, keep in mind that changing the _filters_ must recreate everything, position
        // buffer included, as it can change the total number of points returned by the source.

        // Note 2: since the view buffer is stored in the cache, requesting another attribute for
        // the same node should be very fast, as no HTTP request should be emitted (provided of
        // course that the cache has not been cleared in the mean time).

        if (this._options.enableWorkers) {
            result = await this.loadNodeDataWithWorker(
                node,
                priority,
                signal,
                copc,
                metadata,
                params,
                x,
                y,
                z,
                dimensions,
                stride,
            );
        } else {
            result = await this.loadNodeData(
                copc,
                node,
                dimensions,
                priority,
                signal,
                x,
                y,
                z,
                stride,
                params,
            );
        }

        signal?.throwIfAborted();

        let position: BufferAttribute | undefined = undefined;
        let localBoundingBox: Box3 | undefined = undefined;
        if (result.position) {
            position = new BufferAttribute(new Float32Array(result.position.buffer), 3);

            const [minx, miny, minz, maxx, maxy, maxz] = result.position.localBoundingBox;
            localBoundingBox = new Box3(
                new Vector3(minx, miny, minz),
                new Vector3(maxx, maxy, maxz),
            );
        }

        const bufferAttributes = paramsAttributes.map((paramAttribute, index) => {
            const resultAttribute = result.attributes[index];
            if (resultAttribute != null) {
                return createBufferAttribute(
                    resultAttribute,
                    paramAttribute,
                    this._options.compressColorsToUint8,
                );
            }
        });

        return {
            pointCount: position?.count ?? bufferAttributes[0]?.count,
            origin: octree.center,
            localBoundingBox,
            position,
            attributes: bufferAttributes,
        };
    }

    private async loadNodeData(
        copc: Copc,
        node: Hierarchy.Node,
        dimensions: DimensionName[],
        priority: number,
        signal: AbortSignal | undefined,
        x: number,
        y: number,
        z: number,
        stride: number,
        params: GetNodeDataOptions,
    ): Promise<ReadViewResult> {
        const view = await this._opCounter.wrap(
            this.loadPointDataView(this._getter, copc, node, dimensions, priority, signal),
        );

        signal?.throwIfAborted();

        const result = readView({
            view,
            origin: { x, y, z },
            stride,
            position: params.position,
            attributes: params.attributes ?? [],
            compressColors: this._options.compressColorsToUint8,
            filters: this._filters,
        });

        return result;
    }

    private async loadNodeDataWithWorker(
        node: Hierarchy.Node,
        priority: number,
        signal: AbortSignal | undefined,
        copc: Copc,
        metadata: {
            pointCount: number;
            pointDataRecordFormat: number;
            pointDataRecordLength: number;
        },
        params: GetNodeDataOptions,
        x: number,
        y: number,
        z: number,
        dimensions: DimensionName[],
        stride: number,
    ): Promise<ReadViewResult> {
        const buffer = await this._opCounter.wrap(
            this.loadPointDataViewBuffer(this._getter, node, priority),
        );

        signal?.throwIfAborted();

        // We have to clone the buffer to avoid poisoning the cache with an unuseable detached buffer
        const actualBuffer = buffer.slice(0);

        try {
            this._opCounter.increment();

            const pool = await LASWorkerPool.get();

            return await pool.queue(
                'ReadView',
                {
                    buffer: actualBuffer,
                    header: copc.header,
                    metadata,
                    position: params.position,
                    origin: { x, y, z },
                    include: dimensions,
                    filters: this._filters,
                    eb: copc.eb,
                    stride,
                    attributes: params.attributes ?? [],
                    compressColors: this._options.compressColorsToUint8,
                },
                [actualBuffer],
            );
        } finally {
            this._opCounter.decrement();
        }
    }

    private ensureInitialized(): RemoteData {
        if (!this._data) {
            throw new Error('not initialized');
        }

        return this._data;
    }

    /**
     * Loads a view buffer.
     */
    private async loadPointDataViewBuffer(
        getter: Getter,
        node: Hierarchy.Node,
        priority?: number,
    ): Promise<ArrayBufferLike> {
        const { pointDataOffset, pointDataLength } = node;

        const cacheKey = `${this.id}-${pointDataOffset}-${pointDataLength}`;

        const cached = GlobalCache.get(cacheKey);

        if (cached != null) {
            const buf = cached as Uint8Array;

            return buf.buffer;
        }

        return deduplicatedQueue.enqueue({
            id: cacheKey,
            priority,
            request: async () => {
                const chunk = await getter(pointDataOffset, pointDataOffset + pointDataLength);
                GlobalCache.set(cacheKey, chunk, { size: chunk.byteLength });
                return chunk.buffer;
            },
        });
    }

    /**
     * Loads a view and delegate LAZ decoding into a worker.
     */
    private async loadPointDataView(
        getter: Getter,
        copc: Copc,
        node: Hierarchy.Node,
        include?: string[],
        priority?: number,
        signal?: AbortSignal,
    ): Promise<View> {
        const buffer = await this.loadPointDataViewBuffer(getter, node, priority);

        signal?.throwIfAborted();

        let decoded: Uint8Array;

        if (this._options.enableWorkers) {
            // Note that we have to clone the buffer since we send it to the worker
            // and we want this buffer to be reusable for subsequent requests if necessary
            const chunk = new Uint8Array(buffer.slice(0));
            decoded = await decodeLazChunkUsingWorker(chunk, {
                pointCount: node.pointCount,
                pointDataRecordFormat: copc.header.pointDataRecordFormat,
                pointDataRecordLength: copc.header.pointDataRecordLength,
            });
        } else {
            const chunk = new Uint8Array(buffer);
            decoded = await decodeLazChunkSync(chunk, {
                pointCount: node.pointCount,
                pointDataRecordFormat: copc.header.pointDataRecordFormat,
                pointDataRecordLength: copc.header.pointDataRecordLength,
            });
        }

        signal?.throwIfAborted();

        return Las.View.create(decoded, copc.header, copc.eb, include);
    }

    public getMemoryUsage(): void {
        // No memory usage.
    }

    public dispose(): void {
        // Nothing to dispose.
    }
}

export function isCOPCSource(obj: unknown): obj is COPCSource {
    return (obj as COPCSource).isCOPCSource === true;
}
