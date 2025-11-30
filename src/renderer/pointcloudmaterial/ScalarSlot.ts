/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Texture } from 'three';

import type ColorMap from '../../core/ColorMap';
import type { HasDefines, VertexAttributeType } from '../MaterialUtils';

import MaterialUtils from '../MaterialUtils';
import { AttributeSlot } from './AttributeSlot';

export interface ScalarPropertiesUniform {
    weight: number;
    colorMap: {
        min: number;
        max: number;
        lut: Texture;
    };
}

export class ScalarSlot extends AttributeSlot {
    public readonly uniform: ScalarPropertiesUniform;

    private readonly _material: HasDefines;

    public constructor(material: HasDefines, colorMap: ColorMap) {
        super();

        this.uniform = {
            weight: 0,
            colorMap: {
                min: colorMap.min,
                max: colorMap.max,
                lut: colorMap.getTexture(),
            },
        };
        this._material = material;

        this.intensityType = 'uint';
    }

    public override get hasAttribute(): boolean {
        return typeof this._material.defines['INTENSITY'] !== 'undefined';
    }

    public set hasAttribute(value: boolean) {
        MaterialUtils.setDefine(this._material, 'INTENSITY', value);
    }

    public set intensityType(intensityType: VertexAttributeType) {
        MaterialUtils.setDefineValue(this._material, 'INTENSITY_TYPE', intensityType);
    }

    public set colorMap(colorMap: ColorMap) {
        this.uniform.colorMap.min = colorMap.min;
        this.uniform.colorMap.max = colorMap.max;
        this.uniform.colorMap.lut = colorMap.getTexture();
    }
}
