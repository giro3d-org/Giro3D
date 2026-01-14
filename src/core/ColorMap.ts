/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    ClampToEdgeWrapping,
    EventDispatcher,
    MathUtils,
    NearestFilter,
    type Color,
    type DataTexture,
} from 'three';

import TextureGenerator from '../utils/TextureGenerator';
import { nonNull } from '../utils/tsutils';
import ColorMapMode from './ColorMapMode';

export interface ColorMapEvents {
    updated: unknown;
}

/**
 * Represents a 1D color gradient bounded by a `min` and `max` values.
 *
 * Whenever a color map is associated with a grayscale texture, the color intensity of the texture
 * is used a a parameter to sample the color gradient.
 *
 * **Important**: since this color map owns a texture, it is disposable. Don't forget to call
 * `dispose()` to free texture memory, when you're finished using the colormap.
 *
 * The `mode` property describes how the intensity of the pixel is interpreted:
 *
 * `Elevation` simply takes the intensity value of the pixel, `Slope` gets the slope of the
 * pixel (assuming it is an elevation texture), and `Aspect` gets the aspect (orientation from
 * the north) of the pixel (assuming it is an elevation texture).
 *
 * The `min` and `max` properties describe how the colormap is applied relative to the intensity of
 * the sampled pixel.
 *
 * Pixel intensities outside of those bounds will take the color of the bound that is the closest
 * (i.e if the intensity is greater than `max`, the color will be the rightmost color of the color
 * ramp).
 *
 * The `colors` property takes an array of colors. To create this array, you can use libraries such
 * as [`colormap`](https://www.npmjs.com/package/colormap) or [`chroma-js`](https://www.npmjs.com/package/chroma-js)
 * to generate the color ramp.
 *
 * To obtain a "discrete" color map, you should use a small number of colors in the ramp.
 * Conversely, to obtain a "linear", continuous color map, you should use a high number of colors,
 * typically 256 values.
 *
 * @example
 * // Create a color map for elevations between 0 and 2500 meters.
 * const colors = makeColorRamp(); // Use whatever library to generate the ramp.
 * const colorMap = new ColorMap(\{ colors, min: 0, max: 2500, mode: ColorMapMode.Elevation \});
 *
 * const texture = colorMap.getTexture();
 *
 * // Disable the color map.
 * colorMap.active = false;
 *
 * // When finished with this color map, dispose it.
 * colorMap.dispose();
 */
class ColorMap extends EventDispatcher<ColorMapEvents> {
    private _min: number;
    private _max: number;
    private _mode: ColorMapMode;
    private _colors: Color[];
    private _opacity: number[] | null = null;
    private _shouldRecreateTexture = true;
    private _cachedTexture: DataTexture | null;
    private _active: boolean;
    /**
     * Creates an instance of ColorMap.
     *
     * @param colors - The colors of this color map.
     * @param min - The lower bound of the color map range.
     * @param max - The upper bound of the color map range.
     * @param mode - The mode of the color map.
     */
    public constructor(options: {
        /**
         * The colors of this color map.
         */
        colors: Color[];
        /**
         * The lower bound of the color map range.
         */
        min: number;
        /**
         * The upper bound of the color map range.
         */
        max: number;
        /**
         * The mode of the color map
         */
        mode?: ColorMapMode;
        /**
         * The opacity values of the color map. If defined, must have the same number of
         * values as the colors array.
         */
        opacities?: number[];
    }) {
        super();

        this._min = options.min;
        this._max = options.max;
        this._mode = options.mode ?? ColorMapMode.Elevation;
        this._colors = nonNull(options.colors, 'missing colors parameter');

        if (options.opacities != null) {
            if (options.opacities.length !== this._colors.length) {
                throw new Error('the opacity array must have the same length as the color array');
            }

            this._opacity = options.opacities ?? null;
        }
        this._cachedTexture = null;
        this._active = true;
    }

    /**
     * Gets or sets the color map mode.
     *
     * @example
     * // Start with an elevation gradient, ranging from 100 to 1500 meters.
     * const colorMap = new ColorMap(\{ colors, min: 100, max: 1500, mode: ColorMapMode.Elevation \});
     *
     * // Change mode to slope, and set min and max to 0-90 degrees.
     * colorMap.mode = ColorMapMode.Slope;
     * colorMap.min = 0;
     * colorMap.max = 90;
     */
    public get mode(): ColorMapMode {
        return this._mode;
    }

