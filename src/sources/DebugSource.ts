import { CanvasTexture, Color } from 'three';
import type Extent from '../core/geographic/Extent';
import PromiseUtils from '../utils/PromiseUtils';
import type { CustomContainsFn, GetImageOptions } from './ImageSource';
import ImageSource, { ImageResult } from './ImageSource';

class DebugSource extends ImageSource {
    readonly isDebugSource: boolean = true as const;
    readonly type = 'DebugSource' as const;

    private readonly _delay: () => number;
    private readonly _extent: Extent;
    private readonly _opacity: number;
    private readonly _subdivisions: number;
    private readonly _color: Color;

    /**
     * @param options - options
     */
    constructor(options: {
        /** The extent. */
        extent: Extent;
        /** The delay before loading the images. */
        delay?: number;
        /** The opacity of the images. */
        opacity?: number;
        /** The color of the images. */
        color?: Color;
        /** How many images per tile are served. */
        subdivisions?: number;
        /** The custom function to test if a given extent is contained in this source. */
        containsFn?: CustomContainsFn;
    }) {
        super(options);
        const { delay, subdivisions, opacity, extent, color } = options;

        if (delay != null) {
            if (typeof delay === 'function') {
                this._delay = delay;
            } else if (typeof delay === 'number') {
                this._delay = () => delay;
            } else {
                this._delay = () => 0;
            }
        } else {
            this._delay = () => 0;
        }

        this._extent = options.extent;
        this._opacity = opacity ?? 1;
        this._subdivisions = subdivisions ?? 1;
        this._color = color ?? new Color(1, 1, 1);
        this._extent = extent;
    }

    private getImage(width: number, height: number, id: string) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        if (!context) {
            throw new Error('could not acquire 2d context');
        }

        const prefix = id.substring(0, 10);

        context.fillStyle = `#${this._color.getHexString()}`;
        context.globalAlpha = this._opacity ?? 1;
        context.fillRect(0, 0, width, height);
        context.globalAlpha = 1;
        context.strokeStyle = `#${this._color.getHexString()}`;
        context.lineWidth = 16;
        context.strokeRect(0, 0, width, height);
        context.fillStyle = 'black';

        const margin = 20;
        context.fillText(prefix, margin, margin);

        const texture = new CanvasTexture(canvas);

        return texture;
    }

    getCrs(): string {
        return this._extent.crs;
    }

    getExtent() {
        return this._extent;
    }

    getImages(options: GetImageOptions) {
        const { extent, width, height, signal, id } = options;
        const subdivs = this._subdivisions;
        const extents = extent.split(subdivs, subdivs);

        const requests = [];

        const w = Math.round(width / subdivs);
        const h = Math.round(height / subdivs);

        for (let i = 0; i < extents.length; i++) {
            const ex = extents[i];
            const imageId = `${id}-${i}`;
            const request = () =>
                PromiseUtils.delay(this._delay()).then(() => {
                    signal?.throwIfAborted();
                    const texture = this.getImage(w, h, imageId);
                    return new ImageResult({ extent: ex, texture, id: imageId });
                });
            requests.push({ id: imageId, request });
        }

        return requests;
    }
}

export default DebugSource;
