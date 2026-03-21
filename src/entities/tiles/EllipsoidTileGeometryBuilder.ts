/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';

import type Ellipsoid from '../../core/geographic/Ellipsoid';
import type Extent from '../../core/geographic/Extent';
import type TileCoordinate from './TileCoordinate';

import EllipsoidTileGeometry from './EllipsoidTileGeometry';
import { TileGeometryBuilder } from './TileGeometry';

class EllipsoidTileGeometryBuilder extends TileGeometryBuilder<EllipsoidTileGeometry> {
    public constructor(
        private readonly ellipsoid: Ellipsoid,
        private _segments: number,
        private readonly _skirtDepth: number | null,
    ) {
        super();
    }

    public get rootTileMatrix(): Vector2 {
        // Equirectangular projection with 2 tiles on the Y axis
        // and 4 on the X axis, so that tiles are perfect squares.
        return new Vector2(4, 2);
    }

    public set segments(v: number) {
        this._segments = v;
    }

    public build(params: { tile: TileCoordinate; extent: Extent }): EllipsoidTileGeometry {
        return new EllipsoidTileGeometry({
            extent: params.extent,
            ellipsoid: this.ellipsoid,
            segments: this._segments,
            skirtDepth: this._skirtDepth,
        });
    }
}

export default EllipsoidTileGeometryBuilder;