    public set mode(v: ColorMapMode) {
        if (this._mode !== v) {
            this._mode = v;
            this.notifyChange();
        }
    }

    private notifyChange(): void {
        this.dispatchEvent({ type: 'updated' });
    }

    /**
     * Enables or disables the color map.
     */
    public get active(): boolean {
        return this._active;
    }

    public set active(v: boolean) {
        if (this._active !== v) {
            this._active = v;
            this.notifyChange();
        }
    }

    /**
     * Gets or sets the lower bound of the color map range.
     */
    public get min(): number {
        return this._min;
    }

    public set min(v: number) {
        if (this._min !== v) {
            this._min = v;
            this.notifyChange();
        }
    }

    /**
     * Gets or sets the upper bound of the color map range.
     */
    public get max(): number {
        return this._max;
    }

    public set max(v: number) {
        if (this._max !== v) {
            this._max = v;
            this.notifyChange();
        }
    }

    /**
     * Gets or sets the colors of the color map.
     *
     * Note: if there is already an array defined in the {@link opacity} property, and this array
     * does not have the same length as the new color array, then it will be removed.
     */
    public get colors(): Color[] {
        return this._colors;
    }

    public set colors(v: Color[]) {
        if (this._colors !== v) {
            this._colors = v;
            // Reset the opacity array if it no longer has the same length.
            if (this._opacity && this._opacity.length !== v.length) {
                this._opacity = null;
            }
            this._shouldRecreateTexture = true;
            this.notifyChange();
        }
    }

    /**
     * Gets or sets the opacity values of the color map.
     *
     * Note: if the provided array does not have the same length as the {@link colors} array,
     * an exception is raised.
     *
     * @defaultValue null
     */
    public get opacity(): number[] | null {
        return this._opacity;
    }

    public set opacity(v: number[] | null) {
        if (v && v.length !== this.colors.length) {
            throw new Error('the opacity array must have the same length as the color array');
        }
        if (this._opacity !== v) {
            this._opacity = v;
            this._shouldRecreateTexture = true;
        }
        this.notifyChange();
    }

    /**
     * Samples the colormap for the given value.
     * @param value - The value to sample.
     * @returns The color at the specified value.
     */
    public sample(value: number): Color {
        const { min, max, colors } = this;

        const clamped = MathUtils.clamp(value, min, max);

        const index = MathUtils.mapLinear(clamped, min, max, 0, colors.length - 1);

        return colors[MathUtils.clamp(Math.round(index), 0, colors.length - 1)];
    }

    /**
     * Samples the transparency for the given value.
     * @param value - The value to sample.
     * @returns The color at the specified value.
     */
    public sampleOpacity(value: number): number {
        const { min, max, opacity } = this;

        if (!opacity) {
            return 1;
        }

        const clamped = MathUtils.clamp(value, min, max);

        const index = MathUtils.mapLinear(clamped, min, max, 0, opacity.length - 1);

        return opacity[MathUtils.clamp(Math.round(index), 0, opacity.length - 1)];
    }

    /**
     * Returns a 1D texture containing the colors of this color map.
     *
     * @returns The resulting texture.
     */
    public getTexture(): DataTexture {
        if (this._shouldRecreateTexture || this._cachedTexture == null) {
            this._cachedTexture?.dispose();

            this._cachedTexture = TextureGenerator.create1DTexture(
                this._colors,
                this._opacity ?? undefined,
            );
            this._cachedTexture.minFilter = NearestFilter;
            this._cachedTexture.magFilter = NearestFilter;
            this._cachedTexture.wrapS = ClampToEdgeWrapping;
            this._cachedTexture.wrapT = ClampToEdgeWrapping;

            this._shouldRecreateTexture = false;
        }

        return nonNull(this._cachedTexture);
    }

    /**
     * Clones this colormap.
     */
    public clone(): ColorMap {
        return new ColorMap({
            colors: [...this.colors],
            min: this.min,
            max: this.max,
            mode: this._mode,
            opacities: this._opacity != null ? [...this._opacity] : undefined,
        });
    }

    /**
     * Disposes the texture owned by this color map.
     */
    public dispose(): void {
        this._cachedTexture?.dispose();
    }
}

export { ColorMapMode };

export default ColorMap;
