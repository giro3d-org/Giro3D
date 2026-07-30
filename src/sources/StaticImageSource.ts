/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, MathUtils, Texture } from 'three';

import type CoordinateSystem from '../core/geographic/CoordinateSystem';
import Extent from '../core/geographic/Extent';
import type { GridExtent } from '../core/geographic/Extent';
import type { GetImageOptions, ImageResponse, ImageSourceEvents } from './ImageSource';

import EmptyTexture from '../renderer/EmptyTexture';
import Fetcher from '../utils/Fetcher';
import ImageSource, { ImageResult } from './ImageSource';
import { nonNull } from '../utils/tsutils';
import TextureGenerator from '../utils/TextureGenerator';
import Capabilities from '../utils/Capabilities';

/**
 * Options for the {@link StaticImageSource} constructor.
 */
export interface StaticImageSourceOptions {
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
}

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
 * The image must be either a PNG, JPG or WebP file, whose dimensions are not greater
 * than the maximal texture size allowed by WebGL on this browser.
 */
export default class StaticImageSource extends ImageSource<StaticImageSourceEvents> {
    public readonly isStaticImageSource = true as const;
    public override readonly type = 'StaticImageSource' as const;

    private readonly _extent: Extent;
    private readonly _source: string | HTMLImageElement | HTMLCanvasElement | Texture;
    private readonly _id = MathUtils.generateUUID();

    private _promise: Promise<ImageResult> | undefined;

    /**
     * Create a {@link StaticImageSource}.
     * @param options - The options.
     */
    public constructor(options: StaticImageSourceOptions) {
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

    public getExtent(): Extent {
        return this._extent;
    }

    public getCrs(): CoordinateSystem {
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

    public override adjustExtentAndPixelSize(
        requestExtent: Extent,
        requestWidth: number,
        requestHeight: number,
    ): GridExtent | null {
        return { extent: requestExtent, width: requestWidth, height: requestHeight };
    }

    public override update(): void {
        this._promise = undefined;
        super.update();
    }

    private async loadImage(): Promise<ImageResult> {
        if (this._promise == null) {
            this._promise = this.loadImageOnce();
        }

        return this._promise;
    }

    public getImages(_options: GetImageOptions): ImageResponse[] {
        const response: ImageResponse = {
            id: this._id,
            request: this.loadImage.bind(this),
        };

        return [response];
    }

    public static async load({
        url,
        extent,
        maxSize = Capabilities.getMaxTextureSize(),
    }: {
        url: string;
        extent: Extent;
        maxSize?: number;
    }): Promise<StaticImageSource[]> {
        const blob = await Fetcher.blob(url);
        const original = await TextureGenerator.decodeBlobToImageBitmap(blob, { flipY: true });
        const actualMax = Math.min(Capabilities.getMaxTextureSize(), maxSize);

        function makeTexture(ima: ImageBitmap): Texture {
            const tex = new Texture(original);
            tex.wrapS = ClampToEdgeWrapping;
            tex.wrapT = ClampToEdgeWrapping;
            tex.minFilter = LinearFilter;
            tex.magFilter = LinearFilter;
            tex.generateMipmaps = false;
            tex.needsUpdate = true;
            return tex;
        }

        // The original image is smaller than the limits, let's output a single source
        if (original.width <= actualMax && original.height <= actualMax) {
            return [new StaticImageSource({ source: makeTexture(original), extent, flipY: false })];
        }

        const result: StaticImageSource[] = [];

        const dims = extent.dimensions();

        for (let x = 0; x < original.width; x += actualMax) {
            for (let y = 0; y < original.height; y += actualMax) {
                const w = (x + actualMax) % original.width;
                const h = (y + actualMax) % original.height;

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = nonNull(
                    canvas.getContext('2d'),
                    'Failed to retrieve CanvasRenderingContext2D',
                );
                ctx.drawImage(original, x, y, w, h, 0, 0, w, h);

                const normalizedWidth = w / original.width;
                const normalizedHeight = h / original.height;
                const u = x / original.width;
                const v = y / original.height;

                const corner = extent.sampleUV(u, v);

                const extentWidth = dims.width * normalizedWidth;
                const extentHeight = dims.height * normalizedHeight;

                const subExtent = new Extent(extent.crs, {
                    minX: corner.x,
                    minY: corner.y,
                    maxX: corner.x + extentWidth,
                    maxY: corner.y + extentHeight,
                });

                const source = new StaticImageSource({
                    source: canvas,
                    flipY: true,
                    extent: subExtent,
                });

                result.push(source);
            }
        }

        return result;
    }
}
