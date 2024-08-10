import { fromBlob, Pool } from 'geotiff';
import {
    DataTexture,
    FloatType,
    LinearFilter,
    RGBAFormat,
    RGFormat,
    UnsignedByteType,
    type PixelFormat,
    type Texture,
} from 'three';
import EmptyTexture from '../renderer/EmptyTexture';
import TextureGenerator, {
    OPAQUE_BYTE,
    OPAQUE_FLOAT,
    type NumberArray,
} from '../utils/TextureGenerator';
import type { DecodeOptions } from './ImageFormat';
import ImageFormat from './ImageFormat';

let geotiffWorkerPool: Pool;

/**
 * Decoder for TIFF images.
 *
 */
class GeoTIFFFormat extends ImageFormat {
    readonly isGeoTIFFFormat: boolean = true;

    constructor() {
        super(true, FloatType);

        this.type = 'GeoTIFFFormat';
    }

    /**
     * Decode a tiff blob into a
     * [DataTexture](https://threejs.org/docs/?q=texture#api/en/textures/DataTexture) containing
     * the elevation data.
     *
     * @param blob - the data to decode
     * @param options - the decoding options
     */
    // eslint-disable-next-line class-methods-use-this
    async decode(blob: Blob, options?: DecodeOptions) {
        const tiff = await fromBlob(blob);
        const image = await tiff.getImage();

        const height = image.getHeight();
        const width = image.getWidth();

        let dataType;
        let opaqueValue;
        const nodata = options?.noDataValue || image.getGDALNoData() || undefined;

        if (image.getBitsPerSample() === 8) {
            dataType = UnsignedByteType;
            opaqueValue = OPAQUE_BYTE;
        } else {
            dataType = FloatType;
            opaqueValue = OPAQUE_FLOAT;
        }

        const spp = image.getSamplesPerPixel();

        // Let's use web workers to decode TIFF in the background
        if (window.Worker && !geotiffWorkerPool) {
            geotiffWorkerPool = new Pool();
        }

        let format: PixelFormat;
        let bufferSize: number;
        let inputBuffers: NumberArray[];

        switch (spp) {
            case 1:
                {
                    // grayscale
                    const [v] = (await image.readRasters({
                        pool: geotiffWorkerPool,
                    })) as NumberArray[];
                    format = RGFormat;
                    bufferSize = width * height * 2;
                    inputBuffers = [v];
                }
                break;
            case 2:
                {
                    // grayscale with alpha
                    const [v, a] = (await image.readRasters({
                        pool: geotiffWorkerPool,
                    })) as NumberArray[];
                    format = RGFormat;
                    bufferSize = width * height * 2;
                    inputBuffers = [v, a];
                }
                break;
            case 3:
                {
                    // RGB
                    const [r, g, b] = (await image.readRasters({
                        pool: geotiffWorkerPool,
                    })) as NumberArray[];
                    format = RGBAFormat;
                    bufferSize = width * height * 4;
                    inputBuffers = [r, g, b];
                }
                break;
            case 4:
                {
                    // RGBA
                    const [r, g, b, a] = (await image.readRasters({
                        pool: geotiffWorkerPool,
                    })) as NumberArray[];
                    format = RGBAFormat;
                    bufferSize = width * height * 4;
                    inputBuffers = [r, g, b, a];
                }
                break;
            default:
                throw new Error(`unsupported channel count: ${spp}`);
        }

        const fillResult = TextureGenerator.fillBuffer({
            bufferSize,
            dataType,
            nodata,
            opaqueValue,
            input: inputBuffers,
        });

        let texture: Texture;

        if (fillResult.isTransparent) {
            texture = new EmptyTexture();
        } else {
            texture = new DataTexture(fillResult.buffer, width, height, format, dataType);
            texture.magFilter = LinearFilter;
            texture.minFilter = LinearFilter;
            texture.needsUpdate = true;
        }

        return { texture, min: fillResult.min, max: fillResult.max };
    }
}

export default GeoTIFFFormat;
