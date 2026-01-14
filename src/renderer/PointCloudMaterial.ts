/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type {
    BufferAttribute,
    BufferGeometry,
    Camera,
    IUniform,
    Scene,
    Texture,
    WebGLRenderer,
} from 'three';

import {
    Color,
    GLSL3,
    Matrix4,
    NoBlending,
    NormalBlending,
    ShaderMaterial,
    Uniform,
    Vector2,
    Vector3,
    Vector4,
} from 'three';

import type ColorMap from '../core/ColorMap';
import type Extent from '../core/geographic/Extent';
import type ColorLayer from '../core/layer/ColorLayer';
import type { TextureAndPitch } from '../core/layer/Layer';
import type { IntersectingVolume, IntersectingVolumesUniform } from './IntersectingVolume';
import type { VertexAttributeType } from './MaterialUtils';
import type { ColorMapUniform } from './pointcloudmaterial/ColorMapUniform';
import type {
    ClassificationPropertiesUniform,
    ClassificationSlotState,
} from './pointcloudmaterial/slots/ClassificationSlot';
import type { ColorPropertiesUniform, ColorSlotState } from './pointcloudmaterial/slots/ColorSlot';
import type {
    ScalarPropertiesUniform,
    ScalarSlotState,
} from './pointcloudmaterial/slots/ScalarSlot';

import OffsetScale from '../core/OffsetScale';
import MaterialUtils from './MaterialUtils';
import { ASPRS_CLASSIFICATIONS, Classification } from './pointcloudmaterial/Classification';
import { buildColorMapUniform, createDefaultColorMap } from './pointcloudmaterial/ColorMapUniform';
import { ClassificationSlot } from './pointcloudmaterial/slots/ClassificationSlot';
import { ColorSlot } from './pointcloudmaterial/slots/ColorSlot';
import { ScalarSlot } from './pointcloudmaterial/slots/ScalarSlot';
import PointsFS from './shader/PointsFS.glsl';
import PointsVS from './shader/PointsVS.glsl';

export { ASPRS_CLASSIFICATIONS, Classification };

const tmpDims = new Vector2();

/**
 * Specifies the way points are colored.
 */
export enum MODE {
    /** The points are colored using their own color */
    COLOR = 0,
    /** The points are colored using  one of their attributes */
    SCALAR = 1,
    /** The points are colored using their classification */
    CLASSIFICATION = 2,
    /** The points are colored using their normal */
    NORMAL = 3,
    /** The points are colored using an external texture, such as a color layer */
    TEXTURE = 4,
    /** The points are colored using their elevation */
    ELEVATION = 5,
    /** The points are colored using a mix of their attributes */
    ATTRIBUTES = 6,
}

export type Mode = (typeof MODE)[keyof typeof MODE];

const NUM_TRANSFO = 16;

export interface PointCloudMaterialOptions {
    /**
     * The point size.
     *
     * @defaultValue 0
     */
    size?: number;
    /**
     * The point decimation.
     *
     * @defaultValue 1
     */
    decimation?: number;
    /**
     * An additional color to use.
     *
     * @defaultValue `new Vector4(0, 0, 0, 0)`
     */
    overlayColor?: Vector4;
    /**
     * Specifies the criterion to colorize points.
     *
     * @defaultValue MODE.COLOR
     */
    mode?: Mode;
}

interface Deformation {
    transformation: Matrix4;
    origin: Vector2;
    influence: Vector2;
    color: Color;
    vec: Vector3;
}

interface Uniforms extends Record<string, IUniform> {
    opacity: IUniform<number>;
    brightnessContrastSaturation: IUniform<Vector3>;
    size: IUniform<number>;
    decimation: IUniform<number>;
    mode: IUniform<MODE>;
    pickingId: IUniform<number>;
    overlayColor: IUniform<Vector4>;
    hasOverlayTexture: IUniform<number>;
    overlayTexture: IUniform<Texture | null>;
    offsetScale: IUniform<OffsetScale>;
    extentBottomLeft: IUniform<Vector2>;
    extentSize: IUniform<Vector2>;

    elevationColorMap: IUniform<ColorMapUniform>;

