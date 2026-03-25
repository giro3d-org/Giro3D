/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { ColorRepresentation, IUniform, Side } from 'three';

import {
    AdditiveBlending,
    BackSide,
    Color,
    FrontSide,
    Mesh,
    ShaderMaterial,
    Sphere,
    SphereGeometry,
    Uniform,
    Vector2,
    Vector3,
} from 'three';

import type Context from '../core/Context';
import type PickResult from '../core/picking/PickResult';
import type { Entity3DOptions } from './Entity3D';

import Ellipsoid from '../core/geographic/Ellipsoid';
import GlowFS from '../renderer/shader/GlowFS.glsl';
import GlowVS from '../renderer/shader/GlowVS.glsl';
import Entity3D from './Entity3D';

const tmpVec2 = new Vector2();

const sphere = new SphereGeometry(1, 64, 64);

class GlowMaterial extends ShaderMaterial {
    public override uniforms: {
        opacity: IUniform<number>;
        atmoIN: IUniform<boolean>;
        screenSize: IUniform<Vector2>;
        glowColor: IUniform<Color>;
    };

    public constructor(options: {
        side: Side;
        atmoIn: boolean;
        depthWrite: boolean;
        glowColor?: ColorRepresentation;
    }) {
        super({
            vertexShader: GlowVS,
            fragmentShader: GlowFS,
            blending: AdditiveBlending,
            transparent: true,
            side: options.side,
            depthWrite: options.depthWrite,
        });

        const color =
            options.glowColor != null ? new Color(options.glowColor) : new Color(0.45, 0.74, 1.0);

        this.uniforms = {
            atmoIN: new Uniform(options.atmoIn),
            screenSize: new Uniform(new Vector2(1, 1)),
            glowColor: new Uniform(color),
            opacity: new Uniform(1),
        };
    }

    public get color(): Color {
        return this.uniforms.glowColor.value;
    }

    public set color(v: Color) {
        this.uniforms.glowColor.value.copy(v);
    }

    public set screenSize(v: Vector2) {
        this.uniforms.screenSize.value.copy(v);
    }
}

/**
 * Constructor options for the {@link Glow} entity.
 */
export interface GlowOptions extends Entity3DOptions {
    /**
     * The color of the glow.
     */
    color?: ColorRepresentation;
    /**
     * The ellipsoid to use.
     * @defaultValue {@link Ellipsoid.WGS84}
     */
    ellipsoid?: Ellipsoid;
    /**
     * The thickness of the atmosphere
     * @defaultValue 300km (earth atmosphere)
     */
    thickness?: number;
}

/**
 * Displays a simple glow around an ellipsoid.
 */
class Glow extends Entity3D {
    public readonly isGlow = true as const;
    public override readonly type = 'Glow' as const;

    private readonly _ellipsoid: Ellipsoid;
    private readonly _sphere: Sphere;

    private readonly _outerGlow: Mesh<SphereGeometry, GlowMaterial>;
    private readonly _innerGlow: Mesh<SphereGeometry, GlowMaterial>;

    public get color(): Color {
        return this._outerGlow.material.color;
    }

    public set color(v: ColorRepresentation) {
        const color = new Color(v);

        this._innerGlow.material.color = color;
        this._outerGlow.material.color = color;

        this.notifyChange();
    }

    public constructor(options: GlowOptions) {
        super(options);

        this._ellipsoid = options?.ellipsoid ?? Ellipsoid.WGS84;
        this._sphere = new Sphere(new Vector3(0, 0, 0), this._ellipsoid.semiMajorAxis);

        this._innerGlow = this.createGlow(1.14, BackSide, false, true, options?.color);
        this._innerGlow.name = 'inner glow';

        this._outerGlow = this.createGlow(1.002, FrontSide, true, false, options?.color);
        this._outerGlow.name = 'outer glow';
    }

    private createGlow(
        scale: number,
        side: Side,
        atmoIn: boolean,
        depthWrite: boolean,
        glowColor?: ColorRepresentation,
    ): Mesh<SphereGeometry, GlowMaterial> {
        const result = new Mesh(
            sphere,
            new GlowMaterial({
                side,
                atmoIn,
                depthWrite,
                glowColor,
            }),
        );
        result.scale.set(
            scale * this._ellipsoid.semiMajorAxis,
            scale * this._ellipsoid.semiMajorAxis,
            scale * this._ellipsoid.semiMinorAxis,
        );
        this.object3d.add(result);
        result.updateMatrixWorld(true);

        return result;
    }

    public override updateOpacity(): void {
        this._outerGlow.material.uniforms.opacity.value = this.opacity;
        this._innerGlow.material.uniforms.opacity.value = this.opacity;
    }

    private updateMinMaxDistance(context: Context): void {
        const distance = context.distance.plane.distanceToPoint(this.object3d.position);
        const radius = this._sphere.radius * 2;
        this._distance.min = Math.min(this._distance.min, distance - radius);
        this._distance.max = Math.max(this._distance.max, distance + radius);
    }

    public override postUpdate(context: Context, _changeSources: Set<unknown>): void {
        this.instance.engine.getWindowSize(tmpVec2);

        this._outerGlow.material.screenSize = tmpVec2;
        this._innerGlow.material.screenSize = tmpVec2;

        this.updateMinMaxDistance(context);
    }

    public override pick(): PickResult[] {
        return [];
    }
}

export default Glow;
