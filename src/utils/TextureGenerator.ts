import type { WebGLRenderTarget } from 'three';
import {
    AlphaFormat,
    ByteType,
    ClampToEdgeWrapping,
    DataTexture,
    DepthFormat,
    DepthStencilFormat,
    FloatType,
    HalfFloatType,
    IntType,
    LinearFilter,
    LuminanceAlphaFormat,
    LuminanceFormat,
    MathUtils,
    NearestFilter,
    RedFormat,
    RedIntegerFormat,
    RGBAFormat,
    RGBAIntegerFormat,
    RGFormat,
    RGIntegerFormat,
    ShortType,
    Texture,
    UnsignedByteType,
    UnsignedInt248Type,
    UnsignedIntType,
    UnsignedShort4444Type,
    UnsignedShort5551Type,
    UnsignedShortType,
    type AnyPixelFormat,
    type CanvasTexture,
    type Color,
    type MagnificationTextureFilter,
    type MinificationTextureFilter,
    type PixelFormat,
    type RenderTarget,
    type TextureDataType,
    type TypedArray,
    type WebGLRenderer,
} from 'three';
import Interpretation, { Mode } from '../core/layer/Interpretation';
import { type GetMemoryUsageContext, type MemoryUsageReport } from '../core/MemoryUsage';
import Capabilities from '../core/system/Capabilities';
import EmptyTexture from '../renderer/EmptyTexture';
import type * as decoder from './imageDecoderWorker';
import {
    createPixelBuffer,
    createTypedArrayFromBuffer,
    getTypedArrayType,
} from './imageDecoderWorker';
import WorkerPool from './WorkerPool';

export const OPAQUE_BYTE = 255;
export const OPAQUE_FLOAT = 1.0;
export const TRANSPARENT = 0;
export const DEFAULT_NODATA = 0;

function isTexture(obj: unknown): obj is Texture {
    return (obj as Texture)?.isTexture;
}

function isRenderTarget(obj: unknown): obj is RenderTarget {
    return (obj as RenderTarget)?.isRenderTarget;
}

function isDataTexture(texture: Texture): texture is DataTexture {
    return (texture as DataTexture).isDataTexture;
}

function isCanvasTexture(texture: Texture): texture is CanvasTexture {
    return (texture as CanvasTexture).isCanvasTexture;
}

/**
 * Returns the number of bytes per channel.
 *
 * @param dataType - The pixel format.
 * @returns The number of bytes per channel.
 */
function getBytesPerChannel(dataType: TextureDataType): number {
    switch (dataType) {
        case UnsignedByteType:
        case ByteType:
            return 1;
        case ShortType:
        case UnsignedShortType:
        case UnsignedShort4444Type:
        case UnsignedShort5551Type:
            return 2;
        case IntType:
        case UnsignedIntType:
        case UnsignedInt248Type:
        case FloatType:
            return 4;
        case HalfFloatType:
            return 2;
        default:
            throw new Error(`unknown data type: ${dataType}`);
    }
}

function getDataTypeString(dataType: TextureDataType): string {
    switch (dataType) {
        case UnsignedByteType:
            return 'UnsignedByteType';
        case ByteType:
            return 'ByteType';
        case ShortType:
            return 'ShortType';
        case UnsignedShortType:
            return 'UnsignedShortType';
        case UnsignedShort4444Type:
            return 'UnsignedShort4444Type';
        case UnsignedShort5551Type:
            return 'UnsignedShort5551Type';
        case IntType:
            return 'IntType';
        case UnsignedIntType:
            return 'UnsignedIntType';
        case UnsignedInt248Type:
            return 'UnsignedInt248Type';
        case FloatType:
            return 'FloatType';
        case HalfFloatType:
            return 'HalfFloatType';
        default:
            throw new Error(`unknown data type: ${dataType}`);
    }
}

/**
 * Returns the number of channels per pixel.
 *
 * @param pixelFormat - The pixel format.
 * @returns The number of channels per pixel.
 */
