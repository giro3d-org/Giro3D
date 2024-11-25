import { CanvasTexture, MathUtils, Texture } from 'three';
import type Extent from '../core/geographic/Extent';
import EmptyTexture from '../renderer/EmptyTexture';
import Fetcher from '../utils/Fetcher';
import type { GetImageOptions, ImageResponse, ImageSourceEvents } from './ImageSource';
import ImageSource, { ImageResult } from './ImageSource';

/**
 * Options for the {@link StaticImageSource} constructor.
 */
export type StaticImageSourceOptions = {
    /**
     * The source of the image. It can be:
     * - a URL to a remote PNG, JPEG or WebP file,
     * - an `<canvas>` or `<image>` element,
     * - a THREE.js [`Texture`](https://threejs.org/docs/index.html?q=texture#api/en/textures/Texture).
     */
    source: string | HTMLImageElement | HTMLCanvasElement | Texture;
    /**
     * The extent of the image.
     */
    extent: Extent;
    /**
     * Should the texture be flipped vertically ? This parameter only applies if
     * {@link StaticImageSourceOptions.source | source} is a texture.
     */
    flipY?: boolean;
};

export interface StaticImageSourceEvents extends ImageSourceEvents {
    /**
     * Raised when the remote image has been loaded.
     */
    loaded: unknown;
    /**
     * Raised when the remote image failed to load.
     */
    error: {
        error: Error;
    };
}

/**
 * An {@link ImageSource} that displays a single, static image.
 *
 * The image must be either a PNG, JPG or WebP file.
 */
export default class StaticImageSource extends ImageSource<StaticImageSourceEvents> {
    readonly isStaticImageSource = true as const;
    readonly type = 'StaticImageSource' as const;

    private readonly _extent: Extent;
    private readonly _source: string | HTMLImageElement | HTMLCanvasElement | Texture;
    private readonly _id = MathUtils.generateUUID();

    private _promise: Promise<ImageResult> | undefined;

    /**
     * Create a {@link StaticImageSource}.
     * @param options - The options.
     */
    constructor(options: StaticImageSourceOptions) {
        super({
            colorSpace: 'srgb',
            flipY: typeof options.source === 'string' ? false : (options.flipY ?? true),
            is8bit: true,
        });

        if (options.source == null) {
            throw new Error('invalid source');
        }
        if (options.extent == null) {
            throw new Error('invalid extent');
        }

        this._extent = options.extent;
        this._source = options.source;
    }

    getExtent(): Extent {
        return this._extent;
    }

    getCrs(): string {
        return this._extent.crs;
    }

    private async fetchTexture(url: string): Promise<Texture> {
        // We directly flip the texture during decoding, which is why we don't need to flip it in the layer itself.
        return Fetcher.texture(url, { flipY: true, priority: this.priority })
            .then(texture => {
                this.dispatchEvent({ type: 'loaded' });
                return texture;
            })
            .catch(error => {
                console.error(error);
                this.dispatchEvent({ type: 'error', error });
                return new EmptyTexture();
            });
    }

    private async loadImageOnce(): Promise<ImageResult> {
        let texture: Texture;

        if (typeof this._source === 'string') {
            texture = await this.fetchTexture(this._source);
        } else if (this._source instanceof HTMLCanvasElement) {
            texture = new CanvasTexture(this._source);
        } else if (this._source instanceof HTMLImageElement) {
            texture = new Texture(this._source);
        } else {
            texture = this._source;
        }

        return new ImageResult({
            id: this._id,
            texture,
            extent: this._extent,
        });
    }

    private async loadImage(): Promise<ImageResult> {
        if (this._promise == null) {
            this._promise = this.loadImageOnce();
        }

        return this._promise;
    }

    getImages(_options: GetImageOptions): Array<ImageResponse> {
        const response: ImageResponse = {
            id: this._id,
            request: this.loadImage.bind(this),
        };

        return [response];
    }
}
