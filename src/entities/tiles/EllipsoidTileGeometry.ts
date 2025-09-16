/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, BufferAttribute, BufferGeometry, Vector2, Vector3 } from 'three';

import type Ellipsoid from '../../core/geographic/Ellipsoid';
import type Extent from '../../core/geographic/Extent';
import type HeightMap from '../../core/HeightMap';
import type MemoryUsage from '../../core/MemoryUsage';
import type { GetMemoryUsageContext } from '../../core/MemoryUsage';
import type { VectorArray } from '../../core/VectorArray';
import type TileGeometry from './TileGeometry';

import { getGeometryMemoryUsage } from '../../core/MemoryUsage';
import { getGridBuffers } from './GridBuilder';

const tmpVec2 = new Vector2();
const tmpVec3 = new Vector3();
const tmpNormal = new Vector3();

const tmpNW = new Vector3();
const tmpNE = new Vector3();
const tmpSW = new Vector3();
const tmpSE = new Vector3();

enum Usage {
    Rendering,
    Raycasting,
}

function copySkirtValues(array: VectorArray, segments: number): void {
    const rowSize = segments + 1;
    const length = rowSize * rowSize;
    const end = length;

    const UL = 0;
    const UR = rowSize;
    const LL = end - rowSize;
    const LR = end;

    array.copyItem(UL, end + 0);
    array.copyItem(UR, end + 1);
    array.copyItem(LL, end + 2);
    array.copyItem(LR, end + 3);
}

export default class EllipsoidTileGeometry
    extends BufferGeometry
    implements MemoryUsage, TileGeometry
{
    readonly isMemoryUsage = true as const;
    private readonly _extent: Extent;
    private readonly _origin: Vector3;
    private readonly _ellipsoid: Ellipsoid;
    private readonly _raycastGeometry: BufferGeometry;

    private _segments = 32;
    private _heightMap: HeightMap | null = null;
    private _skirtDepth: number | null = null;

    get vertexCount() {
        return this.getAttribute('position').count;
    }

    get segments(): number {
        return this._segments;
    }

    set segments(v: number) {
        if (this._segments !== v) {
            this._segments = v;
            this.buildBuffers(this, Usage.Rendering);
            this.buildBuffers(this._raycastGeometry, Usage.Raycasting);
        }
    }

    get origin(): Vector3 {
        return this._origin;
    }

    get raycastGeometry() {
        return this._raycastGeometry;
    }

    constructor(params: {
        extent: Extent;
        segments: number;
        ellipsoid: Ellipsoid;
        skirtDepth: number | null;
    }) {
        super();

        this._segments = params.segments;
        this._extent = params.extent;
        this._skirtDepth = params.skirtDepth;

        this._ellipsoid = params.ellipsoid;

        this._origin = this._ellipsoid.toCartesian(this._extent.north, this._extent.west, 0);

        if (!this._extent.crs.isEpsg(4326)) {
            throw new Error(`invalid CRS. Expected EPSG:4326, got: ${this._extent.crs.id}`);
        }

        this._raycastGeometry = new BufferGeometry();

        this.buildBuffers(this, Usage.Rendering);
        this.buildBuffers(this._raycastGeometry, Usage.Raycasting);
    }

    resetHeights(): void {
        this.buildBuffers(this.raycastGeometry, Usage.Raycasting);
    }

    applyHeightMap(heightMap: HeightMap): { min: number; max: number } {
        this._heightMap = heightMap;
        return this.buildBuffers(this.raycastGeometry, Usage.Raycasting);
    }

    getMemoryUsage(context: GetMemoryUsageContext) {
        getGeometryMemoryUsage(context, this);
        getGeometryMemoryUsage(context, this.raycastGeometry);
    }

    private buildBuffers(geometry: BufferGeometry, usage: Usage) {
        this.dispose();

        const rowVertices = this._segments + 1;

        const dims = this._extent.dimensions(tmpVec2);
        const width = dims.width;
        const height = dims.height;
        const west = this._extent.west;
        const north = this._extent.north;
        const south = this._extent.south;
        const east = this._extent.east;

        // Positions are relative to the origin of the tile
        const origin = this._origin;

        // A shortcut to get ready to use buffers
        const buffers = getGridBuffers(this.segments, this._skirtDepth != null);

        const heightMap = this._heightMap;

        /**
         * Returns the elevation by sampling the heightmap at the (u, v) coordinate.
         * Note: the sampling does not perform any interpolation.
         */
        function getElevation(u: number, v: number): number {
            if (!heightMap) {
                return 0;
            }

            return heightMap.getValue(u, v, true) ?? 0;
        }

        let min = +Infinity;
        let max = -Infinity;

        const boundingBox = new Box3().makeEmpty();

        // Those buffers need to be cloned because they are unique per-tile
        const positionBuffer = buffers.positionBuffer.clone();
        const normalBuffer = buffers.normalBuffer.clone();

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

                const altitude = usage === Usage.Raycasting ? getElevation(u, 1 - v) : 0;

                min = Math.min(min, altitude);
                max = Math.max(max, altitude);

                const cartesian = this._ellipsoid.toCartesian(lat, lon, altitude, tmpVec3);
                const normal = this._ellipsoid.getNormalFromCartesian(cartesian, tmpNormal);

                const pos = cartesian.sub(origin);

                // Note that the bounding box ignores the skirts, which are purely
                // graphical and should not count towards the actual volume of the tile.
                boundingBox.expandByPoint(pos);

                positionBuffer.set(idx, pos.x, pos.y, pos.z);
                normalBuffer.set(idx, normal.x, normal.y, normal.z);
            }
        }

        if (this._skirtDepth != null) {
            const skirtDepth = this._skirtDepth;
            const skirtStart = rowVertices * rowVertices;

            const nw = this._ellipsoid.toCartesian(north, west, skirtDepth, tmpNW).sub(origin);
            const ne = this._ellipsoid.toCartesian(north, east, skirtDepth, tmpNE).sub(origin);
            const sw = this._ellipsoid.toCartesian(south, west, skirtDepth, tmpSW).sub(origin);
            const se = this._ellipsoid.toCartesian(south, east, skirtDepth, tmpSE).sub(origin);

            positionBuffer.set(skirtStart + 0, nw.x, nw.y, nw.z);
            positionBuffer.set(skirtStart + 1, ne.x, ne.y, ne.z);
            positionBuffer.set(skirtStart + 2, sw.x, sw.y, sw.z);
            positionBuffer.set(skirtStart + 3, se.x, se.y, se.z);

            // Skirt normals are the same as their non-skirt counterpart
            copySkirtValues(normalBuffer, this.segments);
        }

        // Per-tile buffers
        geometry.setAttribute('position', new BufferAttribute(positionBuffer.array, 3));
        geometry.setAttribute('normal', new BufferAttribute(normalBuffer.array, 3));

        // Shared buffers
        geometry.setAttribute('uv', new BufferAttribute(uvBuffer.array, 2));
        geometry.setIndex(new BufferAttribute(indexBuffer, 1));

        this.boundingBox = boundingBox;

        return { min, max };
    }
}
