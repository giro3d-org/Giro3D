/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Color } from 'three';

/**
 * Colorimetry options.
 */
export interface ColorimetryOptions {
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
    /**
     * The tint to apply.
     */
    tint: Color;
}

const WHITE = new Color(1, 1, 1);

export function defaultColorimetryOptions(): ColorimetryOptions {
    return {
        brightness: 0,
        saturation: 1,
        contrast: 1,
        tint: WHITE.clone(),
    };
}

export default ColorimetryOptions;
