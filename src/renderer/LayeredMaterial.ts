/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type {
    ColorRepresentation,
    IUniform,
    Light,
    Side,
    Texture,
    TextureDataType,
    WebGLProgramParametersWithUniforms,
    WebGLRenderer,
} from 'three';

import {
    Color,
    GLSL3,
    NoBlending,
    NormalBlending,
    RGBAFormat,
    ShaderMaterial,
    Uniform,
    UniformsLib,
    UnsignedByteType,
    Vector2,
    Vector3,
    Vector4,
} from 'three';

import type ColorimetryOptions from '../core/ColorimetryOptions';
import type ColorMapMode from '../core/ColorMapMode';
import type ContourLineOptions from '../core/ContourLineOptions';
import type ElevationRange from '../core/ElevationRange';
import type Extent from '../core/geographic/Extent';
import type GraticuleOptions from '../core/GraticuleOptions';
import type ColorLayer from '../core/layer/ColorLayer';
import type ElevationLayer from '../core/layer/ElevationLayer';
import type Layer from '../core/layer/Layer';
import type { TextureAndPitch } from '../core/layer/Layer';
import type MaskLayer from '../core/layer/MaskLayer';
import type { MaskMode } from '../core/layer/MaskLayer';
import type MemoryUsage from '../core/MemoryUsage';
import type TerrainOptions from '../core/TerrainOptions';
import type MapLightingOptions from '../entities/MapLightingOptions';
import type { AtlasInfo, LayerAtlasInfo } from './AtlasBuilder';
import type ColorMapAtlas from './ColorMapAtlas';

import BlendingMode from '../core/layer/BlendingMode';
import { type GetMemoryUsageContext } from '../core/MemoryUsage';
import OffsetScale from '../core/OffsetScale';
import Rect from '../core/Rect';
import Capabilities from '../core/system/Capabilities';
import { MapLightingMode } from '../entities/MapLightingOptions';
import { getColor } from '../utils/predicates';
import TextureGenerator from '../utils/TextureGenerator';
import { nonNull } from '../utils/tsutils';
import AtlasBuilder from './AtlasBuilder';
import WebGLComposer from './composition/WebGLComposer';
import EmptyTexture from './EmptyTexture';
import MaterialUtils from './MaterialUtils';
import MemoryTracker from './MemoryTracker';
import RenderingState from './RenderingState';
import TileFS from './shader/TileFS.glsl';
import TileVS from './shader/TileVS.glsl';

const EMPTY_IMAGE_SIZE = 16;

const tmpDims = new Vector2();

const emptyTexture = new EmptyTexture();

const COLORMAP_DISABLED = 0;

const DISABLED_ELEVATION_RANGE = new Vector2(-999999, 999999);

class TextureInfo {
    public readonly layer: ColorLayer;

    public originalOffsetScale: OffsetScale;
    public offsetScale: OffsetScale;
    public texture: Texture;
    public opacity: number;
    public visible: boolean;
    public color: Color;
    public elevationRange?: Vector2;
    public brightnessContrastSaturation: Vector3;

    public constructor(layer: ColorLayer) {
        this.layer = layer;
        this.opacity = layer.opacity;
        this.visible = layer.visible;
        this.offsetScale = new OffsetScale(0, 0, 0, 0);
        this.originalOffsetScale = new OffsetScale(0, 0, 0, 0);
        this.texture = emptyTexture;
        this.color = new Color(1, 1, 1);
        this.brightnessContrastSaturation = new Vector3(0, 1, 1);
    }

    public get mode(): MaskMode {
        return (this.layer as MaskLayer).maskMode ?? 0;
    }
}
export const DEFAULT_OUTLINE_COLOR = 'red';
export const DEFAULT_HILLSHADING_INTENSITY = 1;
export const DEFAULT_HILLSHADING_ZFACTOR = 1;
export const DEFAULT_AZIMUTH = 135;
export const DEFAULT_ZENITH = 45;
export const DEFAULT_GRATICULE_COLOR = new Color(0, 0, 0);
export const DEFAULT_GRATICULE_STEP = 500; // meters
export const DEFAULT_GRATICULE_THICKNESS = 1;
export const DEFAULT_SUN_DIRECTION = new Vector3(1, 0, 0);

function drawImageOnAtlas(
    width: number,
    height: number,
    composer: WebGLComposer,
    atlasInfo: LayerAtlasInfo,
    texture: Texture,
): void {
    const dx = atlasInfo.x;
    const dy = atlasInfo.y + nonNull(atlasInfo.offset);
    const dw = width;
    const dh = height;

    const rect = new Rect(dx, dx + dw, dy, dy + dh);

    composer.draw(texture, rect);
}

function updateOffsetScale(
    imageSize: Vector2,
    atlas: LayerAtlasInfo,
    originalOffsetScale: OffsetScale,
    width: number,
    height: number,
    target: OffsetScale,
): void {
    if (originalOffsetScale.z === 0 || originalOffsetScale.w === 0) {
        target.set(0, 0, 0, 0);
        return;
    }
    // compute offset / scale
    const xRatio = imageSize.width / width;
    const yRatio = imageSize.height / height;

    target.set(
        atlas.x / width + originalOffsetScale.x * xRatio,
        (atlas.y + nonNull(atlas.offset)) / height + originalOffsetScale.y * yRatio,
        originalOffsetScale.z * xRatio,
        originalOffsetScale.w * yRatio,
    );
}

function repeat<T extends object>(value: T, count: number): T[] {
    const result: T[] = new Array(count);
    for (let i = 0; i < count; i++) {
        result[i] = { ...value };
    }
    return result;
}

