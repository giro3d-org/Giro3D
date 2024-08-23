import type { ColorRepresentation } from 'three';

/**
 * Option for contour lines.
 */
export default interface ContourLineOptions {
    /**
     * Enables or disables contour lines.
     */
    enabled?: boolean;
    /**
     * The interval between each main line (in meters).
     */
    interval?: number;
    /**
     * The interval between each secondary line (in meters).
     */
    secondaryInterval?: number;
    /**
     * The opacity of the lines.
     */
    opacity?: number;
    /**
     * The thickness of the lines.
     */
    thickness?: number;
    /**
     * The color of the lines.
     */
    color?: ColorRepresentation;
}
