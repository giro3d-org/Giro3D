/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import PngTerrainFormat from './PngTerrainFormat';

/**
 * Decoder for [Mapzen Terrarium](https://www.mapzen.com/blog/terrain-tile-service/) tiles.
 */
class MapzenTerrariumFormat extends PngTerrainFormat {
    public readonly isMapzenTerrariumFormat: boolean = true as const;
    public override readonly type = 'MapzenTerrariumFormat' as const;

    /**
     * @param options - Decoder options.
     */
    public constructor(options?: {
        /**
         * Enables processing raster data in web workers.
         * @defaultValue true
         */
        enableWorkers?: boolean;
        /**
         * The maximum number of workers created by the worker pool.
         * If `undefined`, the maximum number of workers will be allowed.
         * @defaultValue undefined
         */
        workerConcurrency?: number;
    }) {
        super({
            workerConcurrency: options?.workerConcurrency,
            encoding: 'MapzenTerrarium',
            enableWorkers: options?.enableWorkers,
        });
    }
}

export default MapzenTerrariumFormat;
