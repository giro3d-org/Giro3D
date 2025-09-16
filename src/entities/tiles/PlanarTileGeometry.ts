/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    Box3,
    BufferAttribute,
    BufferGeometry,
    Float32BufferAttribute,
    Sphere,
    Vector2,
    Vector3,
} from 'three';

import type Extent from '../../core/geographic/Extent';
import type HeightMap from '../../core/HeightMap';
import type MemoryUsage from '../../core/MemoryUsage';
import type { SkirtSide } from './GridBuilder';
import type TileGeometry from './TileGeometry';

import { getGeometryMemoryUsage, type GetMemoryUsageContext } from '../../core/MemoryUsage';
import { getGridBuffers, iterateBottomVertices, iterateSkirtVertices } from './GridBuilder';

const tmpVec3 = new Vector3();
const tmpVec2 = new Vector2();

export interface TileGeometryOptions {
    extent: Extent;
    segments: number;
    skirtDepth?: number;
}

/**
 * Geometry for map tiles in a planar coordinate system (where the up axis is the same everywhere).
 */
class PlanarTileGeometry extends BufferGeometry implements MemoryUsage, TileGeometry {
    public readonly isMemoryUsage = true as const;
    private readonly _dimensions: Vector2;
    private _segments: number;
    private _extent: Extent;
    private _heightMap: HeightMap | null = null;
    private _origin: Vector3;
    private _skirtDepth: number | null = null;

    public getMemoryUsage(context: GetMemoryUsageContext): void {
        getGeometryMemoryUsage(context, this);
    }

    public get vertexCount(): number {
        return this.getAttribute('position').count;
    }

    public get origin(): Vector3 {
        return this._origin;
    }

    public get raycastGeometry(): this {
        // No distinction between the raycast geometry and the rendered geometry.
        return this;
    }

