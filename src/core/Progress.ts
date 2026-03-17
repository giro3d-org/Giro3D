/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Trait of objects that perform asynchronous operations.
 */
export interface Progress {
    /**
     * Gets whether the object is currently performing an asynchronous operation.
     */
    get loading(): boolean;
    /**
     * Returns the percentage of progress, in normalized value (i.e in the [0, 1] range), of the
     * asynchronous operations that are scheduled to run on this object. 1 means that all operations
     * have finished.
     */
    get progress(): number;
}

export default Progress;
