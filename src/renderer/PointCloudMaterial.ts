/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type {
    BufferAttribute,
    BufferGeometry,
    Camera,
    ColorRepresentation,
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

import type Extent from '../core/geographic/Extent';
import type ColorLayer from '../core/layer/ColorLayer';
import type { TextureAndPitch } from '../core/layer/Layer';
import type { IntersectingVolume, IntersectingVolumesUniform } from './IntersectingVolume';

import ColorMap from '../core/ColorMap';
import OffsetScale from '../core/OffsetScale';
import MaterialUtils, { type VertexAttributeType } from './MaterialUtils';
import PointsFS from './shader/PointsFS.glsl';
import PointsVS from './shader/PointsVS.glsl';

const tmpDims = new Vector2();

/**
 * Specifies the way points are colored.
 */
export enum MODE {
    /** The points are colored using their own color */
    COLOR = 0,
    /** The points are colored using their intensity */
    INTENSITY = 1,
    /** The points are colored using their classification */
    CLASSIFICATION = 2,
    /** The points are colored using their normal */
    NORMAL = 3,
    /** The points are colored using an external texture, such as a color layer */
    TEXTURE = 4,
    /** The points are colored using their elevation */
    ELEVATION = 5,
}

export type Mode = (typeof MODE)[keyof typeof MODE];

const NUM_TRANSFO = 16;

/**
 * Paremeters for a point cloud classification.
 */
export class Classification {
    /**
     * The color of this classification.
     */
    public color: Color;
    /**
     * Toggles the visibility of points with this classification.
     */
    public visible: boolean;

    public constructor(color: ColorRepresentation, visible = true) {
        this.color = new Color(color);
        this.visible = visible;
    }

    /**
     * Clones this classification.
     * @returns The cloned object.
     */
    public clone(): Classification {
        return new Classification(this.color.clone(), this.visible);
    }
}

/**
 * A set of 256 pre-defined classifications following the ASPRS scheme, with pre-defined colors for
 * classifications 0 to 18. The remaining classifications have the default color (#FF8100)
 *
 * See https://www.asprs.org/wp-content/uploads/2010/12/LAS_Specification.pdf
 */
export const ASPRS_CLASSIFICATIONS: Classification[] = new Array(256);

const DEFAULT_CLASSIFICATION = new Classification(0xff8100);

for (let i = 0; i < ASPRS_CLASSIFICATIONS.length; i++) {
    ASPRS_CLASSIFICATIONS[i] = DEFAULT_CLASSIFICATION.clone();
}

ASPRS_CLASSIFICATIONS[0] = new Classification('#858585'); // Created, never classified
ASPRS_CLASSIFICATIONS[1] = new Classification('#bfbfbf'); // Unclassified
ASPRS_CLASSIFICATIONS[2] = new Classification('#834000'); // Ground
ASPRS_CLASSIFICATIONS[3] = new Classification('#008100'); // Low vegetation
ASPRS_CLASSIFICATIONS[4] = new Classification('#00bf00'); // Medium vegetation
ASPRS_CLASSIFICATIONS[5] = new Classification('#00ff00'); // High vegetation
ASPRS_CLASSIFICATIONS[6] = new Classification('#0081c1'); // Building
ASPRS_CLASSIFICATIONS[7] = new Classification('#ff0000'); // Low point (noise)
ASPRS_CLASSIFICATIONS[8] = DEFAULT_CLASSIFICATION.clone(); // Reserved
ASPRS_CLASSIFICATIONS[9] = new Classification('#0000ff'); // Water
ASPRS_CLASSIFICATIONS[10] = new Classification('#606d73'); // Rail
ASPRS_CLASSIFICATIONS[11] = new Classification('#858585'); // Road surface
ASPRS_CLASSIFICATIONS[12] = DEFAULT_CLASSIFICATION.clone(); // Reserved
ASPRS_CLASSIFICATIONS[13] = new Classification('#ede440'); // Wire - Guard (Shield)
ASPRS_CLASSIFICATIONS[14] = new Classification('#ed6840'); // Wire - Conductor (Phase)
ASPRS_CLASSIFICATIONS[15] = new Classification('#29fff8'); // Transmission Tower
ASPRS_CLASSIFICATIONS[16] = new Classification('#5e441d'); // Wire Structure connector (e.g Insulator)
ASPRS_CLASSIFICATIONS[17] = new Classification('#7992c7'); // Bridge Deck
ASPRS_CLASSIFICATIONS[18] = new Classification('#cd27d6'); // High Noise

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

type Deformation = {
    transformation: Matrix4;
    origin: Vector2;
    influence: Vector2;
    color: Color;
    vec: Vector3;
};

type ColorMapUniform = { min: number; max: number; lut: Texture };

type Uniforms = {
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

    colorMap: IUniform<ColorMapUniform>;

    classifications: IUniform<Classification[]>;

    enableDeformations: IUniform<boolean>;
    deformations: IUniform<Deformation[]>;

    intersectingVolumes: IUniform<IntersectingVolumesUniform>;

    fogDensity: IUniform<number>;
    fogNear: IUniform<number>;
    fogFar: IUniform<number>;
    fogColor: IUniform<Color>;
} & Record<string, IUniform>;

export type Defines = {
    NORMAL?: 1;
    CLASSIFICATION?: 1;
    DEFORMATION_SUPPORT?: 1;
    NUM_TRANSFO?: number;
    USE_LOGDEPTHBUF?: 1;
    NORMAL_OCT16?: 1;
    NORMAL_SPHEREMAPPED?: 1;
    INTERSECTING_VOLUMES_SUPPORT?: 1;
    MAX_INTERSECTING_VOLUMES_COUNT?: number;

    INTENSITY?: 1;
    INTENSITY_TYPE: VertexAttributeType;
};

function createDefaultColorMap(): ColorMap {
    const colors = [new Color('black'), new Color('white')];
    return new ColorMap({ colors, min: 0, max: 1000 });
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

    private _colorMap: ColorMap = createDefaultColorMap();

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
        this.uniforms.mode.value = mode;
    }

    /**
     * Update material uniforms related to intensity and classification attributes.
     */
    public setupFromGeometry(geometry: BufferGeometry): void {
        this.enableClassification = geometry.hasAttribute('classification');

        if (geometry.hasAttribute('intensity')) {
            const intensityType = MaterialUtils.getVertexAttributeType(
                geometry.getAttribute('intensity') as BufferAttribute,
            );

            MaterialUtils.setDefine(this, 'INTENSITY', true);
            MaterialUtils.setDefineValue(this, 'INTENSITY_TYPE', intensityType);
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

    /**
     * Gets or sets the classifications of the points.
     * Up to 256 values are supported (i.e classifications in the range 0-255).
     * @defaultValue {@link ASPRS_CLASSIFICATIONS} (see https://www.asprs.org/wp-content/uploads/2010/12/LAS_Specification.pdf)
     */
    public get classifications(): Classification[] {
        if (this.uniforms.classifications == null) {
            // Initialize with default values
            this.uniforms.classifications = new Uniform(ASPRS_CLASSIFICATIONS);
        }
        return this.uniforms.classifications.value;
    }

    public set classifications(classifications: Classification[]) {
        let actual: Classification[] = classifications;

        if (classifications.length > 256) {
            actual = classifications.slice(0, 256);
            console.warn('The provided classification array has been truncated to 256 elements');
        } else if (classifications.length < 256) {
            actual = new Array(256);
            for (let i = 0; i < actual.length; i++) {
                if (i < classifications.length) {
                    actual[i] = classifications[i];
                } else {
                    actual[i] = DEFAULT_CLASSIFICATION.clone();
                }
            }
        }

        if (this.uniforms.classifications == null) {
            // Initialize with default values
            this.uniforms.classifications = new Uniform(actual);
        }

        this.uniforms.classifications.value = actual;
    }

    /**
     * @internal
     */
    public get enableClassification(): boolean {
        return this.defines.CLASSIFICATION !== undefined;
    }

    /**
     * @internal
     */
    public set enableClassification(enable: boolean) {
        MaterialUtils.setDefine(this, 'CLASSIFICATION', enable);

        if (enable && this.uniforms.classifications == null) {
            // Initialize with default values
            this.uniforms.classifications = new Uniform(ASPRS_CLASSIFICATIONS);
        }
    }

    public get colorMap(): ColorMap {
        return this._colorMap;
    }

    public set colorMap(colorMap: ColorMap) {
        this._colorMap = colorMap;
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
            INTENSITY_TYPE: 'uint',
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

        this.uniforms = {
            fogDensity: new Uniform(0.00025),
            fogNear: new Uniform(1),
            fogFar: new Uniform(2000),
            decimation: new Uniform(1),
            fogColor: new Uniform(new Color(0xffffff)),
            classifications: new Uniform(ASPRS_CLASSIFICATIONS),

            // Texture-related uniforms
            extentBottomLeft: new Uniform(new Vector2(0, 0)),
            extentSize: new Uniform(new Vector2(0, 0)),
            overlayTexture: new Uniform(null),
            hasOverlayTexture: new Uniform(0),
            offsetScale: new Uniform(new OffsetScale(0, 0, 1, 1)),

            colorMap: new Uniform({
                lut: this.colorMap.getTexture(),
                min: this.colorMap.min,
                max: this.colorMap.max,
            }),
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

        const colorMapUniform = this.uniforms.colorMap.value;
        colorMapUniform.min = this.colorMap.min;
        colorMapUniform.max = this.colorMap.max;
        colorMapUniform.lut = this.colorMap.getTexture();
    }

    public override onBeforeRender(_renderer: WebGLRenderer, _scene: Scene, camera: Camera): void {
        this.uniforms.opacity.value = this.opacity;

        this.transparent = this.opacity < 1 || this.colorMap.opacity != null;

        this.updateIntersectingVolumes(camera);
    }

    public override copy(source: PointCloudMaterial): this {
        super.copy(source);

        this.needsUpdate = true;

        this.size = source.size;
        this.mode = source.mode;
        this.overlayColor.copy(source.overlayColor);
        this.classifications = source.classifications;
        this.brightness = source.brightness;
        this.contrast = source.contrast;
        this.saturation = source.saturation;
        this.colorMap = source.colorMap;
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

    public static isPointCloudMaterial = (obj: unknown): obj is PointCloudMaterial =>
        (obj as PointCloudMaterial)?.isPointCloudMaterial;
}

export default PointCloudMaterial;
