/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { DimensionFilter } from './filter';

export type CommonOptions = {
    /**
     * If true, colors are compressed to 8-bit (instead of 16-bit).
     * @defaultValue true
     */
    compressColorsTo8Bit?: boolean;
    /**
     * Enable web workers to perform CPU intensive tasks.
     * @defaultValue true
     */
    enableWorkers?: boolean;
    /**
     * If specified, will keep every Nth point. For example, a decimation value of 10 will keep
     * one point out of ten, and discard the 9 other points. Useful to reduce memory usage.
     * @defaultValue 1
     */
    decimate?: number;
    /**
     * The filters to use.
     */
    filters?: Readonly<DimensionFilter[]>;
};
