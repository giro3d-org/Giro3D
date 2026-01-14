/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Colorimetry options.
 */
export default interface ColorimetryOptions {
    /**
     * Brightness.
     */
    brightness: number;
    /**
     * Contrast.
     */
    contrast: number;
    /**
     * Saturation.
     */
    saturation: number;
}

export function defaultColorimetryOptions(): ColorimetryOptions {
    return {
        brightness: 0,
        saturation: 1,
        contrast: 1,
    };
}
