/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

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
