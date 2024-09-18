import type ElevationProvider from './ElevationProvider';

/**
 * Contains information about an elevation sample taken on a map.
 */
interface ElevationSample {
    /**
     * The provider on which the sample was done.
     */
    source: ElevationProvider;
    /**
     * The elevation at the sample location.
     */
    elevation: number;
    /**
     * The resolution of the sample.
     */
    resolution: number;
}

export default ElevationSample;
