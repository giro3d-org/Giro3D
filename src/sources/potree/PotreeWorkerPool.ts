/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { MessageMap, MessageType } from './worker';

import WorkerPool from '../../utils/WorkerPool';

function createWorker(): Worker {
    const worker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
    });

    return worker;
}

export default class PotreeWorkerPool extends WorkerPool<MessageType, MessageMap> {
    private static _singleton: PotreeWorkerPool | null = null;

    private static async create(): Promise<PotreeWorkerPool> {
        this._singleton = new PotreeWorkerPool({
            createWorker,
        });

        return this._singleton;
    }

    public static async get(): Promise<PotreeWorkerPool> {
        if (this._singleton != null) {
            return this._singleton;
        }

        return this.create();
    }
}
