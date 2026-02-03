/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Texture } from 'three';

import type { HasDefines } from '../../MaterialUtils';
import type { Classification } from '../Classification';

import MaterialUtils from '../../MaterialUtils';
import { ClassificationsTexture } from '../Classification';
import { AttributeSlot } from './AttributeSlot';

export interface ClassificationPropertiesUniform {
    weight: number;
    lut: Texture | null;
}

export interface ClassificationSlotState {
    weight: number;
    classifications: Classification[];
}

type SlotIndex = 0 | 1 | 2;
const slotNames: Record<SlotIndex, string> = {
    0: 'classification',
    1: 'classification_1',
    2: 'classification_2',
};

export class ClassificationSlot extends AttributeSlot {
    public static getAttributeName(index: SlotIndex): string {
        return slotNames[index];
    }

    public readonly texture: ClassificationsTexture;
    public readonly uniform: ClassificationPropertiesUniform;

    private readonly _material: HasDefines;
    private readonly _flagDefine: string;

    public constructor(material: HasDefines, index: SlotIndex) {
        super(ClassificationSlot.getAttributeName(index));

        this.texture = new ClassificationsTexture();
        this.uniform = {
            weight: 0,
            lut: this.texture.texture,
        };
        this._material = material;

        this._flagDefine = `CLASSIFICATION_${index};`;
    }

    public get classifications(): Classification[] {
        return this.texture.classifications;
    }

    public set classifications(classifications: Classification[]) {
        this.texture.classifications = classifications;
    }

    public override get hasAttribute(): boolean {
        return typeof this._material.defines[this._flagDefine] !== 'undefined';
    }

    public set hasAttribute(value: boolean) {
        MaterialUtils.setDefine(this._material, this._flagDefine, value);
        this.updateActualWeight();
    }

    public update(): void {
        if (this.hasAttribute) {
            this.texture.updateUniform();
        }
    }

    public dispose(): void {
        this.texture.dispose();
    }

    public get state(): ClassificationSlotState {
        return {
            weight: this.weight,
            classifications: this.classifications,
        };
    }

    public set state(state: Partial<ClassificationSlotState>) {
        if (typeof state.weight !== 'undefined') {
            this.weight = state.weight;
        }
        if (typeof state.classifications !== 'undefined') {
            this.classifications = state.classifications;
        }
    }
}
