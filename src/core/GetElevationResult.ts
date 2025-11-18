/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type ElevationSample from './ElevationSample';
import type Coordinates from './geographic/Coordinates';

interface GetElevationResult {
    /**
     * The coordinates of the samples.
     */
    coordinates: Coordinates;
    /**
     * The elevation samples.
     */
    samples: ElevationSample[];
}

export default GetElevationResult;
