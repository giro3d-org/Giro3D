import type Coordinates from '../core/geographic/Coordinates';

/**
 * Options for sampling elevation on a map.
 */
type GetElevationOptions = {
    /**
     * The coordinates to sample.
     */
    coordinates: Coordinates;
};

export default GetElevationOptions;
