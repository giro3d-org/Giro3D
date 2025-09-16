/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Raycaster } from 'three';

import type PickResult from './PickResult';

/**
 * Filter on picked result.
 *
 * Can be used to filter-out results, especially useful when using the `limit` option.
 * Callback should return `true` to include the result, or `false` to discard it.
 */
export type PickFilterCallback = <T>(result: PickResult<T>) => boolean;

/**
 * Pick options.
 */
interface PickOptions {
    /**
     * Radius (in pixels) for picking (default 0).
     *
     * Picking will happen in a circle centered on the coordinates provided.
     * Radius is the radius of this circle, in pixels.
     *
     * This is honored by all native Giro3D picking methods, but *may not* be
     * honored by customized picking methods.
     *
     * @defaultValue 0
     */
    radius?: number;
    /**
     * Maximum number of objects to return.
     *
     * @defaultValue Infinity
     */
    limit?: number;
    /** Filter on the picked results */
    filter?: PickFilterCallback;
    /**
     * If disabled, picking will using CPU raycasting when possible (rather than GPU picking).
     * Main differences between CPU raycasting and GPU picking:
     *
     * - CPU raycasting is generally much faster to execute and does not require blocking the
     * thread to wait for the GPU queue to complete.
     *
     * Disadvantages:
     *
     * - CPU raycasting might give less accurate results in some specific cases,
     * - CPU raycasting might not return complete information, only the picked point coordinates.
     * - CPU raycasting does not ignore transparent pixels, whereas GPU picking does. It might be
     * a disadvantage or advantage depending on the use case.
     * @defaultValue false
     */
    gpuPicking?: boolean;
    /**
     * The optional raycaster to use for raycast-based picking.
     * This is mostly useful in the case of point clouds to fine tune the
     * [raycaster parameters](https://threejs.org/docs/index.html?q=raycast#api/en/core/Raycaster.params),
     * depending on the caracteristics of the dataset (i.e size, shape, point density).
     * @defaultValue
     * ```js
     * new Raycaster()
     * ```
     */
    raycaster?: Raycaster;
}

export default PickOptions;