export interface MaterialOptions {
    /**
     * Discards no-data pixels.
     */
    discardNoData: boolean;
    /**
     * Geometric terrain options.
     */
    terrain: Required<TerrainOptions>;
    /**
     * Colorimetry options for the entire material.
     */
    colorimetry: Required<ColorimetryOptions>;
    /**
     * The sidedness.
     */
    side: Side;
    /**
     * Contour lines options.
     */
    contourLines: Required<ContourLineOptions>;
    /**
     * Lighting options.
     */
    lighting: Required<MapLightingOptions>;
    /**
     * Graticule options.
     */
    graticule: Required<GraticuleOptions>;
    /**
     * The elevation range.
     */
    elevationRange: { min: number; max: number } | null;
    /**
     * The colormap atlas.
     */
    colorMapAtlas: ColorMapAtlas | null;
    /**
     * The background color.
     */
    backgroundColor: Color;
    /**
     * The background opacity.
     */
    backgroundOpacity: number;
    /**
     * Show the outlines of tile meshes.
     */
    showTileOutlines: boolean;
    /**
     * The tile outline color.
     * @defaultValue {@link DEFAULT_OUTLINE_COLOR}
     */
    tileOutlineColor: Color;
    /**
     * Force using texture atlases even when not required by WebGL limitations.
     */
    forceTextureAtlases: boolean;
    /**
     * Displays the collider meshes used for raycast.
     */
    showColliderMeshes: boolean;
    /**
     * Displays the bounding boxes of tiles.
     */
    showBoundingBoxes: boolean;
    /**
     * Displays the bounding spheres of tiles.
     */
    showBoundingSpheres: boolean;
    helperColor: ColorRepresentation;
    depthTest: boolean;
}

enum InternalShadingMode {
    Disabled = 0,
    Simple = 1,
    Realistic = 2,
}

function mapLightingMode(input: MapLightingOptions): InternalShadingMode {
    if (input.enabled !== true) {
        return InternalShadingMode.Disabled;
    }

    if (input.mode === MapLightingMode.LightBased) {
        return InternalShadingMode.Realistic;
    }
    return InternalShadingMode.Simple;
}

interface HillshadingUniform {
    mode: InternalShadingMode;
    intensity: number;
    zFactor: number;
    zenith: number;
    azimuth: number;
}

interface ContourLineUniform {
    thickness: number;
    primaryInterval: number;
    secondaryInterval: number;
    color: Vector4;
}

interface GraticuleUniform {
    thickness: number;
    /** xOffset, yOffset, xStep, yStep */
    position: Vector4;
    color: Vector4;
}

interface LayerUniform {
    offsetScale: Vector4;
    color: Vector4;
    textureSize: Vector2;
    elevationRange: Vector2;
    brightnessContrastSaturation: Vector3;
    mode: 0 | MaskMode;
    blendingMode: BlendingMode;
}

interface NeighbourUniform {
    offsetScale: Vector4 | null;
    diffLevel: number;
}

interface ColorMapUniform {
    mode: ColorMapMode | 0;
    min: number;
    max: number;
    offset: number;
}

interface Defines extends Record<string, unknown> {
    ENABLE_CONTOUR_LINES?: 1;
    STITCHING?: 1;
    TERRAIN_DEFORMATION?: 1;
    DISCARD_NODATA_ELEVATION?: 1;
    ENABLE_ELEVATION_RANGE?: 1;
    ELEVATION_LAYER?: 1;
    ENABLE_LAYER_MASKS?: 1;
    ENABLE_OUTLINES?: 1;
    APPLY_SHADING_ON_COLORLAYERS?: 1;
    ENABLE_GRATICULE?: 1;
    USE_ATLAS_TEXTURE?: 1;

    /** Normal color rendering */
    COLOR_RENDER?: 1;
    /** For depth-based effects, such as shadow maps for directional lights */
    DEPTH_RENDER?: 1;
    /** For distance-based effects, such as shadow maps for point lights */
    DISTANCE_RENDER?: 1;

    /** The number of _visible_ color layers */
    /**
     * The z coordinate of vertices is reset before computing terrain
     */
    GLOBE?: 1;
    /**
     * The number of _visible_ color layers
     */
    VISIBLE_COLOR_LAYER_COUNT: number;

    ENABLE_SKIRTS?: 1;
}

type ThreeUniforms = typeof UniformsLib.common & typeof UniformsLib.fog & typeof UniformsLib.lights;

interface Uniforms extends ThreeUniforms, Record<string, IUniform> {
    // The id of the tile encoded into a single float
    uuid: IUniform<number>;

    // Lighting & shading
    hillshading: IUniform<HillshadingUniform>;

    renderingState: IUniform<RenderingState>;

    segments: IUniform<number>;
    extent: IUniform<Vector4>;
    tileDimensions: IUniform<Vector2>;
    neighbours: IUniform<NeighbourUniform[]>;
    neighbourTextures: IUniform<(Texture | null)[]>;

    elevationRange: IUniform<Vector2>;

    baseTextureSize: IUniform<Vector2>;

    graticule: IUniform<GraticuleUniform>;

    contourLines: IUniform<ContourLineUniform>;

    backgroundColor: IUniform<Vector4>;
    tileOutlineColor: IUniform<Color>;

    brightnessContrastSaturation: IUniform<Vector3>;

    colorMapAtlas: IUniform<Texture | null>;
    layersColorMaps: IUniform<ColorMapUniform[]>;
    elevationColorMap: IUniform<ColorMapUniform>;

