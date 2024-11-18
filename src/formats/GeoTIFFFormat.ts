import { fromBlob, Pool } from 'geotiff';
import type { TypedArray } from 'three';
import { FloatType, UnsignedByteType } from 'three';
import TextureGenerator from '../utils/TextureGenerator';
import type { DecodeOptions } from './ImageFormat';
import ImageFormat from './ImageFormat';

let geotiffWorkerPool: Pool;

/**
 * Decoder for TIFF images.
 *
 */
class GeoTIFFFormat extends ImageFormat {
    readonly isGeoTIFFFormat: boolean = true as const;
    readonly type = 'GeoTIFFFormat';

    private readonly _enableWorkers: boolean;

    /**
     * @param options - Decoder options.
     */
    constructor(options?: {
        /**
         * Enables processing raster data in web workers.
         * @defaultValue true
         */
        enableWorkers?: boolean;
    }) {
        super(true, FloatType);

        this._enableWorkers = options?.enableWorkers ?? true;
    }

    /**
     * Decode a tiff blob into a
     * [DataTexture](https://threejs.org/docs/?q=texture#api/en/textures/DataTexture) containing
     * the elevation data.
     *
     * @param blob - the data to decode
     * @param options - the decoding options
     */

    async decode(blob: Blob, options?: DecodeOptions) {
        const tiff = await fromBlob(blob);
        const image = await tiff.getImage();

        const height = image.getHeight();
        const width = image.getWidth();

        let dataType;
        const nodata = options?.noDataValue ?? image.getGDALNoData() ?? undefined;

        if (image.getBitsPerSample() === 8) {
            dataType = UnsignedByteType;
        } else {
            dataType = FloatType;
        }

        const spp = image.getSamplesPerPixel();

        // Let's use web workers to decode TIFF in the background
        if (window.Worker != null && geotiffWorkerPool == null) {
            geotiffWorkerPool = new Pool();
        }

        let inputBuffers: TypedArray[];

        switch (spp) {
            case 1:
                {
                    // grayscale
                    const [v] = (await image.readRasters({
                        pool: geotiffWorkerPool,
                    })) as TypedArray[];
                    inputBuffers = [v];
                }
                break;
            case 2:
                {
                    // grayscale with alpha
                    const [v, a] = (await image.readRasters({
                        pool: geotiffWorkerPool,
                    })) as TypedArray[];
                    inputBuffers = [v, a];
                }
                break;
            case 3:
                {
                    // RGB
                    const [r, g, b] = (await image.readRasters({
                        pool: geotiffWorkerPool,
                    })) as TypedArray[];
                    inputBuffers = [r, g, b];
                }
                break;
            case 4:
                {
                    // RGBA
                    const [r, g, b, a] = (await image.readRasters({
                        pool: geotiffWorkerPool,
                    })) as TypedArray[];
                    inputBuffers = [r, g, b, a];
                }
                break;
            default:
                throw new Error(`unsupported channel count: ${spp}`);
        }

        const result = await TextureGenerator.createDataTextureAsync(
            { width, height, nodata, enableWorkers: this._enableWorkers },
            dataType,
            ...inputBuffers,
        );

        return { texture: result.texture, min: result.min, max: result.max };
    }
}

export default GeoTIFFFormat;
