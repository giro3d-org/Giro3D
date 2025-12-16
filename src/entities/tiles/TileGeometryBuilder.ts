/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Vector2 } from 'three';

import type Extent from '../../core/geographic/Extent';
import type TileCoordinate from './TileCoordinate';
import type TileGeometry from './TileGeometry';

interface TileGeometryBuilder<T extends TileGeometry = TileGeometry> {
    /**
     * The number of tiles on each axis at zoom level 0.
     */
    get rootTileMatrix(): Vector2;

    build(params: { tile: TileCoordinate; extent: Extent }): T;
}

export default TileGeometryBuilder;