    colorProperties: IUniform<ColorPropertiesUniform[]>;
    scalarProperties: IUniform<ScalarPropertiesUniform[]>;
    classificationProperties: IUniform<ClassificationPropertiesUniform[]>;

    enableDeformations: IUniform<boolean>;
    deformations: IUniform<Deformation[]>;

    intersectingVolumes: IUniform<IntersectingVolumesUniform>;

    fogDensity: IUniform<number>;
    fogNear: IUniform<number>;
    fogFar: IUniform<number>;
    fogColor: IUniform<Color>;
}

export interface Defines extends Record<string, unknown> {
    NORMAL?: 1;
    COLOR_1?: 1;
    COLOR_2?: 1;
    CLASSIFICATION_0?: 1;
    CLASSIFICATION_1?: 1;
    CLASSIFICATION_2?: 1;
    DEFORMATION_SUPPORT?: 1;
    NUM_TRANSFO?: number;
    USE_LOGDEPTHBUF?: 1;
    NORMAL_OCT16?: 1;
    NORMAL_SPHEREMAPPED?: 1;
    INTERSECTING_VOLUMES_SUPPORT?: 1;
    MAX_INTERSECTING_VOLUMES_COUNT?: number;

    SCALAR_0?: 1;
    SCALAR_0_TYPE: VertexAttributeType;
    SCALAR_1?: 1;
    SCALAR_1_TYPE: VertexAttributeType;
    SCALAR_2?: 1;
    SCALAR_2_TYPE: VertexAttributeType;
}

export interface AttributesState {
    colors: [ColorSlotState, ColorSlotState, ColorSlotState];
    scalars: [ScalarSlotState, ScalarSlotState, ScalarSlotState];
    classifications: [ClassificationSlotState, ClassificationSlotState, ClassificationSlotState];
}

export interface PartialAttributesState {
    colors?: Array<Partial<ColorSlotState> | undefined>;
    scalars?: Array<Partial<ScalarSlotState> | undefined>;
    classifications?: Array<Partial<ClassificationSlotState> | undefined>;
}

/**
 * Material used for point clouds.
 */
class PointCloudMaterial extends ShaderMaterial {
    // This is an arbitrary limit, only there to prevent running out of uniform slots.
    public static readonly maxIntersectingVolumesCount: number = 8;

    public readonly isPointCloudMaterial = true;

    public colorLayer: ColorLayer | null;
    public disposed = false;

    public intersectingVolumes: IntersectingVolume[] = [];

    private _elevationColorMap: ColorMap = createDefaultColorMap();

    private readonly _colorSlots: [ColorSlot, ColorSlot, ColorSlot];
    private readonly _scalarSlots: [ScalarSlot, ScalarSlot, ScalarSlot];
    private readonly _classificationSlots: [
        ClassificationSlot,
        ClassificationSlot,
        ClassificationSlot,
    ];

    /**
     * @internal
     */
    public override readonly uniforms: Uniforms;

    /**
     * @internal
     */
    public override readonly defines: Defines;

    /**
     * Gets or sets the point size.
     */
    public get size(): number {
        return this.uniforms.size.value;
    }

    public set size(value: number) {
        this.uniforms.size.value = value;
    }

    /**
     * Gets or sets the point decimation value.
     * A decimation value of N means that we take every Nth point and discard the rest.
     */
    public get decimation(): number {
        return this.uniforms.decimation.value;
    }

    public set decimation(value: number) {
        this.uniforms.decimation.value = value;
    }

    /**
     * Gets or sets the display mode (color, classification...)
     */
    public get mode(): Mode {
        return this.uniforms.mode.value;
    }

    public set mode(mode: Mode) {
        if (mode === MODE.COLOR || mode === MODE.CLASSIFICATION || mode === MODE.SCALAR) {
            this.attributesState = {
                colors: [{ weight: mode === MODE.COLOR ? 1 : 0 }, { weight: 0 }, { weight: 0 }],
                scalars: [{ weight: mode === MODE.SCALAR ? 1 : 0 }, { weight: 0 }, { weight: 0 }],
                classifications: [
                    { weight: mode === MODE.CLASSIFICATION ? 1 : 0 },
                    { weight: 0 },
                    { weight: 0 },
                ],
            };
        }
        this.uniforms.mode.value = mode;
    }

