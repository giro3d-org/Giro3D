/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MathUtils, VideoTexture } from 'three';

import type CoordinateSystem from '../core/geographic/CoordinateSystem';
import type Extent from '../core/geographic/Extent';
import type { GetImageOptions, ImageResponse, ImageSourceEvents } from './ImageSource';

import EmptyTexture from '../renderer/EmptyTexture';
import { nonNull } from '../utils/tsutils';
import ImageSource, { ImageResult } from './ImageSource';

/**
 * Options for the {@link VideoSource} constructor.
 */
export interface VideoSourceOptions {
    /**
     * The source of the image. It can be:
     * - a URL to a remote video file,
     * - an `<video>` element,
     * - a THREE.js [`VideoTexture`](https://threejs.org/docs/index.html?q=video#api/en/textures/VideoTexture).
     */
    source: string | HTMLVideoElement | VideoTexture;
    /**
     * The extent of the image.
     */
    extent: Extent;
    /**
     * Should the texture be flipped vertically ? This parameter only applies if
     * {@link VideoSourceOptions.source | source} is a texture.
     */
    flipY?: boolean;
}

export interface VideoSourceEvents extends ImageSourceEvents {
    /**
     * Raised when the remote video has been loaded.
     */
    loaded: unknown;
    /**
     * Raised when the remote video failed to load.
     */
    error: {
        error: Error;
    };
}

/**
 * An {@link ImageSource} that displays a video.
 */
export default class VideoSource extends ImageSource<VideoSourceEvents> {
    public readonly isVideoSource = true as const;
    public override readonly type = 'VideoSource' as const;

    private readonly _extent: Extent;
    private readonly _source: string | HTMLVideoElement | VideoTexture;
    private readonly _id = MathUtils.generateUUID();

    private _promise: Promise<void> | undefined;
    private _video: HTMLVideoElement | null = null;
    private _texture: VideoTexture | null = null;

    /**
     * Create a {@link VideoSource}.
     * @param options - The options.
     */
    public constructor(options: VideoSourceOptions) {
        super({
            colorSpace: 'srgb',
            flipY: typeof options.source === 'string' ? false : (options.flipY ?? true),
            synchronous: true,
            is8bit: true,
        });

        this._extent = nonNull(options.extent, 'missing extent');
        this._source = nonNull(options.source, 'missing source');
    }

    public getExtent(): Extent {
        return this._extent;
    }

    public getCrs(): CoordinateSystem {
        return this._extent.crs;
    }

    /**
     * Gets the `<video>` element that contains the video, or `null` if it is not loaded yet.
     */
    public get video(): HTMLVideoElement | null {
        return this._video;
    }

    private async fetchVideo(url: string): Promise<VideoTexture | null> {
        return new Promise(resolve => {
            const element = document.createElement('video');

            element.onerror = (err): void => {
                if (typeof err === 'string') {
                    console.error(err);
                    this.dispatchEvent({ type: 'error', error: new Error(err) });
                } else {
                    const msg = `error loading VideoSource at ${url}`;
                    console.error(msg);
                    this.dispatchEvent({ type: 'error', error: new Error(msg) });
                }
                resolve(null);
            };

            element.addEventListener('canplaythrough', () => resolve(new VideoTexture(element)));

            element.crossOrigin = 'anonymous';
            element.src = url;
            element.load();
        });
    }

    private async loadVideo(): Promise<void> {
        if (typeof this._source === 'string') {
            this._texture = await this.fetchVideo(this._source);
            this._video = this._texture?.image;
        } else if (this._source instanceof HTMLVideoElement) {
            this._texture = new VideoTexture(this._source);
            this._video = this._source;
        } else {
            this._texture = this._source;
            this._video = this._texture.image;
        }

        this.dispatchEvent({ type: 'loaded' });

        const callback: () => void = () => {
            // We use a microtask to avoid a stack overflow due to an infinite feedback loop
            // between the layer asking for the images and the video callback.
            queueMicrotask(() => this.update(this._extent));
            this.video?.requestVideoFrameCallback(callback);
        };

        callback();
    }

    private loadImage(): ImageResult {
        if (this._promise == null) {
            this._promise = this.loadVideo();
        }

        return new ImageResult({
            id: this._id,
            texture: this._texture ?? new EmptyTexture(),
            extent: this._extent,
        });
    }

    public getImages(_options: GetImageOptions): Array<ImageResponse> {
        const response: ImageResponse = {
            id: this._id,
            request: this.loadImage.bind(this),
        };

        return [response];
    }
}
