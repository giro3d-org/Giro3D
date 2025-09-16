/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';
import type Ellipsoid from '../../core/geographic/Ellipsoid';
import type Extent from '../../core/geographic/Extent';
import EllipsoidTileGeometry from './EllipsoidTileGeometry';
import type TileCoordinate from './TileCoordinate';
import type { TileGeometryBuilder } from './TileGeometry';

export default class EllipsoidTileGeometryBuilder
    implements TileGeometryBuilder<EllipsoidTileGeometry>
{
    constructor(
        private readonly ellipsoid: Ellipsoid,
        private _segments: number,
        private readonly _skirtDepth: number | null,
    ) {}

    get rootTileMatrix(): Vector2 {
        // Equirectangular projection with 2 tiles on the Y axis
        // and 4 on the X axis, so that tiles are perfect squares.
        return new Vector2(4, 2);
    }

    set segments(v: number) {
        this._segments = v;
    }

    build(params: { tile: TileCoordinate; extent: Extent }): EllipsoidTileGeometry {
        return new EllipsoidTileGeometry({
            extent: params.extent,
            ellipsoid: this.ellipsoid,
            segments: this._segments,
            skirtDepth: this._skirtDepth,
        });
    }
}
