import OperationCounter from '../../core/OperationCounter';
import type Progress from '../../core/Progress';
import type { FetchOptions } from '../../utils/Fetcher';
import Fetcher from '../../utils/Fetcher';

/**
 * A plugin that routes HTTP calls to the Giro3D Fetcher.
 */
export default class FetchPlugin implements Progress {
    private readonly _opCounter = new OperationCounter();

    get loading(): boolean {
        return this._opCounter.loading;
    }

    get progress(): number {
        return this._opCounter.progress;
    }

    fetchData(url: RequestInfo | URL, options: FetchOptions) {
        this._opCounter.increment();
        return Fetcher.fetch(url, options).finally(() => this._opCounter.decrement());
    }
}
