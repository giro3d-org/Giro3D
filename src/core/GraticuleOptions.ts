import type { ColorRepresentation } from 'three';

/**
 * Options for map graticules.
 */
export default interface GraticuleOptions {
    /**
     * Enables the graticule.
     */
    enabled?: boolean;
    /**
     * The graticule thickness, in CRS units.
     */
    thickness?: number;
    /**
     * The graticule color.
     */
    color?: ColorRepresentation;
    /**
     * The distance between vertical lines, in CRS units.
     */
    xStep?: number;
    /**
     * The distance between horizontal lines, in CRS units.
     */
    yStep?: number;
    /**
     * The X coordinate of the starting point of the graticule, in CRS units.
     */
    xOffset?: number;
    /**
     * The Y coordinate of the starting point of the graticule, in CRS units.
     */
    yOffset?: number;
    /**
     * The graticule opacity.
     */
    opacity?: number;
}
