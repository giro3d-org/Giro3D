/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import colormap from 'colormap';
import { Color } from 'three';

/**
 * Create an array of {@link Color}s from the specified colormap preset.
 * @param {string} preset The name of the colormap preset.
 * @param {boolean} [discrete=false] If `true`, the color array will have 10 steps, otherwise 256.
 * @param {boolean} [invert=false] If `true`, the color array will be reversed.
 * @returns {Color[]} The color array.
 */
export function makeColorRamp(preset, discrete = false, invert = false, mirror = false) {
    let nshades = discrete ? 10 : 256;

    const values = colormap({ colormap: preset, nshades });

    const colors = values.map(v => new Color(v));

    if (invert) {
        colors.reverse();
    }

    if (mirror) {
        const mirrored = [...colors, ...colors.reverse()];
        return mirrored;
    }

    return colors;
}