    /**
     * @param params - Parameters to construct the grid. Should contain an extent
     *  and a size, either a number of segment or a width and an height in pixels.
     */
    public constructor(params: TileGeometryOptions) {
        super();
        this._extent = params.extent;
        this._origin = this._extent.center().toVector3();
        this._dimensions = params.extent.dimensions();
        this._skirtDepth = params.skirtDepth ?? null;
        this._segments = params.segments;
        this.buildBuffers(this);
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

    public resetHeights(): void {
        const positions = this.getAttribute('position');

        let end = positions.count;
        if (this._skirtDepth != null) {
            end -= 4;
        }

        for (let i = 0; i < end; i++) {
            positions.setZ(i, 0);
        }

        if (this._skirtDepth != null) {
            for (let i = end; i < end + 4; i++) {
                positions.setZ(i, this._skirtDepth);
            }
        }
        positions.needsUpdate = true;
        this.computeBoundingBox();
    }

    public applyHeightMap(heightMap: HeightMap): { min: number; max: number } {
        this._heightMap = heightMap;
        return this.buildBuffers(this);
    }

    private buildBuffers(geometry: BufferGeometry): { min: number; max: number } {
        this.dispose();

        const rowVertices = this._segments + 1;

        const dims = this._dimensions;
        const width = dims.width;
        const height = dims.height;

        // Positions are relative to the origin of the tile
        const origin = this._origin;

        const buffers = getGridBuffers(this._segments, this._skirtDepth != null);

        const heightMap = this._heightMap;

        /**
         * Returns the elevation by sampling the heightmap at the (u, v) coordinate.
         * Note: the sampling does not perform any interpolation.
         */
        function getElevation(u: number, v: number): number {
            if (heightMap == null) {
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

        const position = new Vector3();

        const up = new Vector3(0, 0, 1);
        const north = new Vector3(0, 1, 0);
        const east = new Vector3(1, 0, 0);
        const south = new Vector3(0, -1, 0);
        const west = new Vector3(-1, 0, 0);
        const down = new Vector3(0, 0, -1);

        for (let j = 0; j < rowVertices; j++) {
            for (let i = 0; i < rowVertices; i++) {
                const idx = j * rowVertices + i;

                const u = i / this.segments;
                const v = j / this.segments;

                const altitude = getElevation(u, 1 - v);

                min = Math.min(min, altitude);
                max = Math.max(max, altitude);

                const x = origin.x - width / 2 + u * width;
                const y = origin.y + height / 2 - v * height;

                position.set(x, y, altitude);
                const pos = position.sub(origin);

                boundingBox.expandByPoint(pos);

                positionBuffer.set(idx, pos.x, pos.y, altitude);
                normalBuffer.set(idx, up.x, up.y, up.z);
            }
        }

        if (this._skirtDepth != null) {
            const skirtDepth = this._skirtDepth;
            const skirtStart = rowVertices * rowVertices;

            // Let's set the skirt vertices position to match the XY position of their top
            // edge counterpart, but with the Z coordinate set to the desired depth.
            const setPositionCallback = (
                side: SkirtSide,
                top: number,
                skirtTop: number,
                skirtBottom: number,
            ): void => {
                const x = positionBuffer.getX(top);
                const y = positionBuffer.getY(top);
                const z = positionBuffer.getZ(top);

                positionBuffer.set(skirtTop, x, y, z);
                positionBuffer.set(skirtBottom, x, y, skirtDepth);
            };

            iterateSkirtVertices(this.segments, positionBuffer, setPositionCallback);

            const normals = [north, east, south, west];

            // Let's set the normal of each skirt side to point to its cardinal direction (in local space)
            const setNormalCallback = (
                side: SkirtSide,
                top: number,
                skirtTop: number,
                skirtBottom: number,
            ): void => {
                const normal = normals[side];

                normalBuffer.setVector(skirtTop, normal);
                normalBuffer.setVector(skirtBottom, normal);
            };
            iterateSkirtVertices(this.segments, normalBuffer, setNormalCallback);

            // Finally, set the UV coordinates of the side to match the UV coordinates
            // of the original mesh's corresponding side.

            // We don't want the shader to deform the vertices on the bottom of the skirts,
            // so we use a special UV value to flag them.

            const bottomUv = new Vector2(-999, -999);
            const setUvCallback = (
                side: SkirtSide,
                top: number,
                skirtTop: number,
                skirtBottom: number,
            ): void => {
                const uv = uvBuffer.get(top, tmpVec2);

                uvBuffer.setVector(skirtTop, uv);
                uvBuffer.setVector(skirtBottom, bottomUv);
            };
            iterateSkirtVertices(this.segments, normalBuffer, setUvCallback);

            // Let's set the vertex positions for the bottom side
            const last = positionBuffer.length;
            const min = boundingBox.min;
            const max = boundingBox.max;

            positionBuffer.set(last - 4, min.x, max.y, skirtDepth);
            positionBuffer.set(last - 3, max.x, max.y, skirtDepth);
            positionBuffer.set(last - 2, max.x, min.y, skirtDepth);
            positionBuffer.set(last - 1, min.x, min.y, skirtDepth);

            iterateBottomVertices(uvBuffer, idx => {
                uvBuffer.setVector(idx, bottomUv);
            });
            iterateBottomVertices(normalBuffer, idx => {
                normalBuffer.setVector(idx, down);
            });

            // Let's include the skirt vertices into the bounding box
            boundingBox.expandByPoint(positionBuffer.get(skirtStart + 0, tmpVec3));
            boundingBox.expandByPoint(positionBuffer.get(skirtStart + 1, tmpVec3));
            boundingBox.expandByPoint(positionBuffer.get(skirtStart + 2, tmpVec3));
            boundingBox.expandByPoint(positionBuffer.get(skirtStart + 3, tmpVec3));
        }

        // Per-tile buffers
        geometry.setAttribute('position', new Float32BufferAttribute(positionBuffer.array, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(normalBuffer.array, 3));

        // Shared buffers
        geometry.setAttribute('uv', new Float32BufferAttribute(uvBuffer.array, 2));
        geometry.setIndex(new BufferAttribute(indexBuffer, 1));

        this.boundingBox = boundingBox;
        this.boundingSphere = boundingBox.getBoundingSphere(new Sphere());

        if (this._skirtDepth != null) {
            const topVertexCount = rowVertices * rowVertices;

            // Let's use distinct material groups for the top side
            // and the skirts, so that we can use different materials
            this.addGroup(0, topVertexCount, 0);
            this.addGroup(topVertexCount, 4, 1);
        }

        return { min, max };
    }
}

export default PlanarTileGeometry;
