/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { getLazPerfPath } from './config';
import type { LazWorker } from './worker';

// Note: this function has to be in its own file to avoid circular dependencies
// when using webpack (and possibly other bundlers)
// It cannot be in worker.ts nor in config.ts, unfortunately.

export default function createWorker(): Worker {
    const worker: LazWorker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
    });

    worker.postMessage({
        type: 'SetWasmPath',
        path: getLazPerfPath(),
    });

    return worker;
}
