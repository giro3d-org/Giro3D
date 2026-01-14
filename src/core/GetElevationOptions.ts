/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type Coordinates from '../core/geographic/Coordinates';

/**
 * Options for sampling elevation on a map.
 */
interface GetElevationOptions {
    /**
     * The coordinates to sample.
     */
    coordinates: Coordinates;
}

export default GetElevationOptions;
