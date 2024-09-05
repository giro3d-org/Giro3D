export const DEFAULT_ENABLE_TERRAIN = true;
export const DEFAULT_ENABLE_STITCHING = true;
/**
 * The default number of segments in a map's tile.
 */
export const DEFAULT_MAP_SEGMENTS = 32;

/**
 * Options for geometric terrain rendering.
 */
export default interface TerrainOptions {
    /**
     * Enables terrain deformation. If `true`, the surface of the map will be deformed to
     * match the elevation data. If `false` or unset, the surface of the map will be flat.
     * @defaultValue {@link DEFAULT_ENABLE_TERRAIN}
     */
    enabled: boolean;
    /**
     * Requires {@link enabled} to be `true`.
     *
     * Enables terrain stitching. Stitching allows the map to be perfectly watertight at the seams
     * between tiles, even when the neighbouring tile have different sizes.
     *
     * Disabling stitching might improve performance.
     * @defaultValue {@link DEFAULT_ENABLE_STITCHING}
     */
    stitching: boolean;
    /**
     * The resolution of the grid for each tile.
     * The higher the better. It *must* be power of two between `1` included and `256` included.
     * Note: the number of vertices per tile side is `segments` + 1.
     * @defaultValue {@link DEFAULT_MAP_SEGMENTS}
     */
    segments: number;

    /**
     * Draw vertical skirts on the sides of the map tiles.
     */
    skirts: {
        enabled: boolean;
        /**
         * The depth of the skirt, in CRS units.
         */
        depth: number;
    };
}
