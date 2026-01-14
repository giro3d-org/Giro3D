/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    EventDispatcher,
    FloatType,
    LinearSRGBColorSpace,
    SRGBColorSpace,
    UnsignedByteType,
    type ColorSpace,
    type Texture,
    type TextureDataType,
} from 'three';

import type CoordinateSystem from '../core/geographic/CoordinateSystem';
import type Extent from '../core/geographic/Extent';
import type { GridExtent } from '../core/geographic/Extent';
import type MemoryUsage from '../core/MemoryUsage';

import { type GetMemoryUsageContext } from '../core/MemoryUsage';

class ImageResult {
    public id: string;
    public zIndex?: number;
    public texture: Texture;
    public extent: Extent;
    public min: number | undefined;
    public max: number | undefined;
    /**
     * @param options - options
     */
    public constructor(options: {
        /** The unique identifier of this result. */
        id: string;
        /** The texture */
        texture: Texture;
        /** The extent */
        extent: Extent;
        /** The minimum value of this image (if applicable). */
        min?: number;
        /** The maximum value of this image (if applicable). */
        max?: number;
        /** Optional z-index to apply to the image */
        zIndex?: number;
    }) {
        if (!options.id) {
            throw new Error('id cannot be null');
        }
        if (options.texture == null) {
            throw new Error('texture cannot be null');
        }
        if (options.extent == null) {
            throw new Error('extent cannot be null');
        }
        this.id = options.id;
        this.zIndex = options.zIndex;
        this.texture = options.texture;
        this.extent = options.extent;
        this.min = options.min;
        this.max = options.max;
    }
}

export type CustomContainsFn = (extent: Extent) => boolean;

export interface GetImageOptions {
    /** The identifier of the node that emitted the request. */
    id: string;
    /** The extent of the request area. */
    extent: Extent;
    /** The pixel width of the request area. */
    width: number;
    /** The pixel height of the request area. */
    height: number;
    /** If `true`, the generated textures must be readable (i.e `DataTextures`). */
    createReadableTextures: boolean;
    /** The optional abort signal. */
    signal?: AbortSignal;
}

export interface ImageResponse {
    /**
     * The id of the response, used to deduplicate requests.
     */
    id: string;
    /**
     * The request that will generate the image.
     */
    request: (() => Promise<ImageResult>) | (() => ImageResult);
}

export interface ImageSourceOptions {
    /**
     * Should images be flipped vertically during composition ?
     */
    flipY?: boolean;
    /**
     * The data type of images generated.
     * For regular color images, this should be `true`. For images with a high dynamic range,
     * or images that requires additional processing, this should be `false`.
     */
    is8bit?: boolean;
    /**
     * The custom function to test if a given extent is contained in this
     * source. Note: we assume this function accepts extents in this source's CRS.
     */
    containsFn?: CustomContainsFn;
    /**
     * The custom color space of the generated textures.
     * See https://threejs.org/docs/#manual/en/introduction/Color-management for
     * more information. If unspecified, the source considers that 8-bit images are in the sRGB
     * color space, otherwise `NoColorSpace`.
     */
    colorSpace?: ColorSpace;
    /**
     * Is this source able to generate images synchronously ?
     */
    synchronous?: boolean;
    /**
     * The relative [priority](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#priority) of HTTP requests emitted by this source.
     * @defaultValue `'auto'`
     */
    requestPriority?: RequestPriority;
    /**
     * Should the generated images be considered transparent ?
     * @defaultValue false
     */
    transparent?: boolean;
}

export interface ImageSourceEvents {
    /**
     * Raised when the source's content has been updated.
     */
    updated: { extent?: Extent };
}

/**
 * Base class for all image sources. The `ImageSource` produces images to be consumed by clients,
 * such as map layers.
 */
