/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';
import type Extent from '../../core/geographic/Extent';
import PlanarTileGeometry from './PlanarTileGeometry';
import type TileCoordinate from './TileCoordinate';
import type { TileGeometryBuilder } from './TileGeometry';

export function selectBestSubdivisions(extent: Extent, maxAspectRatio: number): Vector2 {
    const dims = extent.dimensions();
    const ratio = dims.x / dims.y;
    let x = 1;
    let y = 1;
    if (ratio > 1) {
        // Our extent is an horizontal rectangle
        x = Math.min(Math.round(ratio), maxAspectRatio);
    } else if (ratio < 1) {
        // Our extent is an vertical rectangle
        y = Math.min(Math.round(1 / ratio), maxAspectRatio);
    }

    return new Vector2(x, y);
}

/**
 * Builds tile in a planar coordinate system.
 */
export default class PlanarTileGeometryBuilder implements TileGeometryBuilder<PlanarTileGeometry> {
    readonly extent: Extent;

    private readonly _rootTileMatrix: Vector2;
    private readonly _skirtDepth: number | undefined;

    private _segments: number;

    constructor(params: {
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

    set segments(v: number) {
        this._segments = v;
    }

    get rootTileMatrix(): Vector2 {
        return this._rootTileMatrix;
    }

    build(params: { tile: TileCoordinate; extent: Extent }): PlanarTileGeometry {
        return new PlanarTileGeometry({
            extent: params.extent,
            segments: this._segments,
            skirtDepth: this._skirtDepth,
        });
    }
}