function getChannelCount(pixelFormat: AnyPixelFormat): number {
    switch (pixelFormat) {
        case AlphaFormat:
            return 1;
        case RGBAFormat:
            return 4;
        case LuminanceFormat:
            return 1;
        case LuminanceAlphaFormat:
            return 2;
        case DepthFormat:
            return 1;
        case DepthStencilFormat:
            return 1;
        case RedFormat:
            return 1;
        case RedIntegerFormat:
            return 1;
        case RGFormat:
            return 2;
        case RGIntegerFormat:
            return 2;
        case RGBAIntegerFormat:
            return 4;
        default:
            throw new Error(`invalid pixel format: ${pixelFormat}`);
    }
}

/**
 * Estimate the size of the texture.
 *
 * @param texture - The texture.
 * @returns The size, in bytes.
 */
function estimateSize(texture: Texture): number {
    // Note: this estimation is very broad for several reasons
    // - It does not know if this texture is GPU-memory only or if there is a copy in CPU-memory
    // - It does not know any possible optimization done by the GPU
    const channels = getChannelCount(texture.format);
    const bpp = getBytesPerChannel(texture.type);

    return texture.image.width * texture.image.height * channels * bpp;
}

/**
 * Reads back the render target buffer into CPU memory, then attach this buffer to the `data`
 * property of the render target's texture.
 *
 * This is useful because normally the pixels of a render target are not readable.
 *
 * @param target - The render target to read back.
 * @param renderer - The WebGL renderer to perform the operation.
 */
function createDataCopy(target: WebGLRenderTarget, renderer: WebGLRenderer) {
    // Render target textures don't have data in CPU memory,
    // we need to transfer their data into a buffer.
    const bufSize = target.width * target.height * getChannelCount(target.texture.format);
    const buf =
        target.texture.type === UnsignedByteType
            ? new Uint8Array(bufSize)
            : new Float32Array(bufSize);
    renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, buf);
    (target.texture as Texture & { data: TypedArray }).data = buf;
}

/**
 * Gets the underlying pixel buffer of the image.
 *
 * @param image - The image.
 * @returns The pixel buffer.
 */
function getPixels(image: ImageBitmap | HTMLImageElement | HTMLCanvasElement): Uint8ClampedArray {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
        throw new Error('could not acquire 2D context on canvas');
    }

    context.drawImage(image, 0, 0);

    return context.getImageData(0, 0, image.width, image.height).data;
}

let decoderWorkerPool: WorkerPool<decoder.MessageType, decoder.MessageMap> | null = null;

function getDecoderPool(): NonNullable<typeof decoderWorkerPool> {
    if (decoderWorkerPool == null) {
        const createWorker = () =>
            new Worker(new URL('./imageDecoderWorker.js', import.meta.url), {
                type: 'module',
            });
        decoderWorkerPool = new WorkerPool({ createWorker, concurrency: 2 });
    }
    return decoderWorkerPool;
}

async function createImageBitmapUsingWorker(
    blob: Blob,
    options?: ImageBitmapOptions,
): Promise<ImageBitmap> {
    if (window.Worker != null) {
        const pool = getDecoderPool();

        const buffer = await blob.arrayBuffer();
        const img = await pool.queue(
            'CreateImageBitmap',
            {
                buffer,
                options,
            },
            [buffer],
        );

        return img;
    } else {
        // Fallback to main-thread decoding
        return createImageBitmap(blob, options);
    }
}

/**
 * Decodes the blob according to its media type, then returns a texture for this blob.
 *
 * @param blob - The buffer to decode.
 * @param options - Options
 * @returns The generated texture.
 * @throws When the media type is unsupported or when the image dimensions are greater than the
 * maximum texture size.
 */
