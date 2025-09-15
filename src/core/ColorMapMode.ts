/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Modes of the color map gradient.
 */
enum ColorMapMode {
    /**
     * The color map describes an elevation gradient.
     */
    Elevation = 1,

    /**
     * The color map describes a slope gradient.
     */
    Slope = 2,

    /**
     * The color map describes an aspect gradient.
     */
    Aspect = 3,
}

export default ColorMapMode;