    elevationScaling: IUniform<number>;

    elevationTexture: IUniform<Texture | null>;
    atlasTexture: IUniform<Texture | null>;
    colorTextures: IUniform<Texture[]>;

    layers: IUniform<LayerUniform[]>;
    elevationLayer: IUniform<LayerUniform>;

    // For distance-based rendering (point light shadow maps)
    referencePosition: IUniform<Vector3>;
    nearDistance: IUniform<number>;
    farDistance: IUniform<number>;

    // Skirts related uniforms
    // The skirt elevation, in CRS units (might be negative)
    skirtElevation: IUniform<number>;
    // The start and end index of vertices located at the bottom of the skirt
    skirtVertexRange: IUniform<Vector2>;
}

class LayeredMaterial extends ShaderMaterial implements MemoryUsage {
    public readonly isMemoryUsage = true as const;

    // Used for point-light shadow maps
    public light?: Light;

    private readonly _getIndexFn: (arg0: Layer) => number;
    private readonly _renderer: WebGLRenderer;
    private readonly _colorLayers: ColorLayer[] = [];
    private readonly _atlasInfo: AtlasInfo;
    private readonly _forceTextureAtlas: boolean;
    private readonly _maxTextureImageUnits: number;
    private readonly _textureSize: Vector2;
    private readonly _texturesInfo: {
        color: {
            infos: TextureInfo[];
            atlasTexture: Texture | null;
        };
        elevation: {
            offsetScale: OffsetScale;
            texture: Texture | null;
        };
    };

    private _elevationLayer: ElevationLayer | null = null;
    private _mustUpdateUniforms = true;
    private _needsSorting = true;
    private _needsAtlasRepaint = false;
    private _composer: WebGLComposer | null = null;
    private _colorMapAtlas: ColorMapAtlas | null = null;
    private _composerDataType: TextureDataType = UnsignedByteType;

    public override readonly uniforms: Uniforms;

    public override readonly defines: Defines = {
        VISIBLE_COLOR_LAYER_COUNT: 0,
    };

    private _options?: MaterialOptions;

    public getMemoryUsage(context: GetMemoryUsageContext): void {
        // We only consider textures that this material owns. That excludes layer textures.
        const atlas = this._texturesInfo.color.atlasTexture;
        if (atlas) {
            TextureGenerator.getMemoryUsage(context, atlas);
        }
    }

    public constructor(params: {
        /** the material options. */
        options: MaterialOptions;
        /** the WebGL renderer. */
        renderer: WebGLRenderer;
        /** The number of maximum texture units in fragment shaders */
        maxTextureImageUnits: number;
        /** The function to help sorting color layers. */
        getIndexFn: (arg0: Layer) => number;
        /** The texture data type to be used for the atlas texture. */
        textureDataType: TextureDataType;
        hasElevationLayer: boolean;
        tileDimensions: Vector2;
        extent: Extent;
        textureSize: Vector2;
        isGlobe: boolean;
    }) {
        super({ clipping: true, glslVersion: GLSL3 });

        this._atlasInfo = { maxX: 0, maxY: 0, atlas: null };
        this._textureSize = params.textureSize;
        this.fog = true;
        this._maxTextureImageUnits = params.maxTextureImageUnits;
        this._getIndexFn = params.getIndexFn;

        const options = params.options;

        MaterialUtils.setDefine(this, 'USE_ATLAS_TEXTURE', false);
        MaterialUtils.setDefine(this, 'STITCHING', options.terrain.stitching);
        MaterialUtils.setDefine(this, 'GLOBE', params.isGlobe);
        MaterialUtils.setDefine(this, 'TERRAIN_DEFORMATION', options.terrain.enabled);
        MaterialUtils.setDefine(this, 'DISCARD_NODATA_ELEVATION', options.discardNoData);
        MaterialUtils.setDefine(this, 'ENABLE_ELEVATION_RANGE', options.elevationRange != null);
        MaterialUtils.setDefineValue(this, 'VISIBLE_COLOR_LAYER_COUNT', 0);
        MaterialUtils.setDefine(this, 'COLOR_RENDER', true);

        this.fragmentShader = TileFS;
        this.vertexShader = TileVS;

        this._texturesInfo = {
            color: {
                infos: [],
                atlasTexture: null,
            },
            elevation: {
                offsetScale: new OffsetScale(0, 0, 0, 0),
                texture: null,
            },
        };

        this.side = options.side;
        this.lights = true;
        this._renderer = params.renderer;
        this._forceTextureAtlas = options.forceTextureAtlases ?? false;
        this._composerDataType = params.textureDataType;
        this._colorMapAtlas = options.colorMapAtlas ?? null;

        const elevationRange = options.elevationRange
            ? new Vector2(options.elevationRange.min, options.elevationRange.max)
            : DISABLED_ELEVATION_RANGE;

        const elevInfo = this._texturesInfo.elevation;

        const extent = params.extent;

        const { width, height } = extent.dimensions(tmpDims);

        this.uniforms = {
            // Automatically updated by THREE.js
            ...UniformsLib.common,
            ...UniformsLib.lights,
            ...UniformsLib.fog,

            // Uniforms for point light shadow maps
            referencePosition: new Uniform(new Vector3()),
            nearDistance: new Uniform(1),
            farDistance: new Uniform(1000),

            uuid: new Uniform(0),

            baseTextureSize: new Uniform(this._textureSize),

            hillshading: new Uniform<HillshadingUniform>({
                mode: mapLightingMode(options.lighting),
                zenith: DEFAULT_ZENITH,
                azimuth: DEFAULT_AZIMUTH,
                intensity: DEFAULT_HILLSHADING_INTENSITY,
                zFactor: DEFAULT_HILLSHADING_ZFACTOR,
            }),

            renderingState: new Uniform(RenderingState.FINAL),

            extent: new Uniform(new Vector4(extent.west, extent.south, width, height)),
            tileDimensions: new Uniform(params.tileDimensions),
            segments: new Uniform(options.terrain.segments ?? 8),
            neighbours: new Uniform(
                repeat<NeighbourUniform>(
                    {
                        diffLevel: 0,
                        offsetScale: null,
                    },
                    8,
                ),
            ),
            neighbourTextures: new Uniform([null, null, null, null, null, null, null, null]),

            elevationRange: new Uniform(elevationRange),

            graticule: new Uniform<GraticuleUniform>({
                color: new Vector4(0, 0, 0, 1),
                thickness: DEFAULT_GRATICULE_THICKNESS,
                position: new Vector4(0, 0, DEFAULT_GRATICULE_STEP, DEFAULT_GRATICULE_STEP),
            }),

            contourLines: new Uniform({
                thickness: 1,
                primaryInterval: 100,
                secondaryInterval: 20,
                color: new Vector4(0, 0, 0, 1),
            }),

            backgroundColor: new Uniform(new Vector4()),
            tileOutlineColor: new Uniform(new Color(DEFAULT_OUTLINE_COLOR)),

            brightnessContrastSaturation: new Uniform(new Vector3(0, 1, 1)),

            colorMapAtlas: new Uniform(null),
            layersColorMaps: new Uniform([]),
            elevationColorMap: new Uniform<ColorMapUniform>({
                mode: 0,
                offset: 0,
                max: 0,
                min: 0,
            }),

            elevationScaling: new Uniform(1),

            elevationTexture: new Uniform(elevInfo.texture),
            atlasTexture: new Uniform(this._texturesInfo.color.atlasTexture),
            colorTextures: new Uniform([]),

            // Describe the properties of each color layer (offsetScale, color...).
            layers: new Uniform([]),
            elevationLayer: new Uniform<LayerUniform>({
                brightnessContrastSaturation: new Vector3(0, 1, 1),
                color: new Vector4(0, 0, 0, 0),
                elevationRange: new Vector2(0, 0),
                offsetScale: new OffsetScale(0, 0, 0, 0),
                textureSize: new Vector2(0, 0),
                blendingMode: BlendingMode.None,
                mode: 0,
            }),

            skirtVertexRange: new Uniform(new Vector2(0, 0)),
            skirtElevation: new Uniform(0),
        };

        this.uniformsNeedUpdate = true;

        this.update(options);

        MemoryTracker.track(this, 'LayeredMaterial');
    }

