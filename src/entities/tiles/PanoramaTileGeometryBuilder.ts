/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';

import type Extent from '../../core/geographic/Extent';
import type TileCoordinate from './TileCoordinate';
import type { TileGeometryBuilder } from './TileGeometry';

import PanoramaTileGeometry from './PanoramaTileGeometry';

export default class PanoramaTileGeometryBuilder implements TileGeometryBuilder<PanoramaTileGeometry> {
    public constructor(
        private readonly _radius: number,
        private readonly _segments: number,
    ) {}

    public get rootTileMatrix(): Vector2 {
        // Equirectangular projection with 2 tiles on the Y axis
        // and 4 on the X axis, so that tiles are perfect squares.
        return new Vector2(4, 2);
    }

    public build(params: { tile: TileCoordinate; extent: Extent }): PanoramaTileGeometry {
        return new PanoramaTileGeometry({
            extent: params.extent,
            radius: this._radius,
            segments: this._segments,
        });
    }
}
