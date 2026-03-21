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

export abstract class TileGeometryBuilder<T extends TileGeometry = TileGeometry> {
    /**
     * The number of tiles on each axis at zoom level 0.
     */
    public abstract get rootTileMatrix(): Vector2;

    public abstract build(params: { tile: TileCoordinate; extent: Extent }): T | Promise<T>;

    /**
     * Returns the child tiles and their geometry when subdividing the given tile.
     * The default implementation performs a standard 2×2 quad-tree split.
     */
    public subdivide(
        { z, x, y }: TileCoordinate,
        extent: Extent,
    ):
        | {
              geometry: T;
              tile: {
                  z: number;
                  x: number;
                  y: number;
              };
              extent: Extent;
          }[]
        | Promise<
              {
                  geometry: T;
                  tile: {
                      z: number;
                      x: number;
                      y: number;
                  };
                  extent: Extent;
              }[]
          > {
        const extents = extent.split(2, 2);
        const children = [
            { tile: { z: z + 1, x: 2 * x + 0, y: 2 * y + 0 }, extent: extents[0] },
            { tile: { z: z + 1, x: 2 * x + 0, y: 2 * y + 1 }, extent: extents[1] },
            { tile: { z: z + 1, x: 2 * x + 1, y: 2 * y + 0 }, extent: extents[2] },
            { tile: { z: z + 1, x: 2 * x + 1, y: 2 * y + 1 }, extent: extents[3] },
        ];

        const built = children.map(child => ({
            result: this.build(child),
            tile: child.tile,
            extent: child.extent,
        }));

        if (built.every(({ result }) => !(result instanceof Promise))) {
            return built.map(({ result, tile, extent: e }) => ({
                geometry: result as T,
                tile,
                extent: e,
            }));
        }

        return Promise.all(
            built.map(async ({ result, tile, extent: e }) => ({
                geometry: await result,
                tile,
                extent: e,
            })),
        );
    }
}
