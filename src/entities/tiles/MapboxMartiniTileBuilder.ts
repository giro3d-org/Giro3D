/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { NormalBufferAttributes, Vector3 } from 'three';

import Martini from '@mapbox/martini';
import { BufferGeometry, type Vector2 } from 'three';

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

    public get vertexCount(): number {
        throw new Error('Method not implemented.');
    }

    public get segments(): number {
        throw new Error('Method not implemented.');
    }

    public set segments(v: number) {
        throw new Error('Method not implemented.');
    }

    public get origin(): Vector3 {
        return this._origin;
    }

    public resetHeights(): void {}

    public constructor(params: { extent: Extent }) {
        super();
        this._extent = params.extent;
        this._origin = this._extent.center().toVector3();
    }

    public applyHeightMap(heightMap: HeightMap): { min: number; max: number } {
        const martini = new Martini(257);

        const buffer = new Float32Array(257 * 257);
        const tile = martini.createTile(buffer);

        const mesh = tile.getMesh(2);

        console.log(mesh);

        return { min: 0, max: 10 };

        // this.setAttribute('position', new BufferAttribute(new Float32Array(mesh.vertices)));
        // this.setIndex(mesh.indices);
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
        });
    }
}