    /**
     * @param v - The number of segments.
     */
    public set segments(v: number) {
        this.uniforms.segments.value = v;
    }

    public updateNeighbour(
        neighbour: number,
        diffLevel: number,
        offsetScale: OffsetScale,
        texture: Texture | null,
    ): void {
        this.uniforms.neighbours.value[neighbour].diffLevel = diffLevel;
        this.uniforms.neighbours.value[neighbour].offsetScale = offsetScale;
        this.uniforms.neighbourTextures.value[neighbour] = texture;
    }

    public setElevationScaling(scaling: number): void {
        this.uniforms.elevationScaling.value = scaling;
    }

    public override onBeforeCompile(parameters: WebGLProgramParametersWithUniforms): void {
        // This is a workaround due to a limitation in three.js, documented
        // here: https://github.com/mrdoob/three.js/issues/28020
        // Normally, we would not have to do this and let the loop unrolling do its job.
        // However, in our case, the loop end index is not an integer, but a define.
        // We have to patch the fragment shader ourselves because three.js will not do it
        // before the loop is unrolled, leading to a compilation error.
        parameters.fragmentShader = parameters.fragmentShader.replaceAll(
            'COLOR_LAYERS_LOOP_END',
            `${this.defines.VISIBLE_COLOR_LAYER_COUNT}`,
        );
    }

    private updateColorLayerUniforms(): void {
        const useAtlas = this.defines.USE_ATLAS_TEXTURE === 1;

        this.sortLayersIfNecessary();

        if (this._mustUpdateUniforms) {
            const layersUniform: LayerUniform[] = [];
            const infos = this._texturesInfo.color.infos;
            const textureUniforms = this.uniforms.colorTextures.value;
            textureUniforms.length = 0;

            for (const info of infos) {
                const layer = info.layer;
                // Ignore non-visible layers
                if (!layer.visible) {
                    continue;
                }

                // If we use an atlas, the offset/scale is different.
                const offsetScale = useAtlas ? info.offsetScale : info.originalOffsetScale;
                const tex = info.texture;
                let textureSize = new Vector2(0, 0);
                const image = tex.image;
                if (image != null) {
                    textureSize = new Vector2(image.width, image.height);
                }

                const rgb = info.color;
                const a = info.visible ? info.opacity : 0;
                const color = new Vector4(rgb.r, rgb.g, rgb.b, a);
                const elevationRange = info.elevationRange || DISABLED_ELEVATION_RANGE;

                const uniform: LayerUniform = {
                    offsetScale,
                    color,
                    textureSize,
                    elevationRange,
                    mode: info.mode,
                    blendingMode: layer.blendingMode,
                    brightnessContrastSaturation: info.brightnessContrastSaturation,
                };

                layersUniform.push(uniform);

                if (!useAtlas) {
                    textureUniforms.push(tex);
                }
            }

            this.uniforms.layers.value = layersUniform;
        }
    }

