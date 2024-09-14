import type { FloatType, RedFormat, RGFormat, TypedArray, UnsignedShortType } from 'three';
import { MathUtils, RGBAFormat, UnsignedByteType, Vector2 } from 'three';
import TextureGenerator from '../utils/TextureGenerator';
import type ElevationRange from './ElevationRange';
import type OffsetScale from './OffsetScale';
import type Rect from './Rect';

const RGBA_OFFSET = 20000;

const temp = {
    input: new Vector2(),
    output: new Vector2(),
    ij: new Vector2(),
    topLeft: new Vector2(),
    bottomRight: new Vector2(),
};

export type HeightMapPixelFormat = typeof RGBAFormat | typeof RGFormat | typeof RedFormat;
export type HeightMapTextureDataType =
    | typeof UnsignedByteType
    | typeof UnsignedShortType
    | typeof FloatType;

/**
 * Utility class to sample an elevation raster.
 */
export default class HeightMap {
    /**
     * The heightmap data.
     */
    readonly buffer: TypedArray;
    /**
     * The width, in pixels, of the heightmap buffer.
     */
    readonly width: number;
    /**
     * The height, in pixels, of the heightmap buffer.
     */
    readonly height: number;
    /**
     * The transformation to apply to UV coordinates before sampling the buffer.
     */
    readonly offsetScale: OffsetScale;
    /**
     * The distance between each elevation value in the buffer.
     * e.g If the buffer is an RGBA buffer, stride is 4.
     */
    readonly stride: number;
    /**
     * The format of the underlying buffer pixels.
     */
    readonly format: HeightMapPixelFormat;
    /**
     * The data type of the underlying buffer pixels.
     */
    readonly type: HeightMapTextureDataType;

    /**
     * The vertical precision of the height values to apply during decoding.
     */
    readonly precision: number;

    /**
     * The offset to apply to height values during decoding.
     */
    readonly offset: number;

    constructor(
        buffer: TypedArray,
        width: number,
        height: number,
        offsetScale: OffsetScale,
        format: HeightMapPixelFormat,
        type: HeightMapTextureDataType,
        precision?: number,
        offset?: number,
    ) {
        const stride = TextureGenerator.getChannelCount(format);
        if (buffer.length < width * height * stride) {
            throw new Error('buffer is too small');
        }

        this.buffer = buffer;
        this.width = width;
        this.height = height;
        this.offsetScale = offsetScale;
        this.stride = stride;
        this.format = format;
        this.type = type;
        this.precision = precision ?? 0.1;
        this.offset = offset ?? RGBA_OFFSET;
    }

    private readRGBA(index: number, ignoreNoData: boolean): number | null {
        const { buffer, stride } = this;

        const r = buffer[index * stride + 0];
        const g = buffer[index * stride + 1];
        const b = buffer[index * stride + 2];
        const alpha = buffer[index * stride + 3];

        if (!ignoreNoData && alpha === 0) {
            return null;
        }

        return (r + g * 256.0 + b * 256.0 * 256.0) * this.precision - this.offset;
    }

    private readRG(index: number, ignoreNoData: boolean): number | null {
        const { buffer, stride } = this;

        const alpha = buffer[index * stride + 1];
        if (!ignoreNoData && alpha === 0) {
            return null;
        }

        const value = buffer[index * stride + 0];
        return value;
    }

    clone(): HeightMap {
        return new HeightMap(
            this.buffer,
            this.width,
            this.height,
            this.offsetScale.clone(),
            this.format,
            this.type,
            this.precision,
            this.offset,
        );
    }

    /**
     * Returns the elevation of the pixel that contains the UV coordinate.
     * No interpolation is performed.
     * @param u - The normalized U coordinate (along the horizontal axis).
     * @param v - The normalized V coordinate (along the vertical axis).
     * @param ignoreTransparentPixels - If `true`, then transparent pixels are returned. Otherwise
     * values that match transparent pixels return `null`. Default is `false`.
     */
    getValue(u: number, v: number, ignoreTransparentPixels = false): number | null {
        const ij = this.getPixelCoordinates(u, v, temp.ij);

        return this.getValueRaw(ij.x, ij.y, ignoreTransparentPixels);
    }

    /**
     * Computes the min/max elevation from the given normalized region.
     * @param uvRect - The normalized region to process.
     * @returns The min/max, if any, otherwise `null`.
     */
    getMinMax(uvRect: Rect): ElevationRange | null {
        const left = uvRect.left;
        const top = uvRect.top;
        const bottom = uvRect.bottom;
        const right = uvRect.right;

        let min = +Infinity;
        let max = -Infinity;

        const topLeft = this.getPixelCoordinates(left, top, temp.topLeft);
        const bottomRight = this.getPixelCoordinates(right, bottom, temp.bottomRight);

        for (let i = topLeft.x; i <= bottomRight.x; i++) {
            for (let j = bottomRight.y; j <= topLeft.y; j++) {
                const z = this.getValueRaw(i, j, true);

                if (z != null) {
                    min = Math.min(z, min);
                    max = Math.max(z, max);
                }
            }
        }

        if (isFinite(min) && isFinite(max)) {
            return { min, max };
        }

        return null;
    }

    private getPixelCoordinates(u: number, v: number, target: Vector2): Vector2 {
        const { width, height, offsetScale } = this;

        temp.input.set(u, v);
        const transformed = offsetScale.transform(temp.input, temp.output);

        const uu = MathUtils.clamp(transformed.x, 0, 1);
        const vv = MathUtils.clamp(transformed.y, 0, 1);

        const i = MathUtils.clamp(Math.round(uu * width - 1), 0, width);
        const j = MathUtils.clamp(Math.round(vv * height - 1), 0, height);

        return target.set(i, j);
    }

    private getValueRaw(i: number, j: number, ignoreTransparentPixels = false): number | null {
        const index = i + j * this.width;

        if (this.format === RGBAFormat && this.type === UnsignedByteType) {
            return this.readRGBA(index, ignoreTransparentPixels);
        } else {
            return this.readRG(index, ignoreTransparentPixels);
        }
    }
}
