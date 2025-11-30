/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Texture } from 'three';

import type { HasDefines } from '../MaterialUtils';
import type { Classification } from './Classification';

import MaterialUtils from '../MaterialUtils';
import { AttributeSlot } from './AttributeSlot';
import { ClassificationsTexture } from './Classification';

export interface ClassificationPropertiesUniform {
    weight: number;
    lut: Texture | null;
}

export class ClassificationSlot extends AttributeSlot {
    public readonly texture: ClassificationsTexture;
    public readonly uniform: ClassificationPropertiesUniform;

    private readonly _material: HasDefines;

    public constructor(material: HasDefines) {
        super();

        this.texture = new ClassificationsTexture();
        this.uniform = {
            weight: 0,
            lut: this.texture.texture,
        };
        this._material = material;
    }

    public get classifications(): Classification[] {
        return this.texture.classifications;
    }

    public set classifications(classifications: Classification[]) {
        this.texture.classifications = classifications;
    }

    public override get hasAttribute(): boolean {
        return typeof this._material.defines['CLASSIFICATION'] !== 'undefined';
    }

    public set hasAttribute(value: boolean) {
        MaterialUtils.setDefine(this._material, 'CLASSIFICATION', value);
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
}
