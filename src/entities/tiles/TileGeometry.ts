/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { BufferGeometry, Vector2, Vector3 } from 'three';

import type Extent from '../../core/geographic/Extent';
import type HeightMap from '../../core/HeightMap';
import type MemoryUsage from '../../core/MemoryUsage';
import type TileCoordinate from './TileCoordinate';

export default interface TileGeometry extends BufferGeometry, MemoryUsage {
    get vertexCount(): number;

    get segments(): number;
    set segments(v: number);

    get origin(): Vector3;

    /**
     * Resets the heights of the vertices to zero.
     */
    resetHeights(): void;

    /**
     * Applies the heightmap on the geometry.
     * @param heightMap - The heightmap to apply.
     * @returns The min and max elevation of vertices after applying the heightmap.
     */
    applyHeightMap(heightMap: HeightMap): { min: number; max: number };

    /**
     * The geometry to use for raycast purposes.
     */
    get raycastGeometry(): BufferGeometry;
}

export interface TileGeometryBuilder<T extends TileGeometry = TileGeometry> {
    /**
     * The number of tiles on each axis at zoom level 0.
     */
    get rootTileMatrix(): Vector2;

    build(params: { tile: TileCoordinate; extent: Extent }): T;
}
