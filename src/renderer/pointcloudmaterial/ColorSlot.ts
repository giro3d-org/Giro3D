/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { HasDefines } from '../MaterialUtils';

import MaterialUtils from '../MaterialUtils';
import { AttributeSlot } from './AttributeSlot';

export interface ColorPropertiesUniform {
    weight: number;
}

export interface ColorSlotState {
    weight: number;
}

export class ColorSlot extends AttributeSlot {
    public readonly uniform: ColorPropertiesUniform;

    private readonly _material: HasDefines;
    private readonly _flagDefine: string | null;

    public constructor(attributeName: string, material: HasDefines, index: number) {
        super(attributeName);

        this.uniform = {
            weight: 0,
        };

        this._material = material;

        if (index === 0) {
            // first color is always present
            this._flagDefine = null;
        } else {
            this._flagDefine = `COLOR_${index}`;
        }
    }

    public override get hasAttribute(): boolean {
        if (this._flagDefine === null) {
            return true;
        }
        return typeof this._material.defines[this._flagDefine] !== 'undefined';
    }

    public set hasAttribute(value: boolean) {
        if (this._flagDefine === null) {
            throw new Error('Color slot 0 is always present');
        }
        MaterialUtils.setDefine(this._material, this._flagDefine, value);
    }

    public get state(): ColorSlotState {
        return {
            weight: this.weight,
        };
    }

    public set state(state: Partial<ColorSlotState>) {
        if (typeof state.weight !== 'undefined') {
            this.weight = state.weight;
        }
    }
}
