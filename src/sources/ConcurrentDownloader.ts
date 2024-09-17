import type { FetchOptions } from '../utils/Fetcher';
import Fetcher from '../utils/Fetcher';
import PromiseUtils from '../utils/PromiseUtils';

type RequestData = {
    abortController: AbortController;
    signals: AbortSignal[];
    promise: Promise<Response>;
};

export type FetchCallback = (url: string, options?: FetchOptions) => Promise<Response>;

const keyParts: string[] = [];

function getUniqueKey(url: string, options?: FetchOptions): string {
    keyParts.length = 0;

    if (options?.method != null) {
        keyParts.push(options.method);
    }

    keyParts.push(url);

    if (options) {
        const headers = options.headers;
        if (headers) {
            if (Array.isArray(headers)) {
                headers.forEach(([key, value]) => {
                    keyParts.push(key);
                    keyParts.push(value);
                });
            } else if (typeof (headers as Headers).forEach === 'function') {
                (headers as Headers).forEach((value, key) => {
                    keyParts.push(key);
                    keyParts.push(value);
                });
            } else {
                for (const [key, value] of Object.entries(headers as Record<string, string>)) {
                    keyParts.push(key);
                    keyParts.push(value);
                }
            }
        }

        if (options.cache) {
            keyParts.push(options.cache);
        }
    }

    return keyParts.join(',');
}

/**
 * Helper class to deduplicate concurrent HTTP requests on the same URLs.
 *
 * The main use case is to be able to handle complex cancellation scenarios when a given request
 * can be "owned" by multiple `AbortSignal`s.
 *
 * ### Deduplication
 *
 * The first time a `fetch` request is called for a given URL, the request is actually started.
 * But subsequent calls to `fetch()` will always return the promise of the first call, as long
 * as the first call is still active. In other word, as soon as the request completes, it is removed
 * from the internal cache.
 *
 * ### Cancellation support
 *
 * All subsequent calls to `fetch()` will attach their own `AbortSignal` to the existing request.
 * When _all_ signals for a given request are aborted, then the request is aborted.
 */
export default class ConcurrentDownloader {
    private readonly _requests: Map<string, RequestData> = new Map();
    private readonly _timeout: number;
    private readonly _retry: number;
    private readonly _fetch: FetchCallback;

    constructor(options: {
        /**
         * The timeout, in milliseconds, before a running request is aborted.
         * @defaultValue 5000
         */
        timeout?: number;
        /**
         * The number of retries after receving a non 2XX HTTP code.
         * @defaultValue 3
         */
        retry?: number;
        /**
         * The fetch function to use.
         * @defaultValue {@link Fetcher.fetch}
         */
        fetch?: FetchCallback;
    }) {
        this._timeout = options.timeout ?? 5000;
        this._retry = options.retry ?? 3;
        this._fetch = options.fetch ?? Fetcher.fetch;
    }

    /**
     * Fetches the resource. If a request to the same URL is already started, returns the promise
     * to the first request instead.
     * @param url - The URL to fetch.
     * @param signal - Optional abort signal. If specified, it will be attached to the existing request.
     * Only when _all_ signals attached to this request are aborted, is the request aborted.
     * @returns A response that can be safely reused across multiple calls.
     */
    async fetch(url: string, options?: FetchOptions): Promise<Response> {
        const key = getUniqueKey(url, options);

        const existing = this._requests.get(key);

        const signal = options?.signal;

        signal?.addEventListener('abort', () => {
            const current = this._requests.get(url);
            if (current && current.signals.every(s => s.aborted)) {
                current.abortController.abort(PromiseUtils.abortError());
            }
        });

        if (existing) {
            if (signal) {
                existing.signals.push(signal);
            }

            const originalResponse = await existing.promise;
            return originalResponse.clone();
        }

        const abortController = new AbortController();

        if (this._timeout) {
            setTimeout(() => abortController.abort('timeout'), this._timeout);
        }

        if (options) {
            delete options.signal;
        }

        const data: RequestData = {
            abortController,
            signals: signal ? [signal] : [],
            promise: this._fetch(url, {
                ...options,
                signal: abortController.signal,
                retries: this._retry,
            }).finally(() => this._requests.delete(key)),
        };

        this._requests.set(key, data);

        return data.promise;
    }
}