async function decodeBlob(
    blob: Blob,
    options: {
        /** If true, the texture will be a data texture. */
        createDataTexture?: boolean;
        /** Should the image be flipped vertically ? */
        flipY?: boolean;
        /**
         * Enable web workers.
         * @defaultValue true
         */
        enableWorkers?: boolean;
    } = {},
): Promise<Texture> {
    // media types are in the form 'type;args', for example: 'text/html; charset=UTF-8;
    const [type] = blob.type.split(';');

    switch (type) {
        case 'image/webp':
        case 'image/png':
        case 'image/jpg': // not a valid media type, but we support it for compatibility
        case 'image/jpeg': {
            const enableWorker = options?.enableWorkers ?? true;
            let img: ImageBitmap;
            const decodeOptions: ImageBitmapOptions = {
                imageOrientation: options.flipY === true ? 'flipY' : 'none',
            };
            if (enableWorker) {
                img = await createImageBitmapUsingWorker(blob, decodeOptions);
            } else {
                img = await createImageBitmap(blob, decodeOptions);
            }

            let tex;

            const max = Capabilities.getMaxTextureSize();

            if (img.width > max || img.height > max) {
                throw new Error(
                    `image dimensions (${img.width} * ${img.height} pixels) exceed max texture size (${max} pixels)`,
                );
            }

            if (options.createDataTexture === true) {
                const buf = getPixels(img);
                tex = new DataTexture(buf, img.width, img.height, RGBAFormat, UnsignedByteType);
            } else {
                tex = new Texture(img);
            }
            tex.wrapS = ClampToEdgeWrapping;
            tex.wrapT = ClampToEdgeWrapping;
            tex.minFilter = LinearFilter;
            tex.magFilter = LinearFilter;
            tex.generateMipmaps = false;
            tex.needsUpdate = true;
            return tex;
        }
        default:
            throw new Error(`unsupported media type for textures: ${blob.type}`);
    }
}

export type CreateDataTextureResult = {
    texture: DataTexture | Texture;
    min: number;
    max: number;
};

function createTextureFromPixelBuffer(
    result: decoder.CreatePixelBufferResult,
    width: number,
    height: number,
    format: PixelFormat,
    type: TextureDataType,
) {
    const texture = result.isTransparent
        ? new EmptyTexture()
        : new DataTexture(
              createTypedArrayFromBuffer(result.buffer, type),
              width,
              height,
              format,
              type,
          );

    if (!isEmptyTexture(texture)) {
        texture.needsUpdate = true;
        texture.generateMipmaps = false;
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;
    }

    return {
        texture,
        min: result.min,
        max: result.max,
    };
}

function getPixelFormat(channelCount: number): PixelFormat {
    switch (channelCount) {
        case 1:
        case 2:
            return RGFormat;
        default:
            return RGBAFormat;
    }
}

function getCreatePixelBufferOptions(
    options: {
        width: number;
        height: number;
        type: TextureDataType;
        nodata: number | undefined;
        makeCopyOfBuffers: boolean;
    },
    ...pixelData: TypedArray[]
): decoder.CreatePixelBufferOptions {
    const { width, height, type, nodata } = options;
    const pixelCount = width * height;

    const targetDataType = type;

    let channelCount: number;
    switch (pixelData.length) {
        case 1:
        case 2:
            channelCount = 2;
            break;
        default:
            channelCount = 4;
            break;
    }

    let opaqueValue: number;

    switch (targetDataType) {
        case FloatType:
            opaqueValue = OPAQUE_FLOAT;
            break;
        default:
            opaqueValue = OPAQUE_BYTE;
            break;
    }

    return {
        bufferSize: pixelCount * channelCount,
        inputType: getTypedArrayType(pixelData[0]), // Assume all arrays have the same type
        dataType: targetDataType,
        input: pixelData.map(p => (options.makeCopyOfBuffers ? p.buffer.slice(0) : p.buffer)),
        opaqueValue,
        nodata,
    };
}

/**
 * Returns a {@link DataTexture} initialized with the specified data.
 *
 * @param options - The creation options.
 * @param sourceDataType - The data type of the input pixel data.
 * @param pixelData - The pixel data
 * for each input channels. Must be either one, three, or four channels.
 */
