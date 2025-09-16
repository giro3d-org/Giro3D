/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type Progress from '../../core/Progress';
import type { FetchOptions } from '../../utils/Fetcher';

import OperationCounter from '../../core/OperationCounter';
import Fetcher from '../../utils/Fetcher';

/**
 * A plugin that routes HTTP calls to the Giro3D Fetcher.
 */
export default class FetchPlugin implements Progress {
    private readonly _opCounter = new OperationCounter();

    public get loading(): boolean {
        return this._opCounter.loading;
    }

    public get progress(): number {
        return this._opCounter.progress;
    }

    public fetchData(url: RequestInfo | URL, options: FetchOptions): Promise<Response> {
        this._opCounter.increment();
        return Fetcher.fetch(url, options).finally(() => this._opCounter.decrement());
    }
}