    /**
     * Update material uniforms related to scalar and classification attributes.
     */
    public setupFromGeometry(geometry: BufferGeometry): void {
        for (const slot of this._classificationSlots) {
            slot.hasAttribute = geometry.hasAttribute(slot.attributeName);
        }

        for (const slot of this._scalarSlots) {
            slot.hasAttribute = geometry.hasAttribute(slot.attributeName);
            if (slot.hasAttribute) {
                slot.attributeType = MaterialUtils.getVertexAttributeType(
                    geometry.getAttribute(slot.attributeName) as BufferAttribute,
                );
            }
        }

        for (let i = 1; i < this._colorSlots.length; i++) {
            const slot = this._colorSlots[i];
            slot.hasAttribute = geometry.hasAttribute(slot.attributeName);
        }
    }

    /**
     * @internal
     */
    public get pickingId(): number {
        return this.uniforms.pickingId.value;
    }

    /**
     * @internal
     */
    public set pickingId(id: number) {
        this.uniforms.pickingId.value = id;
    }

    /**
     * Gets or sets the overlay color (default color).
     */
    public get overlayColor(): Vector4 {
        return this.uniforms.overlayColor.value;
    }

    public set overlayColor(color: Vector4) {
        this.uniforms.overlayColor.value = color;
    }

    /**
     * Gets or sets the brightness of the points.
     */
    public get brightness(): number {
        return this.uniforms.brightnessContrastSaturation.value.x;
    }

    public set brightness(v: number) {
        this.uniforms.brightnessContrastSaturation.value.setX(v);
    }

    /**
     * Gets or sets the contrast of the points.
     */
    public get contrast(): number {
        return this.uniforms.brightnessContrastSaturation.value.y;
    }

    public set contrast(v: number) {
        this.uniforms.brightnessContrastSaturation.value.setY(v);
    }

    /**
     * Gets or sets the saturation of the points.
     */
    public get saturation(): number {
        return this.uniforms.brightnessContrastSaturation.value.z;
    }

    public set saturation(v: number) {
        this.uniforms.brightnessContrastSaturation.value.setZ(v);
    }

    public get elevationColorMap(): ColorMap {
        return this._elevationColorMap;
    }

    public set elevationColorMap(colorMap: ColorMap) {
        this._elevationColorMap = colorMap;
    }

    /**
     * Creates a PointsMaterial using the specified options.
     *
     * @param options - The options.
     */
    public constructor(options: PointCloudMaterialOptions = {}) {
        super({ clipping: true, glslVersion: GLSL3 });
        this.vertexShader = PointsVS;
        this.fragmentShader = PointsFS;

        // Default
        this.defines = {
            SCALAR_0_TYPE: 'uint',
            SCALAR_1_TYPE: 'uint',
            SCALAR_2_TYPE: 'uint',
            MAX_INTERSECTING_VOLUMES_COUNT: PointCloudMaterial.maxIntersectingVolumesCount,
        };

        for (const key of Object.keys(MODE)) {
            if (Object.prototype.hasOwnProperty.call(MODE, key)) {
                // @ts-expect-error a weird pattern indeed
                this.defines[`MODE_${key}`] = MODE[key];
            }
        }

        this.fog = true;
        this.colorLayer = null;
        this.needsUpdate = true;

        this._colorSlots = [new ColorSlot(this, 0), new ColorSlot(this, 1), new ColorSlot(this, 2)];
        this._scalarSlots = [
            new ScalarSlot(this, 0),
            new ScalarSlot(this, 1),
            new ScalarSlot(this, 2),
        ];
        this._classificationSlots = [
            new ClassificationSlot(this, 0),
            new ClassificationSlot(this, 1),
            new ClassificationSlot(this, 2),
        ];

        this.uniforms = {
            fogDensity: new Uniform(0.00025),
            fogNear: new Uniform(1),
            fogFar: new Uniform(2000),
            decimation: new Uniform(1),
            fogColor: new Uniform(new Color(0xffffff)),

            colorProperties: new Uniform(this._colorSlots.map(slot => slot.uniform)),
            scalarProperties: new Uniform(this._scalarSlots.map(slot => slot.uniform)),
            classificationProperties: new Uniform(
                this._classificationSlots.map(slot => slot.uniform),
            ),

            // Texture-related uniforms
            extentBottomLeft: new Uniform(new Vector2(0, 0)),
            extentSize: new Uniform(new Vector2(0, 0)),
            overlayTexture: new Uniform(null),
            hasOverlayTexture: new Uniform(0),
            offsetScale: new Uniform(new OffsetScale(0, 0, 1, 1)),

            elevationColorMap: new Uniform(buildColorMapUniform(this.elevationColorMap)),

            size: new Uniform(options.size ?? 0),
            mode: new Uniform(options.mode ?? MODE.COLOR),
            pickingId: new Uniform(0),
            opacity: new Uniform(this.opacity),
            overlayColor: new Uniform(options.overlayColor ?? new Vector4(0, 0, 0, 0)),
            brightnessContrastSaturation: new Uniform(new Vector3(0, 1, 1)),

            enableDeformations: new Uniform(false),
            deformations: new Uniform([]),

            intersectingVolumes: new Uniform({ count: 0, volumes: [] }),
        };

        for (let i = 0; i < NUM_TRANSFO; i++) {
            this.uniforms.deformations.value.push({
                transformation: new Matrix4(),
                vec: new Vector3(),
                origin: new Vector2(),
                influence: new Vector2(),
                color: new Color(),
            });
        }

        for (let i = 0; i < PointCloudMaterial.maxIntersectingVolumesCount; i++) {
            this.uniforms.intersectingVolumes.value.volumes.push({
                viewToBoxNc: new Matrix4(),
                color: new Color(),
            });
        }
    }