abstract class ImageSource<Events extends ImageSourceEvents = ImageSourceEvents>
    extends EventDispatcher<Events & ImageSourceEvents>
    implements MemoryUsage
{
    public readonly isMemoryUsage = true as const;
    public readonly isImageSource: boolean = true as const;
    public readonly type: string;

    public readonly priority: RequestPriority = 'auto';

    private readonly _customColorSpace: ColorSpace | undefined;

    /**
     * Gets whether images generated from this source should be flipped vertically.
     */
    public readonly flipY: boolean;

    public readonly transparent: boolean;

    /**
     * Gets the datatype of images generated by this source.
     */
    public datatype: TextureDataType;
    public readonly containsFn: CustomContainsFn | undefined;
    /**
     * If `true`, this source can immediately generate images without any delay.
     */
    public readonly synchronous: boolean = false;

    /**
     * @param options - Options.
     */
    public constructor(options: ImageSourceOptions = {}) {
        super();

        this.isImageSource = true;
        this.type = 'ImageSource';

        this.flipY = options.flipY ?? false;
        this.datatype = (options.is8bit ?? true) ? UnsignedByteType : FloatType;
        this._customColorSpace = options.colorSpace;
        this.priority = options.requestPriority ?? 'auto';
        this.transparent = options.transparent ?? false;

        this.containsFn = options.containsFn;

        this.synchronous = options?.synchronous ?? false;
    }

    public getMemoryUsage(_context: GetMemoryUsageContext): void {
        // Implement this in derived classes to compute the memory usage of the source.
    }

    /**
     * Gets the color space of the textures generated by this source.
     */
    public get colorSpace(): ColorSpace {
        if (this._customColorSpace != null) {
            return this._customColorSpace;
        }

        // Assume that 8-bit images are in the sRGB color space.
        // Also note that the final decision related to color space is the
        // responsibility of the layer rather than the source.
        return this.datatype === UnsignedByteType ? SRGBColorSpace : LinearSRGBColorSpace;
    }

    /**
     * Returns an adjusted extent, width and height so that request pixels are aligned with source
     * pixels, and requests do not oversample the source.
     *
     * @param requestExtent - The request extent.
     * @param requestWidth - The width, in pixels, of the request extent.
     * @param requestHeight - The height, in pixels, of the request extent.
     * @param margin - The margin, in pixels, around the initial extent.
     * @returns The adjusted parameters.
     */

    public adjustExtentAndPixelSize(
        requestExtent: Extent,

        requestWidth: number,

        requestHeight: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        margin = 0,
    ): GridExtent | null {
        // Default implementation.
        return null;
    }

    /**
     * Returns the CRS of this source.
     *
     * @returns The CRS.
     */
    public abstract getCrs(): CoordinateSystem;

    /**
     * Returns the extent of this source expressed in the CRS of the source.
     *
     * @returns The extent of the source.
     */
    public abstract getExtent(): Extent;

    /**
     * Raises an event to reload the source.
     */
    public update(extent?: Extent): void {
        this.dispatchEvent({ type: 'updated', extent });
    }

    /**
     * Gets whether this source contains the specified extent. If a custom contains function
     * is provided, it will be used. Otherwise,
     * {@link intersects} is used.
     *
     * This method is mainly used to discard non-relevant requests (i.e don't process regions
     * that are not relevant to this source).
     *
     * @param extent - The extent to test.
     */
    public contains(extent: Extent): boolean {
        const convertedExtent = extent.clone().as(this.getCrs());

        if (this.containsFn) {
            return this.containsFn(convertedExtent);
        }

        return this.intersects(convertedExtent);
    }

    /**
     * Test the intersection between the specified extent and this source's extent.
     * This method may be overriden to perform special logic.
     *
     * @param extent - The extent to test.
     * @returns `true` if the extent and this source extent intersects, `false` otherwise.
     */
    public intersects(extent: Extent): boolean {
        const thisExtent = this.getExtent();
        if (thisExtent != null) {
            return thisExtent.intersectsExtent(extent);
        }
        // We don't have an extent, so we default to true.
        return true;
    }

    /**
     * Initializes the source.
     *
     * @param options - Options.
     * @returns A promise that resolves when the source is initialized.
     */

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public initialize(options: {
        /** The target projection. Only useful for sources that are able
         * to reproject their data on the fly (typically vector sources). */
        targetProjection: CoordinateSystem;
    }): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Gets the images for the specified extent and pixel size.
     *
     * @param options - The options.
     * @returns An array containing the functions to generate the images asynchronously.
     */

    public abstract getImages(options: GetImageOptions): ImageResponse[];

    /**
     * Disposes unmanaged resources of this source.
     */

    public dispose(): void {
        // Implement this in derived classes to cleanup unmanaged resources,
        // such as cached objects.
    }
}

function isImageSource(obj: unknown): obj is ImageSource {
    return (obj as ImageSource).isImageSource === true;
}

export default ImageSource;

export { ImageResult, isImageSource };