    public override dispose(): void {
        this.dispatchEvent({
            type: 'dispose',
        });

        for (const layer of this._colorLayers) {
            const index = this.indexOfColorLayer(layer);
            if (index === -1) {
                continue;
            }
            delete this._texturesInfo.color.infos[index];
        }

        this._colorLayers.length = 0;
        this._composer?.dispose();
        this._texturesInfo.color.atlasTexture?.dispose();
    }

    public getColorTexture(layer: ColorLayer): Texture | null {
        const index = this.indexOfColorLayer(layer);

        if (index === -1) {
            return null;
        }
        return this._texturesInfo.color.infos[index].texture;
    }

    private countIndividualTextures(): { totalTextureUnits: number; visibleColorLayers: number } {
        let totalTextureUnits = 0;
        if (this._elevationLayer) {
            totalTextureUnits++;

            if (this.defines.STITCHING) {
                // We use 8 neighbour textures for stit-ching
                totalTextureUnits += 8;
            }
        }
        if (this._colorMapAtlas) {
            totalTextureUnits++;
        }

        const visibleColorLayers = this.getVisibleColorLayerCount();
        // Count only visible color layers
        totalTextureUnits += visibleColorLayers;

        return { totalTextureUnits, visibleColorLayers };
    }

    public override onBeforeRender(): void {
        this.updateOpacityParameters(this.opacity);

        if (this.defines.USE_ATLAS_TEXTURE && this._needsAtlasRepaint) {
            this.repaintAtlas();
            this._needsAtlasRepaint = false;
        }

        this.updateColorWrite();

        this.updateColorLayerUniforms();

        this.updateColorMaps();
    }

    /**
     * Determine if this material should write to the color buffer.
     */
    private updateColorWrite(): void {
        if (this._texturesInfo.elevation.texture == null && this.defines.DISCARD_NODATA_ELEVATION) {
            // No elevation texture means that every single fragment will be discarded,
            // which is an illegal operation in WebGL (raising warnings).
            this.colorWrite = false;
        } else {
            this.colorWrite = true;
        }
    }

    public repaintAtlas(): void {
        this.rebuildAtlasIfNecessary();

        const composer = nonNull(this._composer);

        composer.clear();

        // Redraw all visible color layers on the canvas
        for (const l of this._colorLayers) {
            if (!l.visible) {
                continue;
            }

            const idx = this.indexOfColorLayer(l);
            const atlas = nonNull(this._atlasInfo.atlas)[l.id];

            const layerTexture = this._texturesInfo.color.infos[idx].texture;

            const w = layerTexture?.image?.width ?? EMPTY_IMAGE_SIZE;
            const h = layerTexture?.image?.height ?? EMPTY_IMAGE_SIZE;

            updateOffsetScale(
                new Vector2(w, h),
                atlas,
                this._texturesInfo.color.infos[idx].originalOffsetScale,
                this.composerWidth,
                this.composerHeight,
                this._texturesInfo.color.infos[idx].offsetScale,
            );

            if (layerTexture != null) {
                drawImageOnAtlas(w, h, nonNull(composer), atlas, layerTexture);
            }
        }

        const rendered = composer.render();
        rendered.name = 'LayeredMaterial - Atlas';

        MemoryTracker.track(rendered, rendered.name);

        // Even though we asked the composer to reuse the same texture, sometimes it has
        // to recreate a new texture when some parameters change, such as pixel format.
        if (rendered.uuid !== this._texturesInfo.color.atlasTexture?.uuid) {
            this.rebuildAtlasTexture(rendered);
        }

        this.uniforms.atlasTexture.value = this._texturesInfo.color.atlasTexture;
    }

    public setColorTextures(layer: ColorLayer, textureAndPitch: TextureAndPitch): void {
        const index = this.indexOfColorLayer(layer);
        if (index < 0) {
            this.pushColorLayer(layer);
        }

        const { pitch, texture } = textureAndPitch;
        this._texturesInfo.color.infos[index].originalOffsetScale.copy(pitch);
        this._texturesInfo.color.infos[index].texture = texture;

        const currentSize = TextureGenerator.getBytesPerChannel(this._composerDataType);
        const textureSize = TextureGenerator.getBytesPerChannel(texture.type);
        if (textureSize > currentSize) {
            // The new layer uses a bigger data type, we need to recreate the atlas
            this._composerDataType = texture.type;
        }

        this._needsAtlasRepaint = true;
    }

    public pushElevationLayer(layer: ElevationLayer): void {
        this._elevationLayer = layer;
    }

    public removeElevationLayer(): void {
        this._elevationLayer = null;
        this.uniforms.elevationTexture.value = null;
        this._texturesInfo.elevation.texture = null;
        MaterialUtils.setDefine(this, 'ELEVATION_LAYER', false);
    }

    public setElevationTexture(
        layer: ElevationLayer,
        { texture, pitch }: { texture: Texture; pitch: OffsetScale },
    ): void {
        this._elevationLayer = layer;

        MaterialUtils.setDefine(this, 'ELEVATION_LAYER', true);

        this.uniforms.elevationTexture.value = texture;
        this._texturesInfo.elevation.texture = texture;
        this._texturesInfo.elevation.offsetScale.copy(pitch);

        const uniform = this.uniforms.elevationLayer.value;
        uniform.offsetScale = pitch;
        uniform.textureSize = new Vector2(texture.image.width, texture.image.height);
        uniform.color = new Vector4(1, 1, 1, 1);
        uniform.brightnessContrastSaturation = new Vector3(1, 1, 1);
        uniform.elevationRange = new Vector2();

        this.updateColorMaps();
    }

