import { DataTexture, FloatType, LinearFilter, RGFormat } from 'three';
import WorkerPool from '../utils/WorkerPool';
import type { DecodeOptions } from './ImageFormat';
import ImageFormat from './ImageFormat';
import type { DecodeBilTerrainResult, MessageMap, MessageType } from './bilWorker';
import { decodeRaster } from './bilWorker';

let workerPool: WorkerPool<MessageType, MessageMap> | null = null;

function createWorker() {
    return new Worker(new URL('./bilWorker.js', import.meta.url), {
        type: 'module',
        name: 'bil',
    });
}

/**
 * Decoder for [BIL](https://desktop.arcgis.com/en/arcmap/10.3/manage-data/raster-and-images/bil-bip-and-bsq-raster-files.htm) images.
 *
 * At the moment, only single band BIL files are supported and it is tested only on IGN elevation
 * WMS and WMTS layers.
 *
 * ```js
 *  // Create an elevation source
 * const source = new WmsSource({
 *     url: 'https://data.geopf.fr/wms-r',
 *     projection: 'EPSG:2154',
 *     layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
 *     imageFormat: 'image/x-bil;bits=32',
 *     format: new BilFormat(),
 * });
 *
 * const elevationLayer = new ElevationLayer({ source });
 *
 * map.addLayer(elevationLayer);
 *
 * ```
 * [See it in action](/examples/ign_ortho_elevation.html).
 *
 */
class BilFormat extends ImageFormat {
    readonly isBilFormat: boolean = true as const;
    readonly type = 'BilFormat' as const;

    private _enableWorkers: boolean = true;

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
     * Decode a Bil blob into a
     * [DataTexture](https://threejs.org/docs/?q=texture#api/en/textures/DataTexture) containing
     * the elevation data. At the moment only one band BIL is supported.
     *
     * @param blob - the data to decode
     * @param options - the decoding options
     */

    async decode(blob: Blob, options: DecodeOptions) {
        const buffer = await blob.arrayBuffer();
        const floatArray = new Float32Array(buffer);

        const noData = options?.noDataValue;
        let result: DecodeBilTerrainResult;

        if (this._enableWorkers) {
            if (workerPool == null) {
                workerPool = new WorkerPool({ createWorker });
            }

            result = await workerPool.queue('DecodeBilTerrainMessage', { buffer, noData });
        } else {
            result = decodeRaster(floatArray, noData);
        }

        const texture = new DataTexture(
            new Float32Array(result.data),
            options.width,
            options.height,
            RGFormat,
            FloatType,
        );

        texture.needsUpdate = true;
        texture.generateMipmaps = false;
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;

        return { texture, min: result.min, max: result.max };
    }
}

export default BilFormat;
