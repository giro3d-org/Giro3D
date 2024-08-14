import type { Texture, TextureDataType } from 'three';

export type DecodeOptions = {
    /** The texture width. */
    width: number;
    /** The texture height */
    height: number;
    /** The no-data value */
    noDataValue?: number;
};

/**
 * Base class for image decoders. To implement your own image decoder, subclass this class.
 *
 */
abstract class ImageFormat {
    readonly isImageFormat: boolean = true;
    type: string;
    readonly flipY: boolean;
    readonly dataType: TextureDataType;

    constructor(flipY: boolean, dataType: TextureDataType) {
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
    abstract decode(
        blob: Blob,
        options: DecodeOptions,
    ): Promise<{
        texture: Texture;
        min?: number;
        max?: number;
    }>;
}

export default ImageFormat;
