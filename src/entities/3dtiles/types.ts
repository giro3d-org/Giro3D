/**
 * Types re-created from the 3DTiles specs.
 *
 * We could use more advanced tooling to generate TS types from the JSON schemas from
 * the specifications, but for now this is enough.
 */

/**
 * Bounding Volume
 *
 * A bounding volume that encloses a tile or its content.
 * At least one bounding volume property is required.
 * Bounding volumes include `box`, `region`, or `sphere`.
 *
 * @see https://docs.ogc.org/cs/22-025r4/22-025r4.html#reference-schema-boundingvolume
 */
export type $3dTilesBoundingVolume = {
    /**
     * An array of 12 numbers that define an oriented bounding box.
     * The first three elements define the x, y, and z values for the center of the box.
     * The next three elements (with indices 3, 4, and 5) define the x axis direction and
     * half-length. The next three elements (indices 6, 7, and 8) define the y axis direction
     * and half-length. The last three elements (indices 9, 10, and 11) define the z axis
     * direction and half-length.
     */
    box?: number[];
    /**
     * An array of six numbers that define a bounding geographic region in EPSG:4979 coordinates
     * with the order [west, south, east, north, minimum height, maximum height].
     * Longitudes and latitudes are in radians, and heights are in meters above (or below) the
     * WGS84 ellipsoid.
     */
    region?: number[];
    /**
     * An array of four numbers that define a bounding sphere.
     * The first three elements define the x, y, and z values for the center of the sphere.
     * The last element (with index 3) defines the radius in meters.
     */
    sphere?: number[];
};

/**
 * Asset
 *
 * Metadata about the entire tileset.
 *
 * @see https://docs.ogc.org/cs/22-025r4/22-025r4.html#reference-schema-asset
 */
export interface $3dTilesAsset {
    /** The 3D Tiles version */
    version: string;
    gltfUpAxis?: 'X' | 'Y' | 'Z';
}

/**
 * Tile
 *
 * A tile in a 3D Tiles tileset.
 *
 * @see https://docs.ogc.org/cs/22-025r4/22-025r4.html#reference-schema-tile
 */
export interface $3dTilesTile {
    /**
     * The error, in meters, introduced if this tile is rendered and its children are not.
     * At runtime, the geometric error is used to compute screen space error (SSE), i.e.,
     * the error measured in pixels.
     */
    geometricError: number;
    /** The bounding volume that encloses the tile. */
    boundingVolume: $3dTilesBoundingVolume;

    baseURL?: string;
    content?: {
        /**
         * A uri that points to tile content.
         *
         * When the uri is relative, it is relative to the referring tileset JSON file.
         */
        uri?: string;
        /** URL, 3D Tiles pre 1.0 version */
        url?: string;
    };
    /**
     * Optional bounding volume that defines the volume the viewer shall be inside of before the
     * tile's content will be requested and before the tile will be refined based on geometricError.
     */
    viewerRequestVolume?: $3dTilesBoundingVolume;
    /**
     * An array of objects that define child tiles.
     * Each child tile content is fully enclosed by its parent tile's bounding volume and,
     * generally, has a geometricError less than its parent tile's geometricError. For leaf
     * tiles, the length of this array is zero, and children may not be defined.
     */
    children?: $3dTilesTile[];
    /**
     * A floating-point 4x4 affine transformation matrix, stored in column-major order, that
     * transforms the tile's content--i.e., its features as well as content.boundingVolume,
     * boundingVolume, and viewerRequestVolume--from the tile's local coordinate system to the
     * parent tile's coordinate system, or, in the case of a root tile, from the tile's local
     * coordinate system to the tileset's coordinate system. `transform` does not apply to any
     * volume property when the volume is a region, defined in EPSG:4979 coordinates. `transform`
     * scales the `geometricError` by the maximum scaling factor from the matrix.
     */
    transform?: number[];
    /**
     * Specifies if additive or replacement refinement is used when traversing the tileset for
     * rendering.
     * This property is required for the root tile of a tileset; it is optional for all other
     * tiles. The default is to inherit from the parent tile.
     */
    refine?: 'ADD' | 'REPLACE';
}

/**
 * Tileset
 *
 * A 3D Tiles tileset.
 *
 * @see https://docs.ogc.org/cs/22-025r4/22-025r4.html#reference-schema-tileset
 */
export interface $3dTilesTileset {
    /** Metadata about the entire tileset. */
    asset: $3dTilesAsset;
    /**
     * The error, in meters, introduced if this tileset is not rendered.
     * At runtime, the geometric error is used to compute screen space error (SSE), i.e.,
     * the error measured in pixels.
     */
    geometricError: number;
    /** The root tile. */
    root: $3dTilesTile;

    // Not part of the spec
    refine?: 'ADD' | 'REPLACE';
}
