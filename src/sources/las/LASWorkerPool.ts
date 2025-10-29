/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { MessageMap, MessageType } from './worker';

import Fetcher from '../../utils/Fetcher';
import WorkerPool from '../../utils/WorkerPool';
import { getLazPerfPath } from './config';
import createWorker from './createWorker';

/**
 * A global singleton worker pool that provides LAS processing workers.
 */
export default class LASWorkerPool extends WorkerPool<MessageType, MessageMap> {
    private constructor(wasmBinary: ArrayBuffer, concurrency?: number) {
        super({
            createWorker: createWorker(wasmBinary),
            concurrency,
        });
    }

    private static _wasmBinary: ArrayBuffer | null = null;
    private static _singleton: LASWorkerPool | null = null;

    /**
     * Returns the singleton worker pool, creating it if necessary.
     */
    public static async get(): Promise<LASWorkerPool> {
        if (this._singleton != null) {
            return this._singleton;
        }

        return this.createSingleton();
    }

    private static async createSingleton(): Promise<LASWorkerPool> {
        // Ensure that the .wasm file is loaded only once per session,
        // then send the data to each worker. This avoids many HTTP requests.
        if (this._wasmBinary == null) {
            const url = `${getLazPerfPath()}/laz-perf.wasm`;
            this._wasmBinary = await Fetcher.arrayBuffer(url);
        }

        this._singleton = new LASWorkerPool(this._wasmBinary);

        return this._singleton;
    }
}
