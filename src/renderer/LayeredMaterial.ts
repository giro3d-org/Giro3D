import type {
    IUniform,
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
    UnsignedByteType,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import type ColorimetryOptions from '../core/ColorimetryOptions';
import type ColorMapMode from '../core/ColorMapMode';
import type ContourLineOptions from '../core/ContourLineOptions';
import type ElevationRange from '../core/ElevationRange';
import type GraticuleOptions from '../core/GraticuleOptions';
import type HillshadingOptions from '../core/HillshadingOptions';
import type BlendingMode from '../core/layer/BlendingMode';
import type ColorLayer from '../core/layer/ColorLayer';
import type ElevationLayer from '../core/layer/ElevationLayer';
import type Layer from '../core/layer/Layer';
import type { TextureAndPitch } from '../core/layer/Layer';
import type MaskLayer from '../core/layer/MaskLayer';
import type { MaskMode } from '../core/layer/MaskLayer';
import type MemoryUsage from '../core/MemoryUsage';
import { type GetMemoryUsageContext } from '../core/MemoryUsage';
import OffsetScale from '../core/OffsetScale';
import Rect from '../core/Rect';
import type TerrainOptions from '../core/TerrainOptions';
import { getColor } from '../utils/predicates';
import TextureGenerator from '../utils/TextureGenerator';
import { nonNull } from '../utils/tsutils';
import type { AtlasInfo, LayerAtlasInfo } from './AtlasBuilder';
import type ColorMapAtlas from './ColorMapAtlas';
import WebGLComposer from './composition/WebGLComposer';
import EmptyTexture from './EmptyTexture';
import MaterialUtils from './MaterialUtils';
import MemoryTracker from './MemoryTracker';
import RenderingState from './RenderingState';
import TileFS from './shader/TileFS.glsl';
import TileVS from './shader/TileVS.glsl';

const EMPTY_IMAGE_SIZE = 16;

interface ElevationTexture extends Texture {
    /**
     * Flag to determine if the texture is borrowed from
     * an ancestor of it is the final texture of this material.
     */
    isFinal: boolean;
}

const emptyTexture = new EmptyTexture();

const COLORMAP_DISABLED = 0;

const DISABLED_ELEVATION_RANGE = new Vector2(-999999, 999999);

class TextureInfo {
    readonly layer: ColorLayer;

    originalOffsetScale: OffsetScale;
    offsetScale: OffsetScale;
    texture: Texture;
    opacity: number;
    visible: boolean;
    color: Color;
    elevationRange?: Vector2;
    brightnessContrastSaturation: Vector3;

    constructor(layer: ColorLayer) {
        this.layer = layer;
        this.opacity = layer.opacity;
        this.visible = layer.visible;
        this.offsetScale = new OffsetScale(0, 0, 0, 0);
        this.originalOffsetScale = new OffsetScale(0, 0, 0, 0);
        this.texture = emptyTexture;
        this.color = new Color(1, 1, 1);
        this.brightnessContrastSaturation = new Vector3(0, 1, 1);
    }

    get mode() {
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

function drawImageOnAtlas(
    width: number,
    height: number,
    composer: WebGLComposer,
    atlasInfo: LayerAtlasInfo,
    texture: Texture,
) {
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
) {
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
     * Hillshading options.
     */
    hillshading: Required<HillshadingOptions>;
    /**
     * Graticule options.
     */
    graticule: Required<GraticuleOptions>;
    /**
     * The number of subdivision segments per tile.
     */
    segments: number;
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
    depthTest: boolean;
}

type HillshadingUniform = {
    intensity: number;
    zFactor: number;
    zenith: number;
    azimuth: number;
};

type ContourLineUniform = {
    thickness: number;
    primaryInterval: number;
    secondaryInterval: number;
    color: Vector4;
};

type GraticuleUniform = {
    thickness: number;
    /** xOffset, yOffset, xStep, yStep */
    position: Vector4;
    color: Vector4;
};

type LayerUniform = {
    offsetScale: Vector4;
    color: Vector4;
    textureSize: Vector2;
    elevationRange: Vector2;
    brightnessContrastSaturation: Vector3;
};

type ColorLayerUniform = LayerUniform & {
    mode: 0 | MaskMode;
    blendingMode: BlendingMode;
};

type NeighbourUniform = {
    offsetScale: Vector4 | null;
    diffLevel: number;
};

type ColorMapUniform = {
    mode: ColorMapMode | 0;
    min: number;
    max: number;
    offset: number;
};

type Defines = {
    ENABLE_CONTOUR_LINES?: 1;
    STITCHING?: 1;
    TERRAIN_DEFORMATION?: 1;
    DISCARD_NODATA_ELEVATION?: 1;
    ENABLE_ELEVATION_RANGE?: 1;
    ELEVATION_LAYER?: 1;
    ENABLE_LAYER_MASKS?: 1;
    ENABLE_OUTLINES?: 1;
    ENABLE_HILLSHADING?: 1;
    APPLY_SHADING_ON_COLORLAYERS?: 1;
    ENABLE_GRATICULE?: 1;
    USE_ATLAS_TEXTURE?: 1;
    /** The number of _visible_ color layers */
    VISIBLE_COLOR_LAYER_COUNT: number;
};

interface Uniforms {
    opacity: IUniform<number>;
    segments: IUniform<number>;
    tileOutlineColor: IUniform<Color>;
    contourLines: IUniform<ContourLineUniform>;
    graticule: IUniform<GraticuleUniform>;
    hillshading: IUniform<HillshadingUniform>;
    elevationRange: IUniform<Vector2>;
    tileDimensions: IUniform<Vector2>;
    elevationTexture: IUniform<Texture | null>;
    atlasTexture: IUniform<Texture | null>;
    colorTextures: IUniform<Texture[]>;
    uuid: IUniform<number>;
    backgroundColor: IUniform<Vector4>;
    layers: IUniform<ColorLayerUniform[]>;
    elevationLayer: IUniform<LayerUniform>;
    brightnessContrastSaturation: IUniform<Vector3>;
    renderingState: IUniform<RenderingState>;
    neighbours: IUniform<NeighbourUniform[]>;
    neighbourTextures: IUniform<(Texture | null)[]>;
    colorMapAtlas: IUniform<Texture | null>;
    layersColorMaps: IUniform<ColorMapUniform[]>;
    elevationColorMap: IUniform<ColorMapUniform>;

    fogDensity: IUniform<number>;
    fogNear: IUniform<number>;
    fogFar: IUniform<number>;
    fogColor: IUniform<Color>;
}

class LayeredMaterial extends ShaderMaterial implements MemoryUsage {
    readonly isMemoryUsage = true as const;
    private readonly _getIndexFn: (arg0: Layer) => number;
    private readonly _renderer: WebGLRenderer;
    private readonly _colorLayers: ColorLayer[] = [];
    private readonly _atlasInfo: AtlasInfo;
    private readonly _forceTextureAtlas: boolean;
    private readonly _maxTextureImageUnits: number;
    private readonly _texturesInfo: {
        color: {
            infos: TextureInfo[];
            atlasTexture: Texture | null;
        };
        elevation: {
            offsetScale: OffsetScale;
            texture: ElevationTexture | null;
        };
    };

    private _elevationLayer: ElevationLayer | null = null;
    private _mustUpdateUniforms = true;
    private _needsSorting = true;
    private _needsAtlasRepaint = false;
    private _composer: WebGLComposer | null = null;
    private _colorMapAtlas: ColorMapAtlas | null = null;
    private _composerDataType: TextureDataType = UnsignedByteType;

    // @ts-expect-error property is not assignable.
    override readonly uniforms: Uniforms;

    override readonly defines: Defines = {
        VISIBLE_COLOR_LAYER_COUNT: 0,
    };

    private _options?: MaterialOptions;
    private _hasElevationLayer = false;

    getMemoryUsage(context: GetMemoryUsageContext) {
        // We only consider textures that this material owns. That excludes layer textures.
        const atlas = this._texturesInfo.color.atlasTexture;
        if (atlas) {
            TextureGenerator.getMemoryUsage(context, atlas);
        }
    }

    constructor(params: {
        /** the material options. */
        options: MaterialOptions;
        /** the WebGL renderer. */
        renderer: WebGLRenderer;
        /** The number of maximum texture units in fragment shaders */
        maxTextureImageUnits: number;
        /**  the Atlas info */
        atlasInfo: AtlasInfo;
        /** The function to help sorting color layers. */
        getIndexFn: (arg0: Layer) => number;
        /** The texture data type to be used for the atlas texture. */
        textureDataType: TextureDataType;
        hasElevationLayer: boolean;
    }) {
        super({ clipping: true, glslVersion: GLSL3 });

        this._atlasInfo = params.atlasInfo;
        this.fog = true;
        this._maxTextureImageUnits = params.maxTextureImageUnits;
        this._getIndexFn = params.getIndexFn;

        const options = params.options;

        MaterialUtils.setDefine(this, 'USE_ATLAS_TEXTURE', false);
        MaterialUtils.setDefine(this, 'STITCHING', options.terrain.stitching);
        MaterialUtils.setDefine(this, 'TERRAIN_DEFORMATION', options.terrain.enabled);
        MaterialUtils.setDefine(this, 'DISCARD_NODATA_ELEVATION', options.discardNoData);
        MaterialUtils.setDefine(this, 'ENABLE_ELEVATION_RANGE', options.elevationRange != null);
        MaterialUtils.setDefineValue(this, 'VISIBLE_COLOR_LAYER_COUNT', 0);

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
        this._renderer = params.renderer;
        this._forceTextureAtlas = options.forceTextureAtlases ?? false;
        this._hasElevationLayer = params.hasElevationLayer;
        this._composerDataType = params.textureDataType;
        this._colorMapAtlas = options.colorMapAtlas ?? null;

        const elevationRange = options.elevationRange
            ? new Vector2(options.elevationRange.min, options.elevationRange.max)
            : DISABLED_ELEVATION_RANGE;

        const elevInfo = this._texturesInfo.elevation;

        this.uniforms = {
            hillshading: new Uniform<HillshadingUniform>({
                zenith: DEFAULT_ZENITH,
                azimuth: DEFAULT_AZIMUTH,
                intensity: DEFAULT_HILLSHADING_INTENSITY,
                zFactor: DEFAULT_HILLSHADING_ZFACTOR,
            }),

            tileOutlineColor: new Uniform(new Color(DEFAULT_OUTLINE_COLOR)),

            fogDensity: new Uniform(0.00025),
            fogNear: new Uniform(1),
            fogFar: new Uniform(2000),
            fogColor: new Uniform(new Color(0xffffff)),

            segments: new Uniform(options.segments ?? 8),

            contourLines: new Uniform({
                thickness: 1,
                primaryInterval: 100,
                secondaryInterval: 20,
                color: new Vector4(0, 0, 0, 1),
            }),

            graticule: new Uniform<GraticuleUniform>({
                color: new Vector4(0, 0, 0, 1),
                thickness: DEFAULT_GRATICULE_THICKNESS,
                position: new Vector4(0, 0, DEFAULT_GRATICULE_STEP, DEFAULT_GRATICULE_STEP),
            }),

            elevationRange: new Uniform(elevationRange),

            renderingState: new Uniform(RenderingState.FINAL),

            tileDimensions: new Uniform(new Vector2()),
            brightnessContrastSaturation: new Uniform(new Vector3(0, 1, 1)),
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

            // Elevation texture
            elevationTexture: new Uniform(elevInfo.texture),
            elevationLayer: new Uniform<LayerUniform>({
                brightnessContrastSaturation: new Vector3(0, 1, 1),
                color: new Vector4(0, 0, 0, 0),
                elevationRange: new Vector2(0, 0),
                offsetScale: new OffsetScale(0, 0, 0, 0),
                textureSize: new Vector2(0, 0),
            }),

            // Color textures's layer
            atlasTexture: new Uniform(this._texturesInfo.color.atlasTexture),

            colorTextures: new Uniform([]),

            // Describe the properties of each color layer (offsetScale, color...).
            layers: new Uniform([]),
            layersColorMaps: new Uniform([]),
            colorMapAtlas: new Uniform(null),

            elevationColorMap: new Uniform<ColorMapUniform>({
                mode: 0,
                offset: 0,
                max: 0,
                min: 0,
            }),

            uuid: new Uniform(0),

            backgroundColor: new Uniform(new Vector4()),
            opacity: new Uniform(1.0),
        };

        this.uniformsNeedUpdate = true;

        this.update(options);

        MemoryTracker.track(this, 'LayeredMaterial');
    }

    /**
     * @param v - The number of segments.
     */
    set segments(v: number) {
        this.uniforms.segments.value = v;
    }

    updateNeighbour(
        neighbour: number,
        diffLevel: number,
        offsetScale: OffsetScale,
        texture: Texture | null,
    ): void {
        this.uniforms.neighbours.value[neighbour].diffLevel = diffLevel;
        this.uniforms.neighbours.value[neighbour].offsetScale = offsetScale;
        this.uniforms.neighbourTextures.value[neighbour] = texture;
    }

    onBeforeCompile(parameters: WebGLProgramParametersWithUniforms): void {
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

    private updateColorLayerUniforms() {
        const useAtlas = this.defines.USE_ATLAS_TEXTURE === 1;

        this.sortLayersIfNecessary();

        if (this._mustUpdateUniforms) {
            const layersUniform: ColorLayerUniform[] = [];
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

                const uniform: ColorLayerUniform = {
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

    dispose() {
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

    getColorTexture(layer: ColorLayer) {
        const index = this.indexOfColorLayer(layer);

        if (index === -1) {
            return null;
        }
        return this._texturesInfo.color.infos[index].texture;
    }

    private countIndividualTextures() {
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

    onBeforeRender() {
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
    private updateColorWrite() {
        if (this._texturesInfo.elevation.texture == null && this.defines.DISCARD_NODATA_ELEVATION) {
            // No elevation texture means that every single fragment will be discarded,
            // which is an illegal operation in WebGL (raising warnings).
            this.colorWrite = false;
        } else {
            this.colorWrite = true;
        }
    }

    repaintAtlas() {
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

    setColorTextures(layer: ColorLayer, textureAndPitch: TextureAndPitch) {
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

    pushElevationLayer(layer: ElevationLayer) {
        this._elevationLayer = layer;
        this._hasElevationLayer = true;
    }

    removeElevationLayer() {
        this._elevationLayer = null;
        this.uniforms.elevationTexture.value = null;
        this._texturesInfo.elevation.texture = null;
        this._hasElevationLayer = false;
        MaterialUtils.setDefine(this, 'ELEVATION_LAYER', false);
    }

    setElevationTexture(
        layer: ElevationLayer,
        { texture, pitch }: { texture: Texture; pitch: OffsetScale },
        isFinal: boolean,
    ) {
        this._elevationLayer = layer;

        MaterialUtils.setDefine(this, 'ELEVATION_LAYER', true);

        this.uniforms.elevationTexture.value = texture;
        this._texturesInfo.elevation.texture = texture as ElevationTexture;
        (texture as ElevationTexture).isFinal = isFinal;
        this._texturesInfo.elevation.offsetScale.copy(pitch);

        const uniform = this.uniforms.elevationLayer.value;
        uniform.offsetScale = pitch;
        uniform.textureSize = new Vector2(texture.image.width, texture.image.height);
        uniform.color = new Vector4(1, 1, 1, 1);
        uniform.brightnessContrastSaturation = new Vector3(1, 1, 1);
        uniform.elevationRange = new Vector2();

        this.updateColorMaps();

        return Promise.resolve(true);
    }

    pushColorLayer(newLayer: ColorLayer) {
        if (this._colorLayers.includes(newLayer)) {
            return;
        }
        this._colorLayers.push(newLayer);

        const info = new TextureInfo(newLayer);

        if (newLayer.type === 'MaskLayer') {
            MaterialUtils.setDefine(this, 'ENABLE_LAYER_MASKS', true);
        }

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

    private getVisibleColorLayerCount() {
        let result = 0;
        for (let i = 0; i < this._colorLayers.length; i++) {
            const layer = this._colorLayers[i];
            if (layer.visible) {
                result++;
            }
        }
        return result;
    }

    reorderLayers() {
        this._needsSorting = true;
    }

    private sortLayersIfNecessary() {
        const idx = this._getIndexFn;
        if (this._needsSorting) {
            this._colorLayers.sort((a, b) => idx(a) - idx(b));
            this._texturesInfo.color.infos.sort((a, b) => idx(a.layer) - idx(b.layer));
            this._needsSorting = false;
        }
    }

    removeColorLayer(layer: ColorLayer) {
        const index = this.indexOfColorLayer(layer);
        if (index === -1) {
            return;
        }
        // NOTE: we cannot dispose the texture here, because it might be cached for later.
        this._texturesInfo.color.infos.splice(index, 1);
        this._colorLayers.splice(index, 1);

        this.updateColorMaps();

        this.updateColorLayerCount();
    }

    /**
     * Sets the colormap atlas.
     *
     * @param atlas - The atlas.
     */
    setColorMapAtlas(atlas: ColorMapAtlas | null) {
        this._colorMapAtlas = atlas;
    }

    private updateColorMaps() {
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

    update(materialOptions?: MaterialOptions) {
        if (materialOptions) {
            this._options = materialOptions;

            this.depthTest = materialOptions.depthTest;

            if (this._colorMapAtlas) {
                this.updateColorMaps();
            }

            // Background
            const a = materialOptions.backgroundOpacity;
            const c = materialOptions.backgroundColor;
            const vec4 = new Vector4(c.r, c.g, c.b, a);
            this.uniforms.backgroundColor.value.copy(vec4);

            // Graticule
            const options = materialOptions.graticule;
            const enabled = options.enabled ?? false;
            MaterialUtils.setDefine(this, 'ENABLE_GRATICULE', enabled);
            if (enabled) {
                const uniform = this.uniforms.graticule.value;
                uniform.thickness = options.thickness;
                uniform.position.set(
                    options.xOffset,
                    options.yOffset,
                    options.xStep,
                    options.yStep,
                );
                const rgb = getColor(options.color);
                uniform.color.set(rgb.r, rgb.g, rgb.b, options.opacity ?? 0);
            }

            // Colorimetry
            const opts = materialOptions.colorimetry;
            this.uniforms.brightnessContrastSaturation.value.set(
                opts.brightness,
                opts.contrast,
                opts.saturation,
            );

            // Contour lines
            const contourLines = materialOptions.contourLines;
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

            if (materialOptions.elevationRange) {
                const { min, max } = materialOptions.elevationRange;
                this.uniforms.elevationRange.value.set(min, max);
            }

            MaterialUtils.setDefine(this, 'ELEVATION_LAYER', this._elevationLayer?.visible);
            MaterialUtils.setDefine(this, 'ENABLE_OUTLINES', materialOptions.showTileOutlines);
            if (materialOptions.showTileOutlines) {
                this.uniforms.tileOutlineColor.value = getColor(materialOptions.tileOutlineColor);
            }
            MaterialUtils.setDefine(
                this,
                'DISCARD_NODATA_ELEVATION',
                materialOptions.discardNoData,
            );

            MaterialUtils.setDefine(this, 'TERRAIN_DEFORMATION', materialOptions.terrain.enabled);
            MaterialUtils.setDefine(this, 'STITCHING', materialOptions.terrain.stitching);

            const hillshadingParams = materialOptions.hillshading;
            const uniform = this.uniforms.hillshading.value;
            uniform.zenith = hillshadingParams.zenith ?? DEFAULT_ZENITH;
            uniform.azimuth = hillshadingParams.azimuth ?? DEFAULT_AZIMUTH;
            uniform.intensity = hillshadingParams.intensity ?? 1;
            uniform.zFactor = hillshadingParams.zFactor ?? 1;
            MaterialUtils.setDefine(this, 'ENABLE_HILLSHADING', hillshadingParams.enabled);
            MaterialUtils.setDefine(
                this,
                'APPLY_SHADING_ON_COLORLAYERS',
                !hillshadingParams.elevationLayersOnly,
            );

            const newSide = materialOptions.side;
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

    private updateColorLayerCount() {
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

    customProgramCacheKey(): string {
        return (this.defines.VISIBLE_COLOR_LAYER_COUNT ?? 0).toString();
    }

    createComposer() {
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

    private get composerWidth() {
        return this._composer?.width ?? 0;
    }

    private get composerHeight() {
        return this._composer?.height ?? 0;
    }

    rebuildAtlasIfNecessary() {
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

    private rebuildAtlasTexture(newTexture: Texture | null) {
        if (newTexture) {
            newTexture.name = 'LayeredMaterial - Atlas';
        }
        this._texturesInfo.color.atlasTexture?.dispose();
        this._texturesInfo.color.atlasTexture = newTexture;
        this.uniforms.atlasTexture.value = this._texturesInfo.color.atlasTexture;
    }

    changeState(state: RenderingState) {
        if (this.uniforms.renderingState.value === state) {
            return;
        }

        this.uniforms.renderingState.value = state;
        this.updateOpacityParameters(this.opacity);
        this.updateBlendingMode();

        this.needsUpdate = true;
    }

    private updateBlendingMode() {
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

    hasColorLayer(layer: ColorLayer) {
        return this.indexOfColorLayer(layer) !== -1;
    }

    hasElevationLayer(layer: ElevationLayer) {
        return this._elevationLayer !== layer;
    }

    indexOfColorLayer(layer: ColorLayer) {
        return this._colorLayers.indexOf(layer);
    }

    private updateOpacityParameters(opacity: number) {
        this.uniforms.opacity.value = opacity;
        this.updateBlendingMode();
    }

    setLayerOpacity(layer: ColorLayer, opacity: number) {
        const index = this.indexOfColorLayer(layer);
        this._texturesInfo.color.infos[index].opacity = opacity;
        this._mustUpdateUniforms = true;
    }

    setLayerVisibility(layer: ColorLayer, visible: boolean) {
        const index = this.indexOfColorLayer(layer);
        this._texturesInfo.color.infos[index].visible = visible;
        this._mustUpdateUniforms = true;
        this.needsUpdate = true;
        this.reorderLayers();
        this.updateColorLayerCount();
    }

    setLayerElevationRange(layer: ColorLayer, range: ElevationRange | null) {
        if (range != null) {
            MaterialUtils.setDefine(this, 'ENABLE_ELEVATION_RANGE', true);
        }
        const index = this.indexOfColorLayer(layer);
        const value = range ? new Vector2(range.min, range.max) : DISABLED_ELEVATION_RANGE;
        this._texturesInfo.color.infos[index].elevationRange = value;
        this._mustUpdateUniforms = true;
    }

    setColorimetry(layer: ColorLayer, brightness: number, contrast: number, saturation: number) {
        const index = this.indexOfColorLayer(layer);
        this._texturesInfo.color.infos[index].brightnessContrastSaturation.set(
            brightness,
            contrast,
            saturation,
        );
    }

    canProcessColorLayer(): boolean {
        if (!this._elevationLayer) {
            return true;
        }
        if (!this._elevationLayer.visible) {
            return true;
        }
        return this.isElevationLayerTextureLoaded();
    }

    isElevationLayerTextureLoaded() {
        if (!this._hasElevationLayer) {
            return true;
        }
        const texture = this._texturesInfo.elevation.texture;
        return texture != null && texture.isFinal === true;
    }

    getElevationTexture(): Texture | null {
        return this._texturesInfo.elevation.texture;
    }

    getElevationOffsetScale(): OffsetScale {
        return this._texturesInfo.elevation.offsetScale;
    }

    isColorLayerTextureLoaded(layer: ColorLayer) {
        const index = this.indexOfColorLayer(layer);
        if (index < 0) {
            return false;
        }
        return this._texturesInfo.color.infos[index].texture !== emptyTexture;
    }

    /**
     * Gets the number of layers on this material.
     *
     * @returns The number of layers present on this material.
     */
    getLayerCount() {
        return (this._elevationLayer ? 1 : 0) + this._colorLayers.length;
    }

    /**
     * Gets the progress of the loading of textures on this material.
     * The progress is the number of currently present textures divided
     * by the number of expected textures.
     */
    get progress() {
        let total = 0;
        let weight = 0;
        if (this._elevationLayer != null) {
            if (this.isElevationLayerTextureLoaded()) {
                total += 1;
            }
            weight += 1;
        }

        for (const layer of this._colorLayers) {
            if (this.isColorLayerTextureLoaded(layer)) {
                total += 1;
            }
            weight += 1;
        }

        if (weight === 0) {
            // No layer present
            return 1;
        }

        return total / weight;
    }

    get loading() {
        return this.progress < 1;
    }

    setUuid(uuid: number) {
        this.uniforms.uuid.value = uuid;
    }
}

export default LayeredMaterial;
