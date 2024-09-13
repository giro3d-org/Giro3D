import {
    CanvasTexture,
    FloatType,
    GLSL3,
    ShaderMaterial,
    Uniform,
    type AnyPixelFormat,
    type IUniform,
    type Texture,
    type TextureDataType,
} from 'three';

import Interpretation, { Mode, type InterpretationUniform } from '../../core/layer/Interpretation';
import TextureGenerator from '../../utils/TextureGenerator';
import FragmentShader from './ComposerTileFS.glsl';
import VertexShader from './ComposerTileVS.glsl';
// Matches the NoDataOptions struct in the shader
interface NoDataOptions {
    replacementAlpha?: number;
    radius?: number;
    enabled: boolean;
}

export interface Options {
    texture: Texture;
    interpretation: Interpretation;
    flipY: boolean;
    noDataOptions: NoDataOptions;
    showImageOutlines: boolean;
    showEmptyTexture: boolean;
    transparent: boolean;
    expandRGB: boolean;
    convertRGFloatToRGBAUnsignedByte: { precision: number; offset: number } | null;
}

function createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const w = canvas.width;
    const h = canvas.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
        throw new Error('could not acquire 2D rendering context');
    }

    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, w, h);

    ctx.strokeStyle = 'yellow';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    const subdivs = 2;
    const xWidth = w / subdivs;

    for (let i = 1; i < subdivs; i++) {
        const x = i * xWidth;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    const yWidth = h / subdivs;
    for (let i = 1; i < subdivs; i++) {
        const y = i * yWidth;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // Center of the image
    ctx.beginPath();
    ctx.fillStyle = 'yellow';
    ctx.arc(w / 2, h / 2, 4, 0, 2 * Math.PI);
    ctx.fill();

    return new CanvasTexture(canvas);
}

const POOL: unknown[] = [];
const POOL_SIZE = 2048;
let GRID_TEXTURE: Texture;

interface Uniforms {
    tex: IUniform<Texture | null>;
    gridTexture: IUniform<Texture | null>;
    flipY: IUniform<boolean>;
    showImageOutlines: IUniform<boolean>;
    expandRGB: IUniform<boolean>;
    opacity: IUniform<number>;
    channelCount: IUniform<number>;
    showEmptyTexture: IUniform<boolean>;
    isEmptyTexture: IUniform<boolean>;
    noDataOptions: IUniform<NoDataOptions>;
    interpretation: IUniform<InterpretationUniform>;
    convertRGFloatToRGBAUnsignedByte: IUniform<boolean>;
    heightPrecision: IUniform<number>;
    heightOffset: IUniform<number>;
}

class ComposerTileMaterial extends ShaderMaterial {
    readonly isComposerTileMaterial = true as const;
    readonly type = 'ComposerTileMaterial' as const;

    dataType?: TextureDataType;
    pixelFormat?: AnyPixelFormat;

    // @ts-expect-error property is not assignable.
    override readonly uniforms: Uniforms;

    /**
     * Creates an instance of ComposerTileMaterial.
     *
     * @param options - The options
     */
    constructor(options: Options) {
        super({ glslVersion: GLSL3 });

        this.fragmentShader = FragmentShader;
        this.vertexShader = VertexShader;

        this.depthTest = false;

        this.uniforms = {
            tex: new Uniform(null),
            gridTexture: new Uniform(null),
            interpretation: new Uniform({}),
            flipY: new Uniform(false),
            noDataOptions: new Uniform({ enabled: false }),
            showImageOutlines: new Uniform(false),
            opacity: new Uniform(this.opacity),
            channelCount: new Uniform(3),
            expandRGB: new Uniform(options.expandRGB ?? false),
            showEmptyTexture: new Uniform(options.showEmptyTexture ?? false),
            isEmptyTexture: new Uniform(false),
            convertRGFloatToRGBAUnsignedByte: new Uniform(
                options.convertRGFloatToRGBAUnsignedByte != null,
            ),
            heightPrecision: new Uniform(
                options.convertRGFloatToRGBAUnsignedByte?.precision ?? 0.1,
            ),
            heightOffset: new Uniform(options.convertRGFloatToRGBAUnsignedByte?.offset ?? 20000),
        };

        if (options != null) {
            this.init(options);
        }
    }

    private init(options: Options) {
        const interp = options.interpretation ?? Interpretation.Raw;

        this.dataType = interp.mode !== Mode.Raw ? FloatType : options.texture.type;
        this.pixelFormat = options.texture.format;

        const interpValue = {};
        interp.setUniform(interpValue);

        // The no-data filling algorithm does not like transparent images
        this.needsUpdate = this.transparent !== options.transparent;
        this.transparent = options.transparent ?? false;
        this.opacity = 1;
        this.uniforms.opacity.value = this.opacity;
        this.uniforms.interpretation.value = interpValue;
        this.uniforms.tex.value = options.texture;
        this.uniforms.flipY.value = options.flipY ?? false;
        this.uniforms.noDataOptions.value = options.noDataOptions ?? { enabled: false };
        this.uniforms.showImageOutlines.value = options.showImageOutlines ?? false;
        this.uniforms.expandRGB.value = options.expandRGB ?? false;
        this.uniforms.showEmptyTexture.value = options.showEmptyTexture ?? false;
        this.uniforms.isEmptyTexture.value = TextureGenerator.isEmptyTexture(options.texture);
        this.uniforms.convertRGFloatToRGBAUnsignedByte.value =
            options.convertRGFloatToRGBAUnsignedByte != null;
        this.uniforms.heightPrecision.value =
            options.convertRGFloatToRGBAUnsignedByte?.precision ?? 0.1;
        this.uniforms.heightOffset.value = options.convertRGFloatToRGBAUnsignedByte?.offset ?? 0.1;

        const channelCount = TextureGenerator.getChannelCount(this.pixelFormat);
        this.uniforms.channelCount.value = channelCount;
        if (options.showImageOutlines) {
            if (GRID_TEXTURE == null) {
                GRID_TEXTURE = createGridTexture();
            }
            this.uniforms.gridTexture.value = GRID_TEXTURE;
        }
    }

    private reset() {
        this.uniforms.tex.value = null;
    }

    /**
     * Acquires a pooled material.
     *
     * @param opts - The options.
     */
    static acquire(opts: Options) {
        if (POOL.length > 0) {
            const mat = POOL.pop() as ComposerTileMaterial;
            mat.init(opts);
            return mat;
        }
        return new ComposerTileMaterial(opts);
    }

    /**
     * Releases the material back into the pool.
     *
     * @param material - The material.
     */
    static release(material: ComposerTileMaterial) {
        material.reset();
        if (POOL.length < POOL_SIZE) {
            POOL.push(material);
        } else {
            material.dispose();
        }
    }
}

export function isComposerTileMaterial(obj: unknown): obj is ComposerTileMaterial {
    return (obj as ComposerTileMaterial)?.isComposerTileMaterial;
}

export default ComposerTileMaterial;