function createDataTexture(
    options: {
        /** The texture width */
        width: number;
        /** The texture height */
        height: number;
        /**
         * The no-data value. If specified, if a pixel has this value,
         * then the alpha value will be transparent. Otherwise it will be opaque.
         * If unspecified, the alpha will be opaque. This only applies to 1-channel data.
         * Ignored for 3 and 4-channel data.
         */
        nodata?: number;
    },
    sourceDataType: TextureDataType,
    ...pixelData: TypedArray[]
): CreateDataTextureResult {
    const pixelBufferOptions = getCreatePixelBufferOptions(
        {
            width: options.width,
            height: options.height,
            type: sourceDataType,
            nodata: options.nodata,
            makeCopyOfBuffers: false,
        },
        ...pixelData,
    );

    const result = createPixelBuffer(pixelBufferOptions);

    const format = getPixelFormat(pixelData.length);

    return createTextureFromPixelBuffer(
        result,
        options.width,
        options.height,
        format,
        pixelBufferOptions.dataType,
    );
}

/**
 * Returns a {@link DataTexture} initialized with the specified data.
 *
 * @param options - The creation options.
 * @param sourceDataType - The data type of the input pixel data.
 * @param pixelData - The pixel data
 * for each input channels. Must be either one, three, or four channels.
 */
async function createDataTextureAsync(
    options: {
        /** The texture width */
        width: number;
        /** The texture height */
        height: number;
        /**
         * The no-data value. If specified, if a pixel has this value,
         * then the alpha value will be transparent. Otherwise it will be opaque.
         * If unspecified, the alpha will be opaque. This only applies to 1-channel data.
         * Ignored for 3 and 4-channel data.
         */
        nodata?: number;
        /**
         * Enable processing in workers.
         * @defaultValue true
         */
        enableWorkers?: boolean;
    },
    sourceDataType: TextureDataType,
    ...pixelData: TypedArray[]
): Promise<CreateDataTextureResult> {
    const pixelBufferOptions = getCreatePixelBufferOptions(
        {
            width: options.width,
            height: options.height,
            type: sourceDataType,
            nodata: options.nodata,
            makeCopyOfBuffers: true, // Since we are going to send them to a worker
        },
        ...pixelData,
    );

    let result: decoder.CreatePixelBufferResult;

    const enableWorkers = options?.enableWorkers ?? true;

    if (enableWorkers && window.Worker != null) {
        const pool = getDecoderPool();

        result = await pool.queue(
            'CreatePixelBuffer',
            pixelBufferOptions,
            pixelBufferOptions.input,
        );
    } else {
        result = createPixelBuffer(pixelBufferOptions);
    }

    const format = getPixelFormat(pixelData.length);

    return createTextureFromPixelBuffer(
        result,
        options.width,
        options.height,
        format,
        pixelBufferOptions.dataType,
    );
}

/**
 * Returns a 1D texture containing a pixel on the horizontal axis for each color in the array.
 *
 * @param colors - The color gradient.
 * @param alpha - The optional alpha gradient. Must be of the same length as the color gradient.
 * @returns The resulting texture.
 */
function create1DTexture(colors: Color[], alpha?: number[]): DataTexture {
    const size = colors.length;
    const buf = new Uint8ClampedArray(size * 4);

    for (let i = 0; i < size; i++) {
        const color = colors[i];
        const index = i * 4;

        buf[index + 0] = color.r * 255;
        buf[index + 1] = color.g * 255;
        buf[index + 2] = color.b * 255;
        buf[index + 3] = alpha ? MathUtils.clamp(alpha[i], 0, 1) * 255 : 255;
    }

    const HEIGHT = 1;
    const texture = new DataTexture(buf, size, HEIGHT, RGBAFormat, UnsignedByteType);
    texture.needsUpdate = true;

    return texture;
}

/**
 * Computes the minimum and maximum value of the buffer, but only taking into account the first
 * channel (R channel). This is typically used for elevation data.
 *
 * @param buffer - The pixel buffer. May be an RGBA or an RG buffer.
 * @param nodata - The no-data value. Pixels with this value will be ignored.
 * @param interpretation - The image interpretation.
 * @param channelCount - The channel count of the buffer
 * @returns The computed min/max.
 */
