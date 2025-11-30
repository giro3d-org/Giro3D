/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { AttributeSlot } from './AttributeSlot';

export interface ColorPropertiesUniform {
    weight: number;
}

export class ColorSlot extends AttributeSlot {
    public readonly uniform: ColorPropertiesUniform;

    public constructor() {
        super();

        this.uniform = {
            weight: 0,
        };
    }

    public override get hasAttribute(): boolean {
        return true;
    }
}