    private rebuildAtlasInfo(): void {
        const colorLayers = this._colorLayers;

        // rebuild color textures atlas
        // We use a margin to prevent atlas bleeding.
        const margin = 1.1;
        const { width, height } = this._textureSize;

        const { atlas, maxX, maxY } = AtlasBuilder.pack(
            Capabilities.getMaxTextureSize(),
            colorLayers.map(l => ({
                id: l.id,
                size: new Vector2(
                    Math.round(width * l.resolutionFactor * margin),
                    Math.round(height * l.resolutionFactor * margin),
                ),
            })),
            this._atlasInfo.atlas,
        );
        this._atlasInfo.atlas = atlas;
        this._atlasInfo.maxX = Math.max(this._atlasInfo.maxX, maxX);
        this._atlasInfo.maxY = Math.max(this._atlasInfo.maxY, maxY);
    }

    public pushColorLayer(newLayer: ColorLayer): void {
        if (this._colorLayers.includes(newLayer)) {
            return;
        }
        this._colorLayers.push(newLayer);

        const info = new TextureInfo(newLayer);

        if (newLayer.type === 'MaskLayer') {
            MaterialUtils.setDefine(this, 'ENABLE_LAYER_MASKS', true);
        }

        this.rebuildAtlasInfo();

        // Optional feature: limit color layer display within an elevation range
        if (newLayer.elevationRange != null) {
            MaterialUtils.setDefine(this, 'ENABLE_ELEVATION_RANGE', true);
            const { min, max } = newLayer.elevationRange;
            info.elevationRange = new Vector2(min, max);
        }

        this._texturesInfo.color.infos.push(info);

        this.updateColorLayerCount();

        this.updateColorMaps();

        this.needsUpdate = true;
    }

    private getVisibleColorLayerCount(): number {
        let result = 0;
        for (let i = 0; i < this._colorLayers.length; i++) {
            const layer = this._colorLayers[i];
            if (layer.visible) {
                result++;
            }
        }
        return result;
    }

    public reorderLayers(): void {
        this._needsSorting = true;
    }

    private sortLayersIfNecessary(): void {
        const idx = this._getIndexFn;
        if (this._needsSorting) {
            this._colorLayers.sort((a, b) => idx(a) - idx(b));
            this._texturesInfo.color.infos.sort((a, b) => idx(a.layer) - idx(b.layer));
            this._needsSorting = false;
        }
    }

    public removeColorLayer(layer: ColorLayer): void {
        const index = this.indexOfColorLayer(layer);
        if (index === -1) {
            return;
        }
        // NOTE: we cannot dispose the texture here, because it might be cached for later.
        this._texturesInfo.color.infos.splice(index, 1);
        this._colorLayers.splice(index, 1);

        this.updateColorMaps();
        this.rebuildAtlasInfo();

        this.updateColorLayerCount();
    }

    /**
     * Sets the colormap atlas.
     *
     * @param atlas - The atlas.
     */
    public setColorMapAtlas(atlas: ColorMapAtlas | null): void {
        this._colorMapAtlas = atlas;
    }

    private updateColorMaps(): void {
        this.sortLayersIfNecessary();

        const atlas = this._colorMapAtlas;

        const elevationColorMap = this._elevationLayer?.colorMap;

        const elevationUniform = this.uniforms.elevationColorMap;
        if (elevationColorMap?.active === true) {
            elevationUniform.value.mode = elevationColorMap?.mode ?? COLORMAP_DISABLED;
            elevationUniform.value.min = elevationColorMap?.min ?? 0;
            elevationUniform.value.max = elevationColorMap?.max ?? 0;
            elevationUniform.value.offset = atlas?.getOffset(elevationColorMap) ?? 0;
        } else {
            elevationUniform.value.mode = COLORMAP_DISABLED;
            elevationUniform.value.min = 0;
            elevationUniform.value.max = 0;
        }

        const colorLayers = this._texturesInfo.color.infos;
        const uniforms: ColorMapUniform[] = [];

        for (let i = 0; i < colorLayers.length; i++) {
            const texInfo = colorLayers[i];
            if (!texInfo.layer.visible) {
                continue;
            }

            const colorMap = texInfo.layer.colorMap;

            const uniform: ColorMapUniform = {
                mode: colorMap?.active === true ? colorMap.mode : COLORMAP_DISABLED,
                min: colorMap?.min ?? 0,
                max: colorMap?.max ?? 0,
                offset: colorMap ? (atlas?.getOffset(colorMap) ?? 0) : 0,
            };

            uniforms.push(uniform);
        }

        this.uniforms.layersColorMaps = new Uniform(uniforms);

        if (atlas?.texture) {
            const luts = atlas.texture ?? null;
            this.uniforms.colorMapAtlas.value = luts;
        }
    }

    private updateGraticuleUniforms(opts: MaterialOptions): void {
        const graticule = opts.graticule;
        const enabled = graticule.enabled ?? false;
        MaterialUtils.setDefine(this, 'ENABLE_GRATICULE', enabled);
        if (enabled) {
            const uniform = this.uniforms.graticule.value;
            uniform.thickness = graticule.thickness;
            uniform.position.set(
                graticule.xOffset,
                graticule.yOffset,
                graticule.xStep,
                graticule.yStep,
            );
            const rgb = getColor(graticule.color);
            uniform.color.set(rgb.r, rgb.g, rgb.b, graticule.opacity ?? 0);
        }
    }

