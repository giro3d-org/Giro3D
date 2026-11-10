/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { ColorRepresentation, Material } from 'three';

import { CameraHelper, Color } from 'three';
import {
    CubeCamera,
    DoubleSide,
    HalfFloatType,
    LinearFilter,
    MathUtils,
    Matrix4,
    PerspectiveCamera,
    ShaderMaterial,
    type Texture,
    Vector3,
    Vector4,
    WebGLCubeRenderTarget,
    WebGLRenderTarget,
    type WebGLProgramParametersWithUniforms,
    type WebGLRenderer,
    type Object3D,
} from 'three';

import type Disposable from '../core/Disposable';
import type Instance from '../core/Instance';
import type Entity3D from '../entities/Entity3D';
import type { HasDefines } from '../renderer/MaterialUtils';

import { isTileMesh } from '../entities/tiles/TileMesh';
import LayeredMaterial from '../renderer/LayeredMaterial';
import MaterialUtils from '../renderer/MaterialUtils';
import { isVector4 } from '../utils/predicates';

/** Defines how viewshed is computed */
export enum ViewshedMode {
    /** The viewshed is computed in a radius around the observer */
    Omnidirectional = 1,
    /** The viewshed is computed in a cone of vision originating at the observer */
    Frustum = 2,
}

export interface ViewshedOptions {
    /**
     * The Giro3D instance to use.
     */
    instance: Instance;
    /**
     * The viewshed mode.
     * @defaultValue {@link ViewshedMode.Omnidirectional}
     */
    mode?: ViewshedMode;
    /**
     * The texture size used for the viewshed render target.
     * @defaultValue 2048
     */
    textureSize?: number;
    /**
     * The 3D object layer number to use to filter objects for viewshed rendering.
     * @defaultValue 31
     */
    layerNumber?: number;
    /**
     * The objects to include in the computation.
     */
    objects: Array<Object3D | Entity3D>;
    /**
     * The frustum aspect ratio.
     * @defaultValue 16 / 9.
     */
    frustumAspect?: number;
    /**
     * The frustum field of view.
     * @defaultValue 60
     */
    frustumFov?: number;
    /**
     * The observer position in the scene.
     * @defaultValue Vector3(0, 0, 0)
     */
    origin?: Vector3;
    /**
     * The observer view direction, for frustum viewshed
     * @defaultValue Vector3(1, 0, 0)
     */
    direction?: Vector3;
    /**
     * The minimum distance of viewshed computation. This is equivalent to the depth camera near plane distance.
     * @defaultValue 0.1
     */
    minDistance?: number;
    /**
     * The maximum distance of viewshed computation. This is equivalent to the depth camera far plane distance.
     * @defaultValue 500
     */
    maxDistance?: number;
    /**
     * The viewshed shadow map bias.
     * @defaultValue 0.5
     */
    bias?: number;
    /** The color with which to paint the visible regions.
     * @defaultValue Vector4(51, 255, 51, 0.5)
     */
    visibleColor?: Vector4 | ColorRepresentation;
    /** The color with which to paint the occluded regions.
     * @defaultValue Vector4(255, 51, 51, 0.5)
     */
    occludedColor?: Vector4 | ColorRepresentation;
}

const DISTANCE_MATERIAL_SHADERS = {
    vertex: `
        varying vec3 vWorldPos;

        void main() {
            vec4 worldPos = modelMatrix * vec4(position,1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }`,
    fragment: `
        uniform vec3 origin;
        uniform vec3 nearFarBias;
        varying vec3 vWorldPos;

        void main() {
            float dist = distance(vWorldPos, origin);

            float near = nearFarBias.x;
            float far = nearFarBias.y;

            float depth = (dist - near) / (far - near);

            float k = clamp(depth, 0.0, 1.0);
            gl_FragColor = vec4(k, k, k, 1.0);
        }`,
};

function readColor(x: ColorRepresentation | Vector4): Vector4 {
    if (isVector4(x)) {
        return x;
    }

    const { r, g, b } = new Color(x);
    return new Vector4(r, g, b, 1);
}

const DEFAULT_VISIBLE_COLOR = new Vector4(51, 255, 51, 0.5);
const DEFAULT_OCCLUDED_COLOR = new Vector4(255, 51, 51, 0.5);

function visitMaterials(obj: Object3D, callback: (material: Material) => void): void {
    if ('material' in obj) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(m => callback(m as Material));
        } else {
            callback(obj.material as Material);
        }
    }
}

/**
 * Performs a viewshed simulation (visible/occluded regions from an observer position).
 */
export class Viewshed implements Disposable {
    private readonly _instance: Instance;
    private readonly _layerNumber: number;
    private readonly _distanceMaterial: Material;

