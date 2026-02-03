/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Texture } from 'three';

import { Color } from 'three';

import ColorMap from '../../core/ColorMap';

export interface ColorMapUniform {
    min: number;
    max: number;
    lut: Texture;
}

export function createDefaultColorMap(): ColorMap {
    const colors = [new Color('black'), new Color('white')];
    return new ColorMap({ colors, min: 0, max: 1000 });
}

export function buildColorMapUniform(colorMap: ColorMap): ColorMapUniform {
    return {
        min: colorMap.min,
        max: colorMap.max,
        lut: colorMap.getTexture(),
    };
}
