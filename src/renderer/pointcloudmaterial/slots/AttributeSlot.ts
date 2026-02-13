/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

export interface AttributePropertiesUniform {
    weight: number;
}

export abstract class AttributeSlot {
    public readonly attributeName: string;

    public abstract uniform: AttributePropertiesUniform;

    protected abstract get hasAttribute(): boolean;

    private _wantedWeight: number = 0;

    protected constructor(attributeName: string) {
        this.attributeName = attributeName;
    }

    public set weight(value: number) {
        this._wantedWeight = value;
        this.updateActualWeight();
    }

    public get actualWeight(): number {
        return this.uniform.weight;
    }

    public set actualWeight(value: number) {
        this.uniform.weight = value;
    }

    protected updateActualWeight(): void {
        this.uniform.weight = this.hasAttribute ? this._wantedWeight : 0;
    }
}