    private readonly _origin: Vector3 = new Vector3();
    private readonly _direction: Vector3 = new Vector3();
    private readonly _viewProjection: Matrix4 = new Matrix4();
    private readonly _visibleColor: Vector4 = new Vector4();
    private readonly _occludedColor: Vector4 = new Vector4();
    private readonly _nearFarBias: Vector3 = new Vector3();
    private readonly _alreadyPatchedMaterialsIds = new Set<string>();

    private _mode: ViewshedMode;
    private _textureSize: number;
    private _objects: Array<Object3D | Entity3D> = [];
    private _frustumAspect: number;
    private _frustumFov: number;

    private _renderTarget: WebGLRenderTarget | null = null;
    private _camera: CubeCamera | PerspectiveCamera | null = null;
    private _perspectiveCameraHelper: CameraHelper | null = null;

    public constructor(options: ViewshedOptions) {
        this._instance = options.instance;
        this._mode = options.mode ?? ViewshedMode.Omnidirectional;
        this._textureSize = options.textureSize ?? 2048;
        this._layerNumber = options.layerNumber ?? 31;
        this._objects = options.objects ?? [];
        this._frustumAspect = options.frustumAspect ?? 16 / 9;
        this._frustumFov = options.frustumFov ?? 60;
        this._origin.copy(options.origin ?? new Vector3(0, 0, 0));
        this._direction.copy(options.direction ?? new Vector3(1, 0, 0));
        this._nearFarBias.x = options.minDistance ?? 0.01;
        this._nearFarBias.y = options.maxDistance ?? 500;
        this._nearFarBias.z = options.bias ?? 0.5;
        this._visibleColor.copy(readColor(options.visibleColor ?? DEFAULT_VISIBLE_COLOR));
        this._occludedColor.copy(readColor(options.occludedColor ?? DEFAULT_OCCLUDED_COLOR));

        // Create render target
        this.setupViewshedCamera();

        // Create distance target
        this._distanceMaterial = new ShaderMaterial({
            uniforms: {
                origin: { value: this._origin },
                nearFarBias: { value: this._nearFarBias },
            },
            vertexShader: DISTANCE_MATERIAL_SHADERS.vertex,
            fragmentShader: DISTANCE_MATERIAL_SHADERS.fragment,
        });
        this._distanceMaterial.side = DoubleSide;
    }

    private restoreObjects(parent: Object3D | Entity3D): void {
        const layer = this._layerNumber;

        parent.traverse(obj => {
            obj.layers.disable(layer);

            visitMaterials(obj, (material: Material) => {
                if (this._alreadyPatchedMaterialsIds.has(material.uuid)) {
                    this.unpatchMaterial(material);
                    this._alreadyPatchedMaterialsIds.delete(material.uuid);
                }
            });
        });
    }

    private unpatchMaterial(material: Material): void {
        material.onBeforeCompile = material.userData.originalOnBeforeCompile;
        delete material.userData.originalOnBeforeCompile;
        material.customProgramCacheKey = material.userData.originalCustomProgramCacheKey;
        delete material.userData.originalCustomProgramCacheKey;
        material.needsUpdate = true;
    }

    private patchMaterial(material: Material, cubemap: boolean): void {
        const hasDefines = material as unknown as HasDefines;
        MaterialUtils.setDefine(hasDefines, 'VIEWSHED_CUBEMAP', cubemap);
        MaterialUtils.setDefine(hasDefines, 'VIEWSHED_FRUSTUM', !cubemap);

        if (material instanceof LayeredMaterial) {
            const parameters = material as LayeredMaterial;
            parameters.uniforms.visibilityMap = {
                value: this._renderTarget?.texture,
            };
            parameters.uniforms.origin = { value: this._origin };
            if (this._mode === ViewshedMode.Frustum) {
                parameters.uniforms.viewProjection = {
                    value: this._viewProjection,
                };
            }
            parameters.uniforms.nearFarBias = { value: this._nearFarBias };
            parameters.uniforms.visibleColor = { value: this._visibleColor };
            parameters.uniforms.occludedColor = { value: this._occludedColor };
            parameters.uniformsNeedUpdate = true;
        } else {
            if (material.onBeforeCompile !== this.injectShader) {
                material.userData.originalOnBeforeCompile = material.onBeforeCompile;
                material.userData.originalCustomProgramCacheKey = material.customProgramCacheKey;
                material.onBeforeCompile = this.injectShader.bind(this);
                const shaderKey = MathUtils.generateUUID();
                material.customProgramCacheKey = (): string => shaderKey;
                material.needsUpdate = true;
            }
        }
    }

    private setupObjects(): void {
        this._objects.forEach(obj => this.prepareObjectForViewshed(obj));
    }

