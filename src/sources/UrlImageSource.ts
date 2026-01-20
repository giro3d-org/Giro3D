/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Texture } from 'three';

import { UnsignedByteType } from 'three';

import type CoordinateSystem from '../core/geographic/CoordinateSystem';
import type Extent from '../core/geographic/Extent';
import type ImageFormat from '../formats/ImageFormat';
import type { GetImageOptions, ImageResponse, ImageSourceOptions } from './ImageSource';

import EmptyTexture from '../renderer/EmptyTexture';
import MemoryTracker from '../renderer/MemoryTracker';
import { isHttpError } from '../utils/Fetcher';
import TextureGenerator from '../utils/TextureGenerator';
import { nonNull } from '../utils/tsutils';
import ConcurrentDownloader from './ConcurrentDownloader';
import { ImageResult } from './ImageSource';
import ImageSource from './ImageSource';

const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

/**
 * Constructor options for {@link UrlImageSource}.
 */
export interface UrlImageSourceOptions extends ImageSourceOptions {
    /**
     * The URL template to use for image requests. Parameters to substitute must be enclosed in braces, e.g `{minx}`.
     * Supported parameters:
     * - `{minx}`: The min X (leftmost side) value of the requested extent.
     * - `{maxx}`: The max X (rightmost side) value of the requested extent.
     * - `{miny}`: The min Y (bottom side) value of the requested extent.
     * - `{maxy}`: The max Y (top side) value of the requested extent.
     * - `{width}`: The width, in pixels, of the requested image.
     * - `{height}`: The height, in pixels, of the requested image.
     * - `{epsgCode}`: The numerical code of the request coordinate system.
     * For example, if the instance coordinate system is EPSG:3857, `{epsgCode}` will be substituted with the `3857` value.
     * ```js
     * // A typical GetMap WMS pattern
     * const wmsTemplate: "http://example.com?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=MyLayer&STYLES=&SRS=EPSG:{epsgCode}&BBOX={minx},{miny},{maxx},{maxy}&WIDTH={width}&HEIGHT={height}&FORMAT=image/png"
     * ```
     */
    urlTemplate: string;
    /**
     * The Coordinate Reference System of the image. If unspecified, will assume that the desired coordinate system is the one of the entity that contains the layer.
     */
    crs?: CoordinateSystem;
    /**
     * The image format decoder to use. Note: for jpeg, png and webp images, no format decoder is required.
     */
    format?: ImageFormat;
    /**
     * The optional extent to use.
     */
    extent?: Extent;
    /**
     * The optional HTTP request timeout, in milliseconds.
     *
     * @defaultValue 5000
     */
    httpTimeout?: number;
    /**
     * How many retries to execute when an HTTP request ends up in error.
     * @defaultValue 3
     */
    retries?: number;
    /**
     * Enable web workers.
     * @defaultValue true
     */
    enableWorkers?: boolean;
    /**
     * The optional no-data value.
     */
    noDataValue?: number;
}

/**
 * Base class for URL-based image sources. Image requests are based on a provided URL
 * template that contain parameters replaced with their actual values.
 *
 * Supported template tokens:
 * |Parameter|Value|
 * |---|---|
 * |`{minx}`|The minimum X coordinate of the request bounding box|
 * |`{miny}`|The minimum Y coordinate of the request bounding box|
 * |`{maxx}`|The maximum X coordinate of the request bounding box|
 * |`{maxy}`|The maximum Y coordinate of the request bounding box|
 * |`{width}`|The width, in pixels of the requested image|
 * |`{height}`|The height, in pixels of the requested image|
 * |`{epsgCode}`|The numerical code of the coordinate system, e.g `3857`|
 *
 * @example
 * ```js
 * const source = new UrlImageSource({
 *    urlTemplate: "http://example.com?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=MyLayer&STYLES=&SRS=EPSG:4326&BBOX={minx},{miny},{maxx},{maxy}&WIDTH={width}&HEIGHT={height}&FORMAT=image/png"
 * });
 * ```
 */
export default class UrlImageSource extends ImageSource {
    public readonly isUrlImageSource = true as const;
    public override readonly type: string = 'UrlImageSource' as const;

    private readonly _extent: Extent | undefined;
    private readonly _downloader: ConcurrentDownloader;
    private readonly _enableWorkers: boolean;
    private readonly _format: ImageFormat | undefined;
    private readonly _noDataValue: number | undefined;

    private _urlTemplate: string;
    private _crs: CoordinateSystem | undefined;

    /** @internal */
    public readonly info = {
        requestedImages: 0,
        loadedImages: 0,
    };

