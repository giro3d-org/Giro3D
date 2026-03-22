/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { BufferGeometry, Vector2, Vector3 } from 'three';

import type Coordinates from '../../core/geographic/Coordinates';
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

export interface TileChild<T extends TileGeometry> {
    geometry: T;
    tile: TileCoordinate;
    extent: Extent;
}

export abstract class TileGeometryBuilder<T extends TileGeometry = TileGeometry> {
    /**
     * Whether this builder builds tile geometries asynchronously.
     * When `false` (default), `subdivide()` returns synchronously and tile creation is immediate.
     * When `true`, `subdivide()` returns a `Promise` and the parent tile stays visible until all children are ready.
     * @defaultValue false
     */
    public isAsync: boolean = false;

    /**
     * The number of tiles on each axis at zoom level 0.
     */
    public abstract get rootTileMatrix(): Vector2;

    /**
     * Builds the geometry for a single tile.
     * If `isAsync` is `true`, this method may return a `Promise`.
     * In that case, the implementation should cache the result so that subsequent calls for the same tile return synchronously.
     */
    public abstract build(params: { tile: TileCoordinate; extent: Extent }): T | Promise<T>;

    /**
     * Samples elevation from the given tile geometry at the specified coordinates.
     *
     * Override this method to enable geometry-based elevation sampling for custom tile
     * geometries (e.g. pre-built terrain meshes with baked-in heights). When overridden,
     * {@link Map.getElevation} will use this method instead of the elevation layer for
     * tiles built by this builder.
     *
     * @param geometry - The tile geometry to sample from.
     * @param coordinates - The coordinates to sample, pre-projected into the map's CRS.
     * @returns The sampled elevation value, or `null` to fall back to the elevation layer.
     * @defaultValue returns `null` (falls back to elevation layer)
     */
    public getElevation(_geometry: T, _coordinates: Coordinates): number | null {
        return null;
    }

    /**
     * Returns the child tiles and their geometry when subdividing the given tile.
     * The default implementation performs a standard 2×2 quad-tree split.
     * Returns synchronously when `isAsync` is `false`, as a `Promise` otherwise.
     */
    public subdivide(
        { z, x, y }: TileCoordinate,
        extent: Extent,
    ): TileChild<T>[] | Promise<TileChild<T>[]> {
        const extents = extent.split(2, 2);
        const children = [
            { tile: { z: z + 1, x: 2 * x + 0, y: 2 * y + 0 }, extent: extents[0] },
            { tile: { z: z + 1, x: 2 * x + 0, y: 2 * y + 1 }, extent: extents[1] },
            { tile: { z: z + 1, x: 2 * x + 1, y: 2 * y + 0 }, extent: extents[2] },
            { tile: { z: z + 1, x: 2 * x + 1, y: 2 * y + 1 }, extent: extents[3] },
        ];

        if (!this.isAsync) {
            return children.map(child => ({
                geometry: this.build(child) as T,
                tile: child.tile,
                extent: child.extent,
            }));
        }

        return Promise.all(
            children.map(async child => ({
                geometry: await this.build(child),
                tile: child.tile,
                extent: child.extent,
            })),
        );
    }
}