    public override dispose(): void {
        if (this.disposed) {
            return;
        }

        for (const slot of this._classificationSlots) {
            slot.dispose();
        }

        this.dispatchEvent({ type: 'dispose' });
        this.disposed = true;
    }

    /**
     * Internally used for picking.
     * @internal
     */
    public enablePicking(picking: number): void {
        this.pickingId = picking;
        this.blending = picking ? NoBlending : NormalBlending;
    }

    public hasColorLayer(layer: ColorLayer): boolean {
        return this.colorLayer === layer;
    }

    public updateUniforms(): void {
        this.uniforms.opacity.value = this.opacity;

        this.uniforms.elevationColorMap.value = buildColorMapUniform(this.elevationColorMap);

        for (const slot of this._scalarSlots) {
            slot.update();
        }
    }

    public override onBeforeRender(_renderer: WebGLRenderer, _scene: Scene, camera: Camera): void {
        this.uniforms.opacity.value = this.opacity;

        this.transparent = this.opacity < 1 || this.elevationColorMap.opacity != null;

        this.updateAttributesWeights();

        this.updateIntersectingVolumes(camera);

        for (const slot of this._classificationSlots) {
            slot.update();
        }
    }

    public override copy(source: PointCloudMaterial): this {
        super.copy(source);

        this.needsUpdate = true;

        this.size = source.size;
        this.mode = source.mode;
        this.overlayColor.copy(source.overlayColor);
        this.attributesState = source.attributesState;
        this.brightness = source.brightness;
        this.contrast = source.contrast;
        this.saturation = source.saturation;
        this.elevationColorMap = source.elevationColorMap;
        this.decimation = source.decimation;

        this.updateUniforms();

        return this;
    }

    public removeColorLayer(): void {
        this.mode = MODE.COLOR;
        this.colorLayer = null;
        this.uniforms.overlayTexture.value = null;
        this.needsUpdate = true;
        this.uniforms.hasOverlayTexture.value = 0;
    }

    public pushColorLayer(layer: ColorLayer, extent: Extent): void {
        this.mode = MODE.TEXTURE;

        this.colorLayer = layer;
        this.uniforms.extentBottomLeft.value.set(extent.west, extent.south);
        const dim = extent.dimensions(tmpDims);
        this.uniforms.extentSize.value.copy(dim);
        this.needsUpdate = true;
    }

    public indexOfColorLayer(layer: ColorLayer): number {
        if (layer === this.colorLayer) {
            return 0;
        }

        return -1;
    }

    public getColorTexture(layer: ColorLayer): Texture | null {
        if (layer !== this.colorLayer) {
            return null;
        }
        return this.uniforms.overlayTexture?.value;
    }

