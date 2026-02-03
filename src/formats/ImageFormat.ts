/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Texture, TextureDataType } from 'three';

export interface DecodeOptions {
    /** The texture width. */
    width: number;
    /** The texture height */
    height: number;
    /** The no-data value */
    noDataValue?: number;
}

export interface DecodeResult {
    texture: Texture;
    min?: number;
    max?: number;
}

/**
 * Base class for image decoders. To implement your own image decoder, subclass this class.
 */
abstract class ImageFormat {
    public readonly isImageFormat = true as const;

    public type: string;
    public readonly flipY: boolean;
    public readonly dataType: TextureDataType;

    public constructor(flipY: boolean, dataType: TextureDataType) {
        this.isImageFormat = true;
        this.type = 'ImageFormat';

        this.flipY = flipY;
        this.dataType = dataType;
    }

    /**
     * Decodes the blob into a texture.
     *
     * @param blob - The blob to decode.
     * @param options - The decoder options.
     * @returns The decoded texture.
     */
    public abstract decode(blob: Blob, options: DecodeOptions): Promise<DecodeResult>;
}

export default ImageFormat;
