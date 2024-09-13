import type ElevationSample from './ElevationSample';
import type Coordinates from './geographic/Coordinates';

type GetElevationResult = {
    /**
     * The coordinates of the samples.
     */
    coordinates: Coordinates;
    /**
     * The elevation samples.
     */
    samples: ElevationSample[];
};

export default GetElevationResult;