    public setColorTextures(layer: ColorLayer, textureAndPitch: TextureAndPitch): void {
        const { texture } = textureAndPitch;
        this.uniforms.overlayTexture.value = texture;
        this.uniforms.hasOverlayTexture.value = 1;
    }

    public setLayerVisibility(): void {
        // no-op
    }

    public setLayerOpacity(): void {
        // no-op
    }

    public setLayerElevationRange(): void {
        // no-op
    }

    public setColorimetry(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        layer: ColorLayer,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        brightness: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        contrast: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        saturation: number,
    ): void {
        // Not implemented because the points have their own BCS controls
    }

    public get attributesState(): AttributesState {
        return {
            colors: [
                this._colorSlots[0].state,
                this._colorSlots[1].state,
                this._colorSlots[2].state,
            ],
            scalars: [
                this._scalarSlots[0].state,
                this._scalarSlots[1].state,
                this._scalarSlots[2].state,
            ],
            classifications: [
                this._classificationSlots[0].state,
                this._classificationSlots[1].state,
                this._classificationSlots[2].state,
            ],
        };
    }

    public set attributesState(state: PartialAttributesState) {
        if (typeof state.colors !== 'undefined') {
            const colors = state.colors;

            this._colorSlots.forEach((slot, index) => {
                if (typeof colors[index] !== 'undefined') {
                    slot.state = colors[index];
                }
            });
        }

        if (typeof state.scalars !== 'undefined') {
            const scalars = state.scalars;

            this._scalarSlots.forEach((slot, index) => {
                if (typeof scalars[index] !== 'undefined') {
                    slot.state = scalars[index];
                }
            });
        }

        if (typeof state.classifications !== 'undefined') {
            const classifications = state.classifications;

            this._classificationSlots.forEach((slot, index) => {
                if (typeof classifications[index] !== 'undefined') {
                    slot.state = classifications[index];
                }
            });
        }
    }

    /**
     * Unused for now.
     * @internal
     */
    public enableTransfo(v: boolean): void {
        if (v) {
            this.defines.DEFORMATION_SUPPORT = 1;
            this.defines.NUM_TRANSFO = NUM_TRANSFO;
        } else {
            delete this.defines.DEFORMATION_SUPPORT;
            delete this.defines.NUM_TRANSFO;
        }
        this.needsUpdate = true;
    }

    private updateIntersectingVolumes(camera: Camera): void {
        const hasIntersectingVolumes = this.intersectingVolumes.length > 0;
        MaterialUtils.setDefine(this, 'INTERSECTING_VOLUMES_SUPPORT', hasIntersectingVolumes);
        if (hasIntersectingVolumes) {
            if (this.intersectingVolumes.length > PointCloudMaterial.maxIntersectingVolumesCount) {
                throw new Error(
                    `Too many intersecting volumes (${this.intersectingVolumes.length}, max is ${PointCloudMaterial.maxIntersectingVolumesCount}).`,
                );
            }

            const invViewMatrix = camera.matrixWorld;
            for (let i = 0; i < this.intersectingVolumes.length; i++) {
                const volumeUniform = this.uniforms.intersectingVolumes.value.volumes[i];
                const volumeDefinition = this.intersectingVolumes[i];

                volumeUniform.viewToBoxNc.multiplyMatrices(
                    volumeDefinition.worldToBoxNdc,
                    invViewMatrix,
                );
                volumeUniform.color.copy(volumeDefinition.color);
            }
            this.uniforms.intersectingVolumes.value.count = this.intersectingVolumes.length;
        }
    }

    private updateAttributesWeights(): void {
        const allSlots = [...this._scalarSlots, ...this._classificationSlots, ...this._colorSlots];

        let totalWeight = 0;
        for (const slot of allSlots) {
            totalWeight += slot.actualWeight;
        }

        if (totalWeight > 0) {
            // normalize attributes
            for (const slot of allSlots) {
                slot.actualWeight /= totalWeight;
            }
        } else {
            // default to color
            this._colorSlots[0].weight = 1;
        }
    }

    public static isPointCloudMaterial = (obj: unknown): obj is PointCloudMaterial =>
        (obj as PointCloudMaterial)?.isPointCloudMaterial;
}

export default PointCloudMaterial;
