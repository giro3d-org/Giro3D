/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MathUtils, type Vector3 } from 'three';

import type PickResult from '../core/picking/PickResult';

import SkyDomeObject from '../renderer/SkyDome';
import Entity3D from './Entity3D';

/**
 * Displays a sky dome with atmospheric scattering and sun disc.
 */
class SkyDome extends Entity3D {
    public readonly isSkyDome = true as const;
    public override readonly type = 'SkyDome' as const;

    private readonly _skyDome: SkyDomeObject;
    private _solarDiscDiameter = 2;

    private set<K extends keyof typeof this._skyDome>(
        key: K,
        value: (typeof this._skyDome)[K],
    ): void {
        this._skyDome[key] = value;
        this.notifyChange();
    }

    public get solarDiscDiameter(): number {
        return this._solarDiscDiameter;
    }

    /**
     * The apparent diameter of the solar disc, in degrees.
     */
    public set solarDiscDiameter(v: number) {
        this._solarDiscDiameter = v;
        const cos = Math.cos(MathUtils.degToRad(v));
        this.set('sunAngularDiameterCos', cos);
    }

    /**
     * The turbidity of the atmosphere. A low turbidity makes the atmosphere appear clearer.
     */
    public get turbidity(): number {
        return this._skyDome.turbidity;
    }

    public set turbidity(v: number) {
        this.set('turbidity', v);
    }

    public get luminance(): number {
        return this._skyDome.luminance;
    }

    public set luminance(v: number) {
        this.set('luminance', v);
    }

    public get rayleighCoefficient(): number {
        return this._skyDome.rayleighCoefficient;
    }

    public set rayleighCoefficient(v: number) {
        this.set('rayleighCoefficient', v);
    }

    public get mieCoefficient(): number {
        return this._skyDome.mieCoefficient;
    }

    public set mieCoefficient(v: number) {
        this.set('mieCoefficient', v);
    }

    public get mieDirectionalG(): number {
        return this._skyDome.mieDirectionalG;
    }

    public set mieDirectionalG(v: number) {
        this.set('mieDirectionalG', v);
    }

    public constructor(params?: { atmosphereThickness?: number }) {
        super({
            object3d: new SkyDomeObject({ atmosphereThickness: params?.atmosphereThickness }),
        });

        this._skyDome = this.object3d as SkyDomeObject;

        this.renderOrder = -9999;
    }

    /**
     * Sets the direction of the sun rays.
     */
    public setSunPosition(position: Vector3): void {
        this._skyDome.uniforms.sunPosition.value.copy(position);
        this.notifyChange(this);
    }

    public override dispose(): void {
        this._skyDome.geometry.dispose();
        this._skyDome.material.dispose();
        this.object3d.clear();
    }

    public override pick(): PickResult[] {
        return [];
    }
}

export default SkyDome;