    private updateContourLineUniforms(opts: MaterialOptions): void {
        const contourLines = opts.contourLines;

        if (contourLines.enabled) {
            const c = getColor(contourLines.color);
            const a = contourLines.opacity;

            this.uniforms.contourLines.value = {
                thickness: contourLines.thickness ?? 1,
                primaryInterval: contourLines.interval ?? 100,
                secondaryInterval: contourLines.secondaryInterval ?? 0,
                color: new Vector4(c.r, c.g, c.b, a),
            };
        }

        MaterialUtils.setDefine(this, 'ENABLE_CONTOUR_LINES', contourLines.enabled);
    }

    private updateColorUniforms(opts: MaterialOptions): void {
        const a = opts.backgroundOpacity;
        const c = opts.backgroundColor;
        const vec4 = new Vector4(c.r, c.g, c.b, a);
        this.uniforms.backgroundColor.value.copy(vec4);

        const colorimetry = opts.colorimetry;
        this.uniforms.brightnessContrastSaturation.value.set(
            colorimetry.brightness,
            colorimetry.contrast,
            colorimetry.saturation,
        );
    }

    private updateHillshadingUniforms(opts: MaterialOptions): void {
        const params = opts.lighting;

        MaterialUtils.setDefine(this, 'APPLY_SHADING_ON_COLORLAYERS', !params.elevationLayersOnly);

        const uniform = this.uniforms.hillshading.value;

        if (params.mode === MapLightingMode.Hillshade) {
            uniform.zenith = params.hillshadeZenith ?? DEFAULT_ZENITH;
            uniform.azimuth = params.hillshadeAzimuth ?? DEFAULT_AZIMUTH;
            uniform.intensity = params.hillshadeIntensity ?? 1;
        }

        uniform.mode = mapLightingMode(params);
        uniform.zFactor = params.zFactor ?? 1;
    }

    public update(opts?: MaterialOptions): boolean {
        if (opts) {
            this._options = opts;

            this.depthTest = opts.depthTest;

            if (this._colorMapAtlas) {
                this.updateColorMaps();
            }

            this.updateColorUniforms(opts);
            this.updateGraticuleUniforms(opts);
            this.updateContourLineUniforms(opts);
            this.updateHillshadingUniforms(opts);

            if (opts.elevationRange) {
                const { min, max } = opts.elevationRange;
                this.uniforms.elevationRange.value.set(min, max);
            }

            MaterialUtils.setDefine(this, 'ELEVATION_LAYER', this._elevationLayer?.visible);
            MaterialUtils.setDefine(this, 'ENABLE_OUTLINES', opts.showTileOutlines);
            if (opts.showTileOutlines) {
                this.uniforms.tileOutlineColor.value = getColor(opts.tileOutlineColor);
            }
            MaterialUtils.setDefine(this, 'DISCARD_NODATA_ELEVATION', opts.discardNoData);

            MaterialUtils.setDefine(this, 'TERRAIN_DEFORMATION', opts.terrain.enabled);
            MaterialUtils.setDefine(this, 'STITCHING', opts.terrain.stitching);

            const newSide = opts.side;
            if (this.side !== newSide) {
                this.side = newSide;
                this.needsUpdate = true;
            }
        }

        if (this._colorLayers.length === 0) {
            return true;
        }

        return this.rebuildAtlasIfNecessary();
    }

    private updateColorLayerCount(): void {
        // If we have fewer textures than allowed by WebGL max texture units,
        // then we can directly use those textures in the shader.
        // Otherwise we have to reduce the number of color textures by aggregating
        // them in a texture atlas. Note that doing so will have a performance cost,
        // both increasing memory consumption and GPU time, since each color texture
        // must rendered into the atlas.
        const { totalTextureUnits, visibleColorLayers } = this.countIndividualTextures();

        const shouldUseAtlas =
            this._forceTextureAtlas || totalTextureUnits > this._maxTextureImageUnits;
        MaterialUtils.setDefine(this, 'USE_ATLAS_TEXTURE', shouldUseAtlas);

        // If the number of visible layers has changed, we need to repaint the
        // atlas because it only shows visible layers.
        if (MaterialUtils.setDefineValue(this, 'VISIBLE_COLOR_LAYER_COUNT', visibleColorLayers)) {
            this._mustUpdateUniforms = true;
            this._needsAtlasRepaint = true;
            this.needsUpdate = true;
        }
    }

    public override customProgramCacheKey(): string {
        return (this.defines.VISIBLE_COLOR_LAYER_COUNT ?? 0).toString();
    }

    public createComposer(): WebGLComposer {
        const newComposer = new WebGLComposer({
            extent: new Rect(0, this._atlasInfo.maxX, 0, this._atlasInfo.maxY),
            width: this._atlasInfo.maxX,
            height: this._atlasInfo.maxY,
            reuseTexture: true,
            webGLRenderer: this._renderer,
            pixelFormat: RGBAFormat,
            textureDataType: this._composerDataType,
        });
        return newComposer;
    }

    private get composerWidth(): number {
        return this._composer?.width ?? 0;
    }

    private get composerHeight(): number {
        return this._composer?.height ?? 0;
    }

