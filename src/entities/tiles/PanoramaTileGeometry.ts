/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, BufferAttribute, BufferGeometry, MathUtils, Vector2, Vector3 } from 'three';

import type Extent from '../../core/geographic/Extent';
import type HeightMap from '../../core/HeightMap';
import type MemoryUsage from '../../core/MemoryUsage';
import type { GetMemoryUsageContext } from '../../core/MemoryUsage';
import type TileGeometry from './TileGeometry';

import { getGeometryMemoryUsage } from '../../core/MemoryUsage';
import { getGridBuffers } from './GridBuilder';

const tmpVec2 = new Vector2();
const tmpVec3 = new Vector3();

export function toCartesian(lat: number, lon: number, radius: number, target: Vector3): Vector3 {
    const phi = MathUtils.degToRad(lat);
    const theta = MathUtils.degToRad(lon + 90);

    const cosPhiRadius = Math.cos(phi) * radius;

    target.x = -(cosPhiRadius * Math.cos(theta));
    target.y = cosPhiRadius * Math.sin(theta);
    target.z = Math.sin(phi) * radius;

    return target;
}

export default class PanoramaTileGeometry
    extends BufferGeometry
    implements MemoryUsage, TileGeometry
{
    public readonly isMemoryUsage = true as const;
    private readonly _extent: Extent;
    private readonly _origin: Vector3;
    private readonly _radius: number;

    private _segments = 8;

    public get vertexCount(): number {
        return this.getAttribute('position').count;
    }

    public get segments(): number {
        return this._segments;
    }

    public set segments(v: number) {
        if (this._segments !== v) {
            this._segments = v;
            this.buildBuffers(this);
        }
    }

    public get origin(): Vector3 {
        return this._origin;
    }

    public get raycastGeometry(): this {
        return this;
    }

    public constructor(params: { extent: Extent; segments: number; radius: number }) {
        super();

        this._segments = params.segments;
        this._extent = params.extent;

        this._radius = params.radius;

        this._origin = toCartesian(
            this._extent.maxY,
            this._extent.minX,
            this._radius,
            new Vector3(),
        );

        if (!this._extent.crs.isEquirectangular()) {
            throw new Error(`invalid CRS. Expected 'equirectangular', got: ${this._extent.crs.id}`);
        }

        this.buildBuffers(this);
    }

    public resetHeights(): void {
        // Nothing to do
    }

    public applyHeightMap(_heightMap: HeightMap): { min: number; max: number } {
        // Nothing to do
        return { min: 0, max: 0 };
    }

    public getMemoryUsage(context: GetMemoryUsageContext): void {
        getGeometryMemoryUsage(context, this);
    }

    private buildBuffers(geometry: BufferGeometry): void {
        this.dispose();

        const rowVertices = this._segments + 1;

        const dims = this._extent.dimensions(tmpVec2);
        const width = dims.width;
        const height = dims.height;
        const west = this._extent.minX;
        const north = this._extent.maxY;

        // Positions are relative to the origin of the tile
        const origin = this._origin;

        // A shortcut to get ready to use buffers
        const buffers = getGridBuffers(this.segments, false);

        const boundingBox = new Box3().makeEmpty();

        // Those buffers need to be cloned because they are unique per-tile
        const positionBuffer = buffers.positionBuffer.clone();

        // But these one can be reused as they are never modified
        const uvBuffer = buffers.uvBuffer;
        const indexBuffer = buffers.indexBuffer;

        for (let j = 0; j < rowVertices; j++) {
            for (let i = 0; i < rowVertices; i++) {
                const idx = j * rowVertices + i;

                const u = i / this.segments;
                const v = j / this.segments;

                const lon = west + u * width;
                const lat = north - v * height;

                const cartesian = toCartesian(lat, lon, this._radius, tmpVec3);

                const pos = cartesian.sub(origin);

                boundingBox.expandByPoint(pos);

                positionBuffer.set(idx, pos.x, pos.y, pos.z);
            }
        }

        // Per-tile buffers
        geometry.setAttribute('position', new BufferAttribute(positionBuffer.array, 3));

        // Shared buffers
        geometry.setAttribute('uv', new BufferAttribute(uvBuffer.array, 2));
        geometry.setIndex(new BufferAttribute(indexBuffer, 1));

        this.boundingBox = boundingBox;
        this.computeBoundingBox();
    }
}