    private prepareObjectForViewshed(parent: Object3D | Entity3D): void {
        const layer = this._layerNumber;
        const cubemap = this._mode === ViewshedMode.Omnidirectional;

        parent.traverse(obj => {
            obj.layers.enable(layer);

            if (isTileMesh(obj)) {
                // To render a correct viewshed, we need to deform the mesh on the CPU side.
                // By default, map tiles are deformed only in GPU side.
                obj.updateHeightMapIfNecessary();
            }

            visitMaterials(obj, (material: Material) => {
                if (!this._alreadyPatchedMaterialsIds.has(material.uuid)) {
                    this.patchMaterial(material, cubemap);
                    this._alreadyPatchedMaterialsIds.add(material.uuid);
                }
            });
        });
    }

    private clearObjects(): void {
        this._objects.forEach(obj => this.restoreObjects(obj));
        this._objects = [];
    }

    private injectShader(
        parameters: WebGLProgramParametersWithUniforms,
        _renderer: WebGLRenderer,
    ): void {
        parameters.uniforms.visibilityMap = { value: this._renderTarget?.texture };
        parameters.uniforms.origin = { value: this._origin };
        if (this._mode === ViewshedMode.Frustum) {
            parameters.uniforms.viewProjection = { value: this._viewProjection };
        }
        parameters.uniforms.nearFarBias = { value: this._nearFarBias };
        parameters.uniforms.visibleColor = { value: this._visibleColor };
        parameters.uniforms.occludedColor = { value: this._occludedColor };

        parameters.vertexShader =
            '#include <giro3d_viewshed_pars_vertex>\n' + parameters.vertexShader;

        parameters.vertexShader = parameters.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            #include <giro3d_viewshed_vertex>
            `,
        );

        parameters.fragmentShader =
            '#include <giro3d_viewshed_pars_fragment>\n' + parameters.fragmentShader;

        parameters.fragmentShader = parameters.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <giro3d_viewshed_fragment>
            #include <dithering_fragment>
            `,
        );
    }

    private resetViewshedCamera(): void {
        this._alreadyPatchedMaterialsIds.clear();

        if (this._camera) {
            this._instance.remove(this._camera);
            this._camera = null;
        }
        if (this._renderTarget) {
            this._renderTarget.dispose();
            this._renderTarget = null;
        }
        if (this._perspectiveCameraHelper) {
            this._perspectiveCameraHelper.dispose();
            this._perspectiveCameraHelper.removeFromParent();
            this._perspectiveCameraHelper = null;
        }
    }

    private setupViewshedCamera(): void {
        this.resetViewshedCamera();

        if (this._mode === ViewshedMode.Omnidirectional) {
            const cubeRenderTarget = new WebGLCubeRenderTarget(this._textureSize, {
                type: HalfFloatType,
                generateMipmaps: false,
                minFilter: LinearFilter,
                magFilter: LinearFilter,
            });
            this._renderTarget = cubeRenderTarget;
            this._camera = new CubeCamera(
                this._nearFarBias.x,
                this._nearFarBias.y,
                cubeRenderTarget,
            );
            this._camera.layers.set(this._layerNumber);
            this._instance.add(this._camera);
        } else if (this._mode === ViewshedMode.Frustum) {
            this._renderTarget = new WebGLRenderTarget(this._textureSize, this._textureSize, {
                type: HalfFloatType,
                generateMipmaps: false,
                minFilter: LinearFilter,
                magFilter: LinearFilter,
            });
            this._camera = new PerspectiveCamera(
                this._frustumFov,
                this._frustumAspect,
                this._nearFarBias.x,
                this._nearFarBias.y,
            );
            const helper = new CameraHelper(this._camera);
            this._instance.add(helper);
            this._perspectiveCameraHelper = helper;
            helper.layers.set(0);
            this._camera.up.set(0, 0, 1);
            this._camera.layers.set(this._layerNumber);
            this._instance.add(this._camera);
        }
    }

    /**
     * Gets/sets the viewshed mode.
     */
    public get mode(): ViewshedMode {
        return this._mode;
    }

    public set mode(mode: ViewshedMode) {
        if (this._mode !== mode) {
            this._mode = mode;
            this.setupViewshedCamera();
        }
    }

    /**
     * Gets/sets the texture size used for the viewshed render target.
     */
    public get textureSize(): number {
        return this._textureSize;
    }

    public set textureSize(textureSize: number) {
        if (this._textureSize !== textureSize) {
            this._textureSize = textureSize;
            this.setupViewshedCamera();
        }
    }

    /**
     * Gets/sets the objects included in the viewshed computation.
     * @param objects - The list of objects
     */
    public get objects(): Array<Object3D | Entity3D> {
        return [...this._objects];
    }

    public set objects(objects: Array<Object3D | Entity3D>) {
        this.clearObjects();
        this._objects = [...objects];
        this._objects.forEach(obj => this.prepareObjectForViewshed(obj));
    }

    /**
     * Get/sets the frustum aspect ratio.
     * Note: only active when {@link mode} is set to {@link ViewshedMode.Frustum}.
     */
    public get frustumAspect(): number {
        return this._frustumAspect;
    }

    public set frustumAspect(frustumAspect: number) {
        this._frustumAspect = frustumAspect;
    }

    /**
     * Gets/sets the frustum field of view, in degrees.
     * Note: only active when {@link mode} is set to {@link ViewshedMode.Frustum}.
     */
    public get frustumFov(): number {
        return this._frustumFov;
    }

    public set frustumFov(frustumFov: number) {
        this._frustumFov = frustumFov;
    }

    /**
     * Gets/sets the viewshed origin (the position of the observer).
     */
    public get origin(): Vector3 {
        return this._origin.clone();
    }

    public set origin(origin: Vector3) {
        this._origin.copy(origin);
    }

    /**
     * Gets/sets the frustum direction.
     * Note: only active when {@link mode} is set to {@link ViewshedMode.Frustum}.
     */
    public get direction(): Vector3 {
        return this._direction.clone();
    }

    public set direction(observerDirection: Vector3) {
        this._direction.copy(observerDirection);
    }

    /**
     * Gets/sets the viewshed camera near plane distance.
     */
    public get minDistance(): number {
        return this._nearFarBias.x;
    }

    public set minDistance(dist: number) {
        this._nearFarBias.x = dist;
    }

    /**
     * Gets/sets the maximum viewshed distance.
     */
    public get maxDistance(): number {
        return this._nearFarBias.y;
    }

    public set maxDistance(maxDistance: number) {
        this._nearFarBias.y = maxDistance;
    }

    /**
     * Gets/sets the viewshed shadow map bias.
     */
    public get bias(): number {
        return this._nearFarBias.z;
    }

    public set bias(bias: number) {
        this._nearFarBias.z = bias;
    }

    /**
     * Gets/sets the color of the visible regions of the viewshed.
     */
    public get visibleColor(): Vector4 {
        return this._visibleColor.clone();
    }

    public set visibleColor(visibleColor: Vector4 | ColorRepresentation) {
        this._visibleColor.copy(readColor(visibleColor));
    }

    /**
     * Gets/sets the color of the occluded regions of the viewshed.
     */
    public get occludedColor(): Vector4 {
        return this._occludedColor.clone();
    }

    public set occludedColor(occludedColor: Vector4 | ColorRepresentation) {
        this._occludedColor.copy(readColor(occludedColor));
    }

    /**
     * Render the viewshed.
     */
    public render(): void {
        const renderer = this._instance.renderer;
        const scene = this._instance.scene;

        this.setupObjects();
        this.setupCamera();

        // Render the viewshed
        const prevOverrideMaterial = scene.overrideMaterial;
        scene.overrideMaterial = this._distanceMaterial;

        if (this._mode === ViewshedMode.Omnidirectional) {
            (this._camera as CubeCamera).renderTarget.clear(renderer, true, true, true);
            (this._camera as CubeCamera).update(renderer, scene);
        } else if (this._mode === ViewshedMode.Frustum) {
            const previousTarget = renderer.getRenderTarget();
            renderer.setRenderTarget(this._renderTarget);
            renderer.clear(true, true, true);
            renderer.render(scene, this._camera as PerspectiveCamera);
            renderer.setRenderTarget(previousTarget);
        }

        scene.overrideMaterial = prevOverrideMaterial;

        this._instance.notifyChange();
    }

    private setupCamera(): void {
        if (this._camera instanceof CubeCamera) {
            for (const camera of this._camera.children) {
                if (camera instanceof PerspectiveCamera) {
                    camera.near = this.minDistance;
                    camera.far = this.maxDistance;
                    camera.updateProjectionMatrix();
                }
            }
            this._camera.position.copy(this._origin);
            this._camera.updateMatrixWorld(true);
        } else if (this._camera instanceof PerspectiveCamera) {
            this._camera.fov = this._frustumFov;
            this._camera.aspect = this._frustumAspect;
            this._camera.near = this.minDistance;
            this._camera.far = this.maxDistance;
            this._camera.updateProjectionMatrix();
            this._camera.position.copy(this._origin);
            const target = this._origin.clone().add(this._direction);
            this._camera.lookAt(target);
            this._camera.updateMatrixWorld(true);

            this._perspectiveCameraHelper?.update();
            this._perspectiveCameraHelper?.updateMatrixWorld(true);

            this._viewProjection.multiplyMatrices(
                (this._camera as PerspectiveCamera).projectionMatrix,
                (this._camera as PerspectiveCamera).matrixWorldInverse,
            );
        }
    }

    public getTexture(): Texture | undefined {
        return this._renderTarget?.texture;
    }

    public dispose(): void {
        this.clearObjects();
        this.resetViewshedCamera();
        this._distanceMaterial.dispose();
    }
}

export default Viewshed;