    /**
     * Sets the URL template to a new value. This raises the `updated` event so that the layer can be repainted.
     * @param template - The new URL template to use.
     */
    public setUrlTemplate(template: string): void {
        this._urlTemplate = template;
        this.update();
    }

    public constructor(options: UrlImageSourceOptions) {
        super({
            ...options,
            flipY: options.flipY ?? options.format?.flipY ?? false,
            is8bit:
                options.is8bit ??
                (options.format?.dataType ?? UnsignedByteType) === UnsignedByteType,
        });

        this._urlTemplate = options.urlTemplate;
        this._crs = options.crs;
        this._extent = options.extent;
        this._downloader = new ConcurrentDownloader({
            retry: options.retries ?? DEFAULT_RETRIES,
            timeout: options.httpTimeout ?? DEFAULT_TIMEOUT,
        });
        this._enableWorkers = options.enableWorkers ?? true;
        this._format = options.format;
        this._noDataValue = options.noDataValue;
    }

    public override initialize(options: { targetProjection: CoordinateSystem }): Promise<void> {
        this._crs = this._crs ?? options.targetProjection;
        return Promise.resolve();
    }

    public override getCrs(): CoordinateSystem {
        return nonNull(this._crs, 'this source is not yet initialized');
    }

    public override getExtent(): Extent | null {
        return this._extent ?? null;
    }

    public override getImages(options: GetImageOptions): ImageResponse[] {
        const response: ImageResponse = {
            id: options.id,
            request: () => this.requestImageFromSource(options),
        };

        return [response];
    }

    /** @internal */
    public generateUrl(options: GetImageOptions): string {
        const crs = nonNull(this._crs);
        const { minX, maxX, minY, maxY } = options.extent.as(crs);

        let url = this._urlTemplate
            // Bounding box
            .replace('{minx}', minX.toString())
            .replace('{maxx}', maxX.toString())
            .replace('{miny}', minY.toString())
            .replace('{maxy}', maxY.toString())
            // Image dimensions
            .replace('{width}', options.width.toFixed(0))
            .replace('{height}', options.height.toFixed(0));

        if (this._urlTemplate.includes('{epsgCode}')) {
            let epsgCode = crs.srid?.tryGetEpsgCode();
            if (epsgCode == null && crs.id.startsWith('EPSG:')) {
                epsgCode = Number.parseInt(crs.id.split(':')[1], 10);
            }

            if (epsgCode != null) {
                // Coordinate system
                url = url.replace('{epsgCode}', epsgCode.toString());
            } else {
                throw new Error(
                    `could not replace {epsgCode} value in URL because the coordinate system does not have any EPSG code (${crs.id})`,
                );
            }
        }

        return encodeURI(url);
    }

    private async requestImageFromSource(options: GetImageOptions): Promise<ImageResult> {
        const { extent, id, signal, createReadableTextures } = options;

        this.info.requestedImages++;

        const url = this.generateUrl(options);
        const blob = await this.fetchData(url, signal);

        if (!blob) {
            return new ImageResult({
                texture: new EmptyTexture(),
                extent,
                id,
            });
        }

        let texture: Texture;
        let min;
        let max;

        if (this._format) {
            const width = options.width;
            const height = options.height;

            const decoded = await this._format.decode(blob, {
                noDataValue: this._noDataValue,
                width,
                height,
            });

            texture = decoded.texture;
            min = decoded.min;
            max = decoded.max;
        } else {
            texture = await TextureGenerator.decodeBlob(blob, {
                createDataTexture: createReadableTextures,
                flipY: true,
                enableWorkers: this._enableWorkers,
            });
            texture.flipY = false;
        }
        texture.generateMipmaps = false;
        texture.name = 'UrlImageSource - image';

        MemoryTracker.track(texture, texture.name);

        this.info.loadedImages++;

        return new ImageResult({
            texture,
            extent,
            id,
            min,
            max,
        });
    }

    private async fetchData(url: string, signal: AbortSignal | undefined): Promise<Blob | null> {
        try {
            const response = await this._downloader.fetch(url, {
                signal,
                priority: this.priority,
            });

            // If the response is 204 No Content for example, we have nothing to do.
            // This happens when a tile request is valid, but points to a region with no data.
            // Note: we let the HTTP handler do the logging for us in case of 4XX errors.
            if (response.status !== 200) {
                return null;
            }

            const blob = await response.blob();

            return blob;
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
                throw e;
            } else if (isHttpError(e)) {
                // Do nothing as Fetcher already dispatches events when HTTP errors occur.
            } else {
                console.error(e);
            }
            return null;
        }
    }
}
