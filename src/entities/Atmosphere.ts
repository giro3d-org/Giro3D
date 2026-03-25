/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { IUniform } from 'three';

import {
    AdditiveBlending,
    BackSide,
    Mesh,
    ShaderMaterial,
    Sphere,
    SphereGeometry,
    Texture,
    Uniform,
    Vector3,
} from 'three';

import type Context from '../core/Context';
import type PickResult from '../core/picking/PickResult';
import type { Entity3DOptions } from './Entity3D';

import Ellipsoid from '../core/geographic/Ellipsoid';
import GroundFS from '../renderer/shader/GroundFS.glsl';
import GroundVS from '../renderer/shader/GroundVS.glsl';
import SkyFS from '../renderer/shader/SkyFS.glsl';
import SkyVS from '../renderer/shader/SkyVS.glsl';
import { isShaderMaterial } from '../utils/predicates';
import Entity3D from './Entity3D';

const tmpVec3 = new Vector3();
const tmpPos = new Vector3();

type SkyUniforms = {
    opacity: IUniform<number>;
    v3LightPosition: IUniform<Vector3>;
    v3InvWavelength: IUniform<Vector3>;
    fCameraHeight: IUniform<number>;
    fCameraHeight2: IUniform<number>;
    fInnerRadius: IUniform<number>;
    fInnerRadius2: IUniform<number>;
    fOuterRadius: IUniform<number>;
    fOuterRadius2: IUniform<number>;
    fKrESun: IUniform<number>;
    fKmESun: IUniform<number>;
    fKr4PI: IUniform<number>;
    fKm4PI: IUniform<number>;
    fScale: IUniform<number>;
    fScaleDepth: IUniform<number>;
    fScaleOverScaleDepth: IUniform<number>;
    g: IUniform<number>;
    g2: IUniform<number>;
    nSamples: IUniform<number>;
    fSamples: IUniform<number>;
    tDisplacement: IUniform<Texture>;
    tSkyboxDiffuse: IUniform<Texture>;
    fNightScale: IUniform<number>;
} & Record<string, IUniform>;

/**
 * Constructor options for the {@link Atmosphere} entity.
 */
export interface AtmosphereOptions extends Entity3DOptions {
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
    /**
     * Red, green, blue wavelength, in normalized values (i;e in the [0, 1] range)
     * @defaultValue [0.65, 0.57, 0.475]
     */
    wavelengths?: [number, number, number];
}

/**
 * Displays an atmosphere around an ellipsoid.
 *
 * The entity is made of two components:
 * - `.inner`, which represents the atmosphere inside the ring and acts as a "veil",
 * - `.outer`, which represents the visible halo on the edge of the ring
 */
class Atmosphere extends Entity3D {
    public readonly isAtmosphere = true as const;
    public override readonly type = 'Atmosphere' as const;

    private readonly _ellipsoid: Ellipsoid;
    private readonly _sphere: Sphere;
    private readonly _inner: Mesh<SphereGeometry, ShaderMaterial>;
    private readonly _outer: Mesh<SphereGeometry, ShaderMaterial>;
    private readonly _sphereUniforms: SkyUniforms;
    private readonly _wavelengths = [0.65, 0.57, 0.475];

    private _disposed = false;

    public get ellipsoid(): Ellipsoid {
        return this._ellipsoid;
    }

    public get redWavelength(): number {
        return this._wavelengths[0];
    }

    public set redWavelength(v: number) {
        this._wavelengths[0] = v;
        this._sphereUniforms.v3InvWavelength.value.x = 1 / Math.pow(v, 4);
        this.notifyChange();
    }

    public get greenWavelength(): number {
        return this._wavelengths[1];
    }

    public set greenWavelength(v: number) {
        this._wavelengths[1] = v;
        this._sphereUniforms.v3InvWavelength.value.y = 1 / Math.pow(v, 4);
        this.notifyChange();
    }

    public get blueWavelength(): number {
        return this._wavelengths[2];
    }

    public set blueWavelength(v: number) {
        this._wavelengths[2] = v;
        this._sphereUniforms.v3InvWavelength.value.z = 1 / Math.pow(v, 4);
        this.notifyChange();
    }

    public get outer(): Mesh {
        return this._outer;
    }

    public get inner(): Mesh {
        return this._inner;
    }

