/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type ColorMap from '../../core/ColorMap';
import type { HasDefines, VertexAttributeType } from '../MaterialUtils';
import type { ColorMapUniform } from './ColorMapUniform';

import MaterialUtils from '../MaterialUtils';
import { AttributeSlot } from './AttributeSlot';
import { buildColorMapUniform, createDefaultColorMap } from './ColorMapUniform';

export interface ScalarPropertiesUniform {
    weight: number;
    colorMap: ColorMapUniform;
}

export class ScalarSlot extends AttributeSlot {
    public readonly uniform: ScalarPropertiesUniform;

    private readonly _material: HasDefines;
    private readonly _flagDefine: string;
    private readonly _typeDefine: string;

    public colorMap: ColorMap = createDefaultColorMap();

    public constructor(attributeName: string, material: HasDefines, index: number) {
        super(attributeName);

        this.uniform = {
            weight: 0,
            colorMap: buildColorMapUniform(this.colorMap),
        };
        this._material = material;

        this._flagDefine = `INTENSITY_${index}`;
        this._typeDefine = `INTENSITY_${index}_TYPE`;
        this.intensityType = 'uint';
    }

    public override get hasAttribute(): boolean {
        return typeof this._material.defines[this._flagDefine] !== 'undefined';
    }

    public set hasAttribute(value: boolean) {
        MaterialUtils.setDefine(this._material, this._flagDefine, value);
    }

    public set intensityType(intensityType: VertexAttributeType) {
        MaterialUtils.setDefineValue(this._material, this._typeDefine, intensityType);
    }

    public update(): void {
        this.uniform.colorMap = buildColorMapUniform(this.colorMap);
    }
}