function computeMinMaxFromBuffer(
    buffer: TypedArray,
    nodata?: number,
    interpretation: Interpretation = Interpretation.Raw,
    channelCount = 4,
): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;

    const RED_CHANNEL = 0;
    const alphaChannel = channelCount - 1;

    switch (interpretation.mode) {
        case Mode.Raw:
            for (let i = 0; i < buffer.length; i += channelCount) {
                const value = buffer[i + RED_CHANNEL];
                const alpha = buffer[i + alphaChannel];
                if (!(value !== value) && value !== nodata && alpha !== 0) {
                    min = Math.min(min, value);
                    max = Math.max(max, value);
                }
            }
            break;
        case Mode.ScaleToMinMax:
            {
                const lower = interpretation.min as number;
                const upper = interpretation.max as number;
                const scale = upper - lower;

                for (let i = 0; i < buffer.length; i += channelCount) {
                    const value = buffer[i + RED_CHANNEL] / 255;
                    const r = lower + value * scale;
                    const alpha = buffer[i + alphaChannel];

                    if (!(r !== r) && r !== nodata && alpha !== 0) {
                        min = Math.min(min, r);
                        max = Math.max(max, r);
                    }
                }
            }
            break;
        default:
            throw new Error('not implemented');
    }

    if (interpretation.negateValues === true) {
        return { min: -max, max: -min };
    }
    return { min, max };
}

function getWiderType(left: TextureDataType, right: TextureDataType): TextureDataType {
    if (getBytesPerChannel(left) > getBytesPerChannel(right)) {
        return left;
    }

    return right;
}

function shouldExpandRGB(src: PixelFormat, dst: PixelFormat): boolean {
    if (dst !== RGBAFormat) {
        return false;
    }
    if (src === dst) {
        return false;
    }
    return true;
}

/**
 * Computes min/max of the given image.
 *
 * @param image - The image to process.
 * @param interpretation - The interpretation of the image.
 * @returns The min/max.
 */
function computeMinMaxFromImage(
    image: HTMLImageElement | HTMLCanvasElement,
    interpretation: Interpretation = Interpretation.Raw,
): { min: number; max: number } {
    const buf = getPixels(image);

    return computeMinMaxFromBuffer(buf, 0, interpretation);
}

function computeMinMax(
    texture: Texture,
    noDataValue = 0,
    interpretation = Interpretation.Raw,
): { min: number; max: number } | null {
    if (isDataTexture(texture)) {
        const channelCount = getChannelCount(texture.format);
        return computeMinMaxFromBuffer(
            texture.image.data,
            noDataValue,
            interpretation,
            channelCount,
        );
    }
    if (isCanvasTexture(texture)) {
        return computeMinMaxFromImage(texture.image, interpretation);
    }

    return null;
}

function isEmptyTexture(texture: Texture) {
    if (texture == null) {
        return true;
    }
    if ((texture as EmptyTexture).isEmptyTexture) {
        return true;
    }
    if (isCanvasTexture(texture)) {
        return texture.source?.data == null;
    }
    if (isDataTexture(texture)) {
        return texture.image?.data == null;
    } else if (texture.isRenderTargetTexture) {
        return false;
    } else {
        return texture.source?.data == null;
    }
}

function getTextureMemoryUsage(context: GetMemoryUsageContext, texture: Texture) {
    if (texture == null) {
        return;
    }

    if (isEmptyTexture(texture)) {
        context.objects.set(texture.id, { gpuMemory: 0, cpuMemory: 0 });
    } else if (texture.userData?.memoryUsage != null) {
        const existing: MemoryUsageReport = texture.userData.memoryUsage;
        context.objects.set(texture.id, existing);
    } else if (isCanvasTexture(texture)) {
        const { width, height } = texture.source.data;
        context.objects.set(texture.id, { gpuMemory: width * height * 4, cpuMemory: 0 });
    } else {
        const { width, height } = texture.image;

        const bytes =
            width * height * getBytesPerChannel(texture.type) * getChannelCount(texture.format);

        if (texture.isRenderTargetTexture) {
            // RenderTargets do not exist in CPU memory.
            context.objects.set(texture.id, { gpuMemory: bytes, cpuMemory: 0 });
        } else {
            context.objects.set(texture.id, { gpuMemory: bytes, cpuMemory: bytes });
        }
    }
}

