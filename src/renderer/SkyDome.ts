/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Adapted from original code by https://github.com/zz85
 *
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * http://www.cs.utah.edu/~shirley/papers/sunsky/sunsky.pdf
 *
 * First implemented by Simon Wallner
 * http://www.simonwallner.at/projects/atmospheric-scattering
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * THREE.js integration by zz85 http://twitter.com/blurspline
 */

import type { Camera, IUniform, Scene, WebGLRenderer } from 'three';
import {
    BackSide,
    MathUtils,
    Mesh,
    ShaderMaterial,
    SphereGeometry,
    Uniform,
    UniformsUtils,
    Vector3,
} from 'three';
import SkyDomeFS from './shader/SkyDomeFS.glsl';
import SkyDomeVS from './shader/SkyDomeVS.glsl';

type Uniforms = {
    skyDomeLuminance: IUniform<number>;
    turbidity: IUniform<number>;
    rayleighCoefficient: IUniform<number>;
    mieCoefficient: IUniform<number>;
    mieDirectionalG: IUniform<number>;
    sunPosition: IUniform<Vector3>;
    up: IUniform<Vector3>;
    sunAngularDiameterCos: IUniform<number>;
};

const defaultUniforms: Uniforms = {
    skyDomeLuminance: new Uniform(1),
    turbidity: new Uniform(1.7),
    rayleighCoefficient: new Uniform(1.13),
    mieCoefficient: new Uniform(0.0019),
    mieDirectionalG: new Uniform(0.99),
    sunPosition: new Uniform(new Vector3()),
    up: new Uniform(new Vector3()),
    sunAngularDiameterCos: new Uniform(Math.cos(MathUtils.degToRad(1))),
};

const DEFAULT_ATMOSPHERE_THICKNESS = 40_000;

class SkyDome extends Mesh<SphereGeometry, ShaderMaterial> {
    readonly isSkyDome = true as const;
    override readonly type = 'SkyDome' as const;
    readonly uniforms: Uniforms;

    private set<K extends keyof Uniforms>(key: K, value: Uniforms[K]['value']) {
        this.uniforms[key].value = value;
    }
    private get<K extends keyof Uniforms>(key: K): Uniforms[K]['value'] {
        return this.uniforms[key].value;
    }

    /**
     * The cosine of the solar disc's apparent diameter, in degrees.
     */
    get sunAngularDiameterCos() {
        return this.get('sunAngularDiameterCos');
    }

    set sunAngularDiameterCos(v: number) {
        this.set('sunAngularDiameterCos', v);
    }

    get luminance() {
        return this.get('skyDomeLuminance');
    }

    set luminance(v: number) {
        this.set('skyDomeLuminance', v);
    }

    get turbidity() {
        return this.get('turbidity');
    }

    set turbidity(v: number) {
        this.set('turbidity', v);
    }

    get rayleighCoefficient() {
        return this.get('rayleighCoefficient');
    }

    set rayleighCoefficient(v: number) {
        this.set('rayleighCoefficient', v);
    }

    get mieCoefficient() {
        return this.get('mieCoefficient');
    }

    set mieCoefficient(v: number) {
        this.set('mieCoefficient', v);
    }

    get mieDirectionalG() {
        return this.get('mieDirectionalG');
    }

    set mieDirectionalG(v: number) {
        this.set('mieDirectionalG', v);
    }

    constructor(params?: { atmosphereThickness?: number }) {
        super(
            new SphereGeometry(params?.atmosphereThickness ?? DEFAULT_ATMOSPHERE_THICKNESS, 64, 32),
            new ShaderMaterial({
                fragmentShader: SkyDomeFS,
                vertexShader: SkyDomeVS,
                uniforms: UniformsUtils.clone(defaultUniforms),
                side: BackSide,
                depthTest: false,
                depthWrite: false,
            }),
        );

        this.frustumCulled = false;
        this.uniforms = this.material.uniforms as Uniforms;
    }

    override onBeforeRender(renderer: WebGLRenderer, scene: Scene, camera: Camera): void {
        this.uniforms.up.value.copy(camera.up);
    }
}

export default SkyDome;
