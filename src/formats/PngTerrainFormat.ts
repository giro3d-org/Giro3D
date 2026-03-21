/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { DataTexture, FloatType, LinearFilter, RGFormat } from 'three';

import type { DecodeOptions, DecodeResult } from './ImageFormat';
import type { DecodeTerrainResult, Encoding, MessageMap, MessageType } from './mapboxWorker';

import WorkerPool from '../utils/WorkerPool';
import ImageFormat from './ImageFormat';
import { decodeTerrainImage } from './mapboxWorker';

let workerPool: WorkerPool<MessageType, MessageMap> | null = null;

function createWorker(): Worker {
    return new Worker(new URL('./mapboxWorker.js', import.meta.url), {
        type: 'module',
        name: 'mapbox',
    });
}

class PngTerrainFormat extends ImageFormat {
    private readonly _enableWorkers: boolean = true;
    private readonly _workerConcurrency: number | undefined;
    private readonly _encoding: Encoding;

    /**
     * @param options - Decoder options.
     */
    public constructor(options: {
        /**
         * Enables processing raster data in web workers.
         * @defaultValue true
         */
        enableWorkers?: boolean;
        encoding: Encoding;
        /**
         * The maximum number of workers created by the worker pool.
         * If `undefined`, the maximum number of workers will be allowed.
         * @defaultValue undefined
         */
        workerConcurrency?: number;
    }) {
        super(true, FloatType);

        this._encoding = options.encoding;
        this._enableWorkers = options.enableWorkers ?? true;
        this._workerConcurrency = options.workerConcurrency ?? undefined;
    }

    /**
     * Decode a Mapbox Terrain blob into a
     * [DataTexture](https://threejs.org/docs/?q=texture#api/en/textures/DataTexture) containing
     * the elevation data.
     *
     * @param blob - the data to decode
     * @param options - the decoding options
     */
    public async decode(blob: Blob, options?: DecodeOptions): Promise<DecodeResult> {
        let result: DecodeTerrainResult;

        if (this._enableWorkers) {
            result = await this.getHeightValuesUsingWorker(
                blob,
                options?.noDataValue,
                this._workerConcurrency,
            );
        } else {
            result = await decodeTerrainImage(blob, this._encoding, options?.noDataValue);
        }

        const texture = new DataTexture(
            new Float32Array(result.data),
            result.width,
            result.height,
            RGFormat,
            FloatType,
        );

        texture.needsUpdate = true;
        texture.generateMipmaps = false;
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;

        return {
            texture,
            min: result.min,
            max: result.max,
        };
    }

    private async getHeightValuesUsingWorker(
        blob: Blob,
        noData?: number,
        concurrency?: number,
    ): Promise<DecodeTerrainResult> {
        if (workerPool == null) {
            workerPool = new WorkerPool({ createWorker, concurrency });
        }

        const buffer = await blob.arrayBuffer();

        const result = await workerPool.queue(
            'DecodeTerrainMessage',
            { buffer, encoding: this._encoding, noData },
            [buffer],
        );

        return result;
    }
}

export default PngTerrainFormat;