    public constructor(options?: AtmosphereOptions) {
        super(options);

        this._ellipsoid = options?.ellipsoid ?? Ellipsoid.WGS84;

        const radius = this._ellipsoid.semiMajorAxis;

        this._wavelengths = options?.wavelengths ?? this._wavelengths;

        this._sphere = new Sphere(new Vector3(0, 0, 0), radius);

        const thickness = options?.thickness ?? 300_000;

        const atmosphere = {
            Kr: 0.0025,
            Km: 0.001,
            ESun: 20.0,
            g: -0.95,
            innerRadius: radius,
            outerRadius: radius + thickness,
            scaleDepth: 0.25,
            mieScaleDepth: 0.1,
        };

        this._sphereUniforms = {
            opacity: new Uniform(1),
            v3LightPosition: new Uniform(new Vector3(1, 0, 0)),
            v3InvWavelength: new Uniform(
                new Vector3(
                    1 / Math.pow(this._wavelengths[0], 4),
                    1 / Math.pow(this._wavelengths[1], 4),
                    1 / Math.pow(this._wavelengths[2], 4),
                ),
            ),
            fCameraHeight: new Uniform(0),
            fCameraHeight2: new Uniform(0),
            fInnerRadius: new Uniform(atmosphere.innerRadius),
            fInnerRadius2: new Uniform(atmosphere.innerRadius * atmosphere.innerRadius),
            fOuterRadius: new Uniform(atmosphere.outerRadius),
            fOuterRadius2: new Uniform(atmosphere.outerRadius * atmosphere.outerRadius),
            fKrESun: new Uniform(atmosphere.Kr * atmosphere.ESun),
            fKmESun: new Uniform(atmosphere.Km * atmosphere.ESun),
            fKr4PI: new Uniform(atmosphere.Kr * 4.0 * Math.PI),
            fKm4PI: new Uniform(atmosphere.Km * 4.0 * Math.PI),
            fScale: new Uniform(1 / (atmosphere.outerRadius - atmosphere.innerRadius)),
            fScaleDepth: new Uniform(atmosphere.scaleDepth),
            fScaleOverScaleDepth: {
                value:
                    1 / (atmosphere.outerRadius - atmosphere.innerRadius) / atmosphere.scaleDepth,
            },
            g: new Uniform(atmosphere.g),
            g2: new Uniform(atmosphere.g * atmosphere.g),
            nSamples: new Uniform(3),
            fSamples: new Uniform(3.0),
            tDisplacement: new Uniform(new Texture()),
            tSkyboxDiffuse: new Uniform(new Texture()),
            fNightScale: new Uniform(1.0),
        };

        const innerGeometry = new SphereGeometry(atmosphere.innerRadius, 64, 32);
        const innerMaterial = new ShaderMaterial({
            uniforms: this._sphereUniforms,
            vertexShader: GroundVS,
            fragmentShader: GroundFS,
            blending: AdditiveBlending,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        this._inner = new Mesh(innerGeometry, innerMaterial);
        this._inner.name = 'inner';
        this._inner.visible = true;

        const outerGeometry = new SphereGeometry(atmosphere.outerRadius, 128, 64);
        const outerMaterial = new ShaderMaterial({
            uniforms: this._sphereUniforms,
            vertexShader: SkyVS,
            fragmentShader: SkyFS,
            transparent: true,
            side: BackSide,
        });
        this._outer = new Mesh(outerGeometry, outerMaterial);
        this._outer.name = 'outer';
        this._outer.visible = true;

        this.object3d.add(this._inner);
        this.object3d.add(this._outer);

        this.object3d.updateMatrixWorld(true);

        this.updateOpacity();
        this.updateRenderOrder();

        this.object3d.scale.set(1, 1, this._ellipsoid.compressionFactor);
        this.object3d.updateMatrixWorld(true);
    }

    public override updateOpacity(): void {
        this.traverseMaterials(m => {
            if (isShaderMaterial(m)) {
                if (m.uniforms.opacity != null) {
                    m.uniforms.opacity.value = this.opacity;
                }
            }
        });
    }

    private updateMinMaxDistance(context: Context): void {
        const distance = context.distance.plane.distanceToPoint(this.object3d.position);
        const radius = this._sphere.radius * 2;
        this._distance.min = Math.min(this._distance.min, distance - radius);
        this._distance.max = Math.max(this._distance.max, distance + radius);
    }

    public override postUpdate(context: Context, _changeSources: Set<unknown>): void {
        this.updateMinMaxDistance(context);
    }

    public override pick(): PickResult[] {
        // Atmosphere is not pickable.
        return [];
    }

    /**
     * Sets the position of the sun.
     */
    public setSunPosition(position: Vector3): void {
        tmpPos.copy(position);

        const direction = tmpPos.sub(this.object3d.getWorldPosition(tmpVec3)).normalize();

        this._outer.material.uniforms.v3LightPosition.value.copy(direction);
        this._inner.material.uniforms.v3LightPosition.value.copy(direction);

        this.notifyChange(this);
    }

    public override dispose(): void {
        if (this._disposed) {
            return;
        }

        this._outer.material.dispose();
        this._outer.geometry.dispose();

        this._inner.material.dispose();
        this._inner.geometry.dispose();

        this.object3d.clear();

        this._disposed = true;
    }
}

export default Atmosphere;
