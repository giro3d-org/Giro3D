/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { NormalBufferAttributes, Vector3 } from 'three';

import Martini from '@mapbox/martini';
import {
    BufferAttribute,
    BufferGeometry,
    Float32BufferAttribute,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
    type Vector2,
} from 'three';

import type Extent from '../../core/geographic/Extent';
import type HeightMap from '../../core/HeightMap';
import type { GetMemoryUsageContext } from '../../core/MemoryUsage';
import type TileCoordinate from './TileCoordinate';
import type TileGeometry from './TileGeometry';
import type TileGeometryBuilder from './TileGeometryBuilder';

import { selectBestSubdivisions } from './PlanarTileGeometryBuilder';

class MartiniTileGeometry extends BufferGeometry implements TileGeometry {
    public readonly isMemoryUsage = true;

    private readonly _origin: Vector3;
    private readonly _extent: Extent;
    private readonly _segments: number;

    public get vertexCount(): number {
        return this.getAttribute('position').count;
    }

    public get segments(): number {
        return this._segments;
    }

    public set segments(v: number) {}

    public get origin(): Vector3 {
        return this._origin;
    }

    public resetHeights(): void {}

    public constructor(params: { extent: Extent; segments: number }) {
        super();
        this._extent = params.extent;
        this._segments = params.segments;
        this._origin = this._extent.center().toVector3();
    }

    public applyHeightMap(heightMap: HeightMap): { min: number; max: number } {
        const martini = new Martini(257);

        const tile = martini.createTile(heightMap.getResizedBuffer(257, 257));

        const dims = this._extent.dimensions();

        const error = dims.width / this.segments;

        const mesh = tile.getMesh(200);

        const vertexCount = mesh.vertices.length / 2;
        const position = new Float32Array(vertexCount * 3);

        const scaleX = (1 / 256) * dims.width;
        const scaleY = (1 / 256) * dims.height;
        const offsetX = dims.width / 2;
        const offsetY = dims.height / 2;

        const uv = new Float32Array(vertexCount * 2);

        for (let i = 0; i < vertexCount; i++) {
            const x = mesh.vertices[i * 2 + 0];
            const y = mesh.vertices[i * 2 + 1];

            const u = x / 256;
            const v = 1 - y / 256;

            position[i * 3 + 0] = offsetX - u * dims.width;
            position[i * 3 + 1] = offsetY - v * dims.height;
            position[i * 3 + 2] = 0;

            uv[i * 2 + 0] = u;
            uv[i * 2 + 1] = v;
        }

        this.setAttribute('position', new Float32BufferAttribute(position, 3));
        this.setAttribute('uv', new Float32BufferAttribute(uv, 2));
        this.setIndex(new Uint32BufferAttribute(mesh.triangles, 1));
        this.computeBoundingBox();
        this.computeBoundingSphere();

        return { min: 0, max: 10 };
    }

    public get raycastGeometry(): BufferGeometry<NormalBufferAttributes> {
        return this;
    }

    public getMemoryUsage(context: GetMemoryUsageContext): void {}
}

export default class MapboxMartiniTileBuilder implements TileGeometryBuilder {
    public readonly extent: Extent;

    private readonly _rootTileMatrix: Vector2;
    private readonly _skirtDepth: number | undefined;

    private _segments: number;

    public constructor(params: {
        extent: Extent;
        maxAspectRatio: number;
        segments: number;
        skirtDepth: number | undefined;
    }) {
        this.extent = params.extent;
        this._rootTileMatrix = selectBestSubdivisions(params.extent, params.maxAspectRatio);
        this._segments = params.segments;
        this._skirtDepth = params.skirtDepth;
    }

    public set segments(v: number) {
        this._segments = v;
    }

    public get rootTileMatrix(): Vector2 {
        return this._rootTileMatrix;
    }

    public build(params: { tile: TileCoordinate; extent: Extent }): MartiniTileGeometry {
        return new MartiniTileGeometry({
            extent: params.extent,
            segments: this._segments,
        });
    }
}