    public rebuildAtlasIfNecessary(): boolean {
        if (
            this._composer == null ||
            this._atlasInfo.maxX > this.composerWidth ||
            this._atlasInfo.maxY > this.composerHeight ||
            this._composer.dataType !== this._composerDataType
        ) {
            const newComposer = this.createComposer();

            let newTexture: Texture | null = null;

            const currentTexture = this._texturesInfo.color.atlasTexture;

            if (this._composer && currentTexture && this.composerWidth > 0) {
                // repaint the old canvas into the new one.
                newComposer.draw(
                    currentTexture,
                    new Rect(0, this.composerWidth, 0, this.composerHeight),
                );
                newTexture = newComposer.render();
            }

            this._composer?.dispose();
            currentTexture?.dispose();
            this._composer = newComposer;
            const atlases = nonNull(this._atlasInfo.atlas);

            for (let i = 0; i < this._colorLayers.length; i++) {
                const layer = this._colorLayers[i];
                const atlas = atlases[layer.id];
                const pitch = this._texturesInfo.color.infos[i].originalOffsetScale;
                const texture = this._texturesInfo.color.infos[i].texture;

                // compute offset / scale
                const w = texture?.image?.width ?? EMPTY_IMAGE_SIZE;
                const h = texture?.image?.height ?? EMPTY_IMAGE_SIZE;
                const xRatio = w / this.composerWidth;
                const yRatio = h / this.composerHeight;
                this._texturesInfo.color.infos[i].offsetScale = new OffsetScale(
                    atlas.x / this.composerWidth + pitch.x * xRatio,
                    (atlas.y + nonNull(atlas.offset)) / this.composerHeight + pitch.y * yRatio,
                    pitch.z * xRatio,
                    pitch.w * yRatio,
                );
            }

            this.rebuildAtlasTexture(newTexture);
        }
        return this.composerWidth > 0;
    }

    private rebuildAtlasTexture(newTexture: Texture | null): void {
        if (newTexture) {
            newTexture.name = 'LayeredMaterial - Atlas';
        }
        this._texturesInfo.color.atlasTexture?.dispose();
        this._texturesInfo.color.atlasTexture = newTexture;
        this.uniforms.atlasTexture.value = this._texturesInfo.color.atlasTexture;
    }

    public changeState(state: RenderingState): void {
        if (this.uniforms.renderingState.value === state) {
            return;
        }

        this.uniforms.renderingState.value = state;
        this.updateOpacityParameters(this.opacity);
        this.updateBlendingMode();

        this.needsUpdate = true;
    }

    private updateBlendingMode(): void {
        const state = this.uniforms.renderingState.value;
        if (state === RenderingState.FINAL) {
            const background = this._options?.backgroundOpacity ?? 1;
            this.transparent = this.opacity < 1 || background < 1;
            this.needsUpdate = true;
            this.blending = NormalBlending;
        } else {
            // We cannot use alpha blending with custom rendering states because the alpha component
            // of the fragment in those modes has nothing to do with transparency at all.
            this.blending = NoBlending;
            this.transparent = false;
            this.needsUpdate = true;
        }
    }

    public hasColorLayer(layer: ColorLayer): boolean {
        return this.indexOfColorLayer(layer) !== -1;
    }

    public hasElevationLayer(layer: ElevationLayer): boolean {
        return this._elevationLayer !== layer;
    }

    public indexOfColorLayer(layer: ColorLayer): number {
        return this._colorLayers.indexOf(layer);
    }

    private updateOpacityParameters(opacity: number): void {
        this.uniforms.opacity.value = opacity;
        this.updateBlendingMode();
    }

    public setLayerOpacity(layer: ColorLayer, opacity: number): void {
        const index = this.indexOfColorLayer(layer);
        this._texturesInfo.color.infos[index].opacity = opacity;
        this._mustUpdateUniforms = true;
    }

    public setLayerVisibility(layer: ColorLayer, visible: boolean): void {
        const index = this.indexOfColorLayer(layer);
        this._texturesInfo.color.infos[index].visible = visible;
        this._mustUpdateUniforms = true;
        this.needsUpdate = true;
        this.reorderLayers();
        this.updateColorLayerCount();
    }

    public setLayerElevationRange(layer: ColorLayer, range: ElevationRange | null): void {
        if (range != null) {
            MaterialUtils.setDefine(this, 'ENABLE_ELEVATION_RANGE', true);
        }
        const index = this.indexOfColorLayer(layer);
        const value = range ? new Vector2(range.min, range.max) : DISABLED_ELEVATION_RANGE;
        this._texturesInfo.color.infos[index].elevationRange = value;
        this._mustUpdateUniforms = true;
    }

    public setColorimetry(
        layer: ColorLayer,
        brightness: number,
        contrast: number,
        saturation: number,
    ): void {
        const index = this.indexOfColorLayer(layer);
        this._texturesInfo.color.infos[index].brightnessContrastSaturation.set(
            brightness,
            contrast,
            saturation,
        );
        this._mustUpdateUniforms = true;
    }

    public getElevationTexture(): Texture | null {
        return this._texturesInfo.elevation.texture;
    }

    public getElevationOffsetScale(): OffsetScale {
        return this._texturesInfo.elevation.offsetScale;
    }

    /** @internal */
    public getElevationLayer(): ElevationLayer | null {
        return this._elevationLayer;
    }

    /**
     * Gets the number of layers on this material.
     *
     * @returns The number of layers present on this material.
     */
    public getLayerCount(): number {
        return (this._elevationLayer ? 1 : 0) + this._colorLayers.length;
    }

    public setUuid(uuid: number): void {
        this.uniforms.uuid.value = uuid;
    }
}

export default LayeredMaterial;