function getDepthBufferMemoryUsage(context: GetMemoryUsageContext, renderTarget: RenderTarget) {
    const gl = context.renderer.getContext();
    const bpp = gl.getParameter(gl.DEPTH_BITS);
    const bytes = renderTarget.width * renderTarget.height * (bpp / 8);

    context.objects.set(renderTarget.texture.id, { gpuMemory: bytes, cpuMemory: 0 });
}

function getMemoryUsage(context: GetMemoryUsageContext, texture: Texture | RenderTarget | null) {
    if (texture == null) {
        return;
    }

    if (isTexture(texture)) {
        getTextureMemoryUsage(context, texture);
    } else if (isRenderTarget(texture)) {
        if (texture.depthBuffer) {
            if (texture.depthTexture != null) {
                getTextureMemoryUsage(context, texture.depthTexture);
            } else {
                getDepthBufferMemoryUsage(context, texture);
            }
        }
        getTextureMemoryUsage(context, texture.texture);
    }
}

function getImageData(
    source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
): Uint8ClampedArray {
    if (source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
        const context = source.getContext('2d', {
            willReadFrequently: true,
        }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        const imageData = context.getImageData(0, 0, source.width, source.height);
        return imageData.data;
    } else {
        return getPixels(source);
    }
}

function isCanvasEmpty(canvas: HTMLCanvasElement): boolean {
    const data = getImageData(canvas);

    for (let i = 0; i < data.length; i += 4) {
        // Check if any pixel is not fully transparent or not matching canvas background color
        if (data[i + 3] !== 0) {
            return false; // Canvas is not empty
        }
    }

    return true; // Canvas is empty
}

/**
 * Returns a texture filter that is compatible with the texture.
 * @param filter - The requested filter.
 * @param dataType - The texture data type.
 * @param renderer - The WebGLRenderer
 * @returns The requested filter, if compatible, or {@link NearestFilter} if not compatible.
 */
function getCompatibleTextureFilter<
    F extends MagnificationTextureFilter | MinificationTextureFilter,
>(filter: F, dataType: TextureDataType, renderer: WebGLRenderer): F {
    const gl = renderer?.getContext();

    // This would happen when running unit test in a case where WebGL is not supported.
    if (gl == null) {
        return filter;
    }

    const fallback = NearestFilter as F;

    if (filter === LinearFilter) {
        if (dataType === FloatType && !gl.getExtension('OES_texture_float_linear')) {
            return fallback;
        }
        if (dataType === HalfFloatType && !gl.getExtension('OES_texture_half_float_linear')) {
            return fallback;
        }
    }

    return filter;
}

/**
 * Updates the texture to improve compatibility with various platforms.
 */
function ensureCompatibility(texture: Texture, renderer: WebGLRenderer) {
    texture.minFilter = getCompatibleTextureFilter(texture.minFilter, texture.type, renderer);
    texture.magFilter = getCompatibleTextureFilter(texture.magFilter, texture.type, renderer);
}

export default {
    createDataTexture,
    createDataTextureAsync,
    isEmptyTexture,
    decodeBlob,
    getChannelCount,
    getBytesPerChannel,
    getWiderType,
    getDataTypeString,
    create1DTexture,
    createDataCopy,
    computeMinMax,
    isDataTexture,
    isCanvasTexture,
    computeMinMaxFromBuffer,
    computeMinMaxFromImage,
    estimateSize,
    shouldExpandRGB,
    isCanvasEmpty,
    getMemoryUsage,
    getCompatibleTextureFilter,
    ensureCompatibility,
};
