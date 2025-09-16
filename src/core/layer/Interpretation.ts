/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { NoColorSpace, type ColorSpace } from 'three';

/**
 * Describes how an image pixel should be interpreted.
 *
 * Note: this is unrelated to the file format / encoding (like JPG and PNG). This interpretation
 * occurs after the image was decoded into a pixel buffer.
 */
enum Mode {
    Raw = 0,
    ScaleToMinMax = 2,
    CompressTo8Bit = 3,
}

/**
 * The interpretation options.
 */
interface InterpretationOptions {
    negateValues?: boolean;
    min?: number;
    max?: number;
}

export type InterpretationUniform = {
    mode: number;
    negateValues: boolean;
    min: number;
    max: number;
};

/**
 * Describes how an image pixel should be interpreted. Any interpretation other than `Raw` will
 * apply a specific processing to every pixel of an image.
 *
 * Note: this is unrelated to the file format / encoding (like JPG and PNG). This interpretation
 * occurs after the image was decoded into a pixel buffer.
 *
 * ```js
 * // Use the raw interpretation
 * const raw = Interpretation.Raw;
 *
 * // Use the min/max scaling interpretation
 * const min = 234.22;
 * const max = 994.1;
 * const minmax = Interpretation.ScaleToMinMax(min, max);
 *
 * // Negates the sign of all pixel values, without any interpretation.
 * // This is useful if your dataset expressed depths (positive values going down) rather than
 * // heights (positive values going up).
 * const custom = new Interpretation(Mode.Raw, {
 *     negateValues: true,
 * })
 * ```
 */
class Interpretation {
    private readonly _mode: Mode;
    private readonly _opts: InterpretationOptions;

    public get options(): InterpretationOptions {
        return this._opts;
    }

    /**
     * Creates a new interpretation.
     *
     * @param mode - The mode.
     * @param opts - The options.
     */
    public constructor(mode: Mode, opts: InterpretationOptions = {}) {
        this._mode = mode;
        this._opts = opts;
    }

    /**
     * Gets the interpretation mode.
     */
    public get mode(): Mode {
        return this._mode;
    }

    /**
     * The min value (only for `MinMax` mode).
     */
    public get min(): number | undefined {
        return this._opts.min;
    }

    /**
     * The max value (only for `MinMax` mode).
     */
    public get max(): number | undefined {
        return this._opts.max;
    }

    /**
     * Gets or set the sign negation of elevation values. If `true`, reverses the sign of elevation
     * values, such that positive values are going downward, rather than updwards.
     * In other words, interpret values as depths rather than heights.
     */
    public get negateValues(): boolean | undefined {
        return this._opts.negateValues;
    }

    public set negateValues(v: boolean | undefined) {
        this._opts.negateValues = v;
    }

    /**
     * Returns `true` if this interpretation does not perform any transformation to source pixels.
     */
    public isDefault(): boolean {
        return this.mode === Mode.Raw && this.negateValues !== true;
    }

    /**
     * Reverses the sign of elevation values, such that positive values are going downward, rather
     * than updwards. In other words, interpret values as depths rather than heights.
     */
    public withNegatedValues(): this {
        this.negateValues = true;
        return this;
    }

    /**
     * Preset for raw. The pixel is used as is, without transformation.
     * Compatible with both grayscale and color images. This is the default.
     */
    public static get Raw(): Interpretation {
        return new Interpretation(Mode.Raw);
    }

    /**
     * Gets the color space required for a correct decoding of textures in this interpretation.
     * If color space cannot be determined, returns `undefined`.
     */
    public get colorSpace(): ColorSpace | undefined {
        switch (this._mode) {
            case Mode.ScaleToMinMax:
                return NoColorSpace;
            default:
                return undefined;
        }
    }

    /**
     * Preset for scaling interpretation.
     *
     * Applies a scaling processing to pixels with the provided min/max values with the following
     * formula : `output = min + input * (max - min)`.
     *
     * Input can be either color or grayscale, and output will be either color or grayscale,
     * depending on input.
     *
     * Note: this is typically used to encode elevation data into a 8-bit grayscale image.
     *
     * @example
     * // We have a grayscale image that represents elevation data ranging from 130 to 1500 meters.
     * // Pixels with color 0 will map to 130 meters, and the pixels with color
     * // 255 will map to 1500 meters, and so on.
     * const interp = Interpretation.ScaleToMinMax(130, 1500);
     * @param min - The minimum value of the dataset, that maps to 0.
     * @param max - The maximum value of the dataset, that maps to 255.
     * @returns The scaling values.
     */
    public static ScaleToMinMax(min: number, max: number): Interpretation {
        if (typeof min === 'number' && typeof max === 'number') {
            return new Interpretation(Mode.ScaleToMinMax, { min, max });
        }

        throw new Error('min and max should be numbers');
    }

    /**
     * Preset for compression.
     *
     * Compresses the input range into the 8-bit range. This is the inverse of
     * {@link Interpretation.ScaleToMinMax}.
     *
     * Note: this is typically used to visualize high dynamic range images, such as 32-bit data,
     * into the 8-bit range suitable for display.
     *
     * @example
     * // We have a 16-bit satellite image with min = 200, and max = 4000. We wish to visualize it
     * // without saturation.
     * const interp = Interpretation.CompressTo8Bit(200, 4000);
     * @param min - The minimum value of the dataset.
     * @param max - The maximum value of the dataset.
     * @returns The interpretation.
     */
    public static CompressTo8Bit(min: number, max: number): Interpretation {
        if (typeof min === 'number' && typeof max === 'number') {
            return new Interpretation(Mode.CompressTo8Bit, { min, max });
        }

        throw new Error('min and max should be numbers');
    }

    /**
     * Returns a user-friendly string representation of this interpretation.
     */
    public toString(): string {
        switch (this.mode) {
            case Mode.Raw:
                return 'Raw';
            case Mode.ScaleToMinMax:
                return `Scaled (min: ${this._opts.min}, max: ${this._opts.max})`;
            case Mode.CompressTo8Bit:
                return `Compressed to 8-bit (min: ${this._opts.min}, max: ${this._opts.max})`;
            default:
                return 'unknown';
        }
    }

    /**
     * @internal
     */
    public setUniform(uniform: InterpretationUniform): InterpretationUniform {
        const mode = this.mode;

        uniform.mode = mode;
        uniform.negateValues = this.negateValues ?? false;
        uniform.min = 0;
        uniform.max = 1;

        switch (mode) {
            case Mode.ScaleToMinMax:
            case Mode.CompressTo8Bit:
                uniform.min = this._opts.min ?? 0;
                uniform.max = this._opts.max ?? 1;
                break;
            case Mode.Raw:
                break;
            default:
                throw new Error(`unknown interpretation mode: ${this.mode}`);
        }

        return uniform;
    }
}

export { InterpretationOptions, Mode };

export default Interpretation;
