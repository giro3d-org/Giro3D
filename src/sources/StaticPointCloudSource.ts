/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Box3, BufferAttribute, Float32BufferAttribute, Vector3 } from 'three';

import type { GetMemoryUsageContext } from '../core/MemoryUsage';
import type {
    GetNodeDataOptions,
    PointCloudAttribute,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudNodeData,
    PointCloudSource,
} from './PointCloudSource';

import { PointCloudSourceBase } from './PointCloudSource';

export default class StaticPointCloudSource
    extends PointCloudSourceBase
    implements PointCloudSource
{
    public override type = 'StaticPointCloudSource';
    public readonly isStaticPointCloudSource = true as const;

    private readonly _origin: Vector3;
    private readonly _bounds: Box3;
    private readonly _positions: Float32BufferAttribute;
    private readonly _pointCount: number;
    private readonly _spacing: number;
    private readonly _attributes: { attribute: PointCloudAttribute; data: BufferAttribute }[];
    private readonly _attributeBuffers: Map<PointCloudAttribute['name'], BufferAttribute> =
        new Map();

    public constructor(params: {
        bounds: Box3;
        origin: Vector3;
        positions: Float32BufferAttribute;
        attributes: Array<{ attribute: PointCloudAttribute; data: BufferAttribute }>;
        spacing: number;
    }) {
        super();

        this._bounds = params.bounds;
        this._origin = params.origin;

        this._pointCount = params.positions.count / 3;
        this._positions = params.positions;
        this._spacing = params.spacing;
        this._attributes = params.attributes;

        for (const attrib of this._attributes) {
            this._attributeBuffers.set(attrib.attribute.name, attrib.data);
        }
    }

    protected override initializeOnce(): Promise<this> {
        return Promise.resolve(this);
    }

    public override getHierarchy(): Promise<PointCloudNode> {
        const unique: PointCloudNode = {
            center: this._origin,
            depth: 0,
            id: 'root',
            sourceId: this.id,
            hasData: true,
            volume: this._bounds,
            pointCount: this._pointCount,
            geometricError: this._spacing,
        };

        return Promise.resolve(unique);
    }

    public override getMetadata(): Promise<PointCloudMetadata> {
        const result: PointCloudMetadata = {
            pointCount: this._pointCount,
            volume: this._bounds,
            attributes: this._attributes.map(v => v.attribute),
        };

        return Promise.resolve(result);
    }

    public override getNodeData(params: GetNodeDataOptions): Promise<PointCloudNodeData> {
        // This should never happen but let's check anyway.
        if (params.node.id !== 'root') {
            throw new Error("only one node is supported in this source: 'root'");
        }

        const attributes =
            params.attributes != null
                ? params.attributes.map(att => this._attributeBuffers.get(att.name))
                : [];

        const result: PointCloudNodeData = {
            pointCount: this._pointCount,
            origin: this._origin,
            position: params.position ? this._positions : undefined,
            attributes,
        };

        return Promise.resolve(result);
    }

    public override get progress(): number {
        return 1;
    }

    public override get loading(): boolean {
        return false;
    }

    public override dispose(): void {
        // Nothing to do.
    }

    public override getMemoryUsage(context: GetMemoryUsageContext): void {
        let cpuMemory = this._positions.array.byteLength;
        this._attributes.forEach(v => (cpuMemory += v.data.array.byteLength));

        context.objects.set(this.id, { cpuMemory, gpuMemory: 0 });
    }
}
