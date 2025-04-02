/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Plane } from 'three';

/**
 * Interface for objects that support clipping planes.
 */
export default interface HasClippingPlanes {
    get clippingPlanes(): Plane[] | null;
    set clippingPlanes(planes: Plane[] | null);
}
