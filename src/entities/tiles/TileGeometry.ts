import type { BufferGeometry, Vector3 } from 'three';
import type Extent from '../../core/geographic/Extent';
import type HeightMap from '../../core/HeightMap';
import type MemoryUsage from '../../core/MemoryUsage';

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

export type TileGeometryBuilder<T extends TileGeometry = TileGeometry> = (
    extent: Extent,
    segments: number,
    skirtDepth: number | null,
) => T;
