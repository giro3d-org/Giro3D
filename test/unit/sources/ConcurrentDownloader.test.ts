/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { FetchCallback } from '@giro3d/giro3d/sources/ConcurrentDownloader';
import ConcurrentDownloader from '@giro3d/giro3d/sources/ConcurrentDownloader';
import PromiseUtils from '@giro3d/giro3d/utils/PromiseUtils';
import { describe, expect, it } from 'vitest';

const URL = 'http://example.com/foo';

function failClone(): Response {
    throw new Error('fail');
}

const clonedResponse = {
    status: 200,
    statusText: 'ok',
    clone: failClone,
} as Response;

const response = {
    status: 200,
    statusText: 'ok',
    clone: () => clonedResponse,
} as Response;

const defaultFetch: FetchCallback = () => Promise.resolve(response);

describe('fetch', () => {
    it('should return a cloned response', async () => {
        const dl = new ConcurrentDownloader({ fetch: defaultFetch });

        const res1 = dl.fetch(URL);
        const res2 = dl.fetch(URL);

        expect(await res1).not.toBe(await res2);
        expect(await res2).toBe(clonedResponse);
    });

    it('should handle timeouts', async () => {
        let aggregateSignal: AbortSignal;

        const response = {
            status: 200,
            statusText: 'ok',
            clone: () => response,
        } as Response;

        const fetch: FetchCallback = (url, options) => {
            aggregateSignal = options!.signal!;
            return Promise.resolve(response);
        };

        const timeout = 1000;

        const dl = new ConcurrentDownloader({ fetch, timeout });

        dl.fetch(URL);
        dl.fetch(URL);

        expect(aggregateSignal!.aborted).toEqual(false);

        await PromiseUtils.delay(timeout * 2);

        expect(aggregateSignal!.aborted).toEqual(true);
        expect(aggregateSignal!.reason).toEqual('timeout');
    });

    it('should abort the deduplicated request when *all* requests are aborted', () => {
        let aggregateSignal: AbortSignal;

        const response = {
            status: 200,
            statusText: 'ok',
            clone: () => response,
        } as Response;

        const fetch: FetchCallback = (url, options) => {
            aggregateSignal = options!.signal!;
            return Promise.resolve(response);
        };

        const dl = new ConcurrentDownloader({ fetch });

        const abort1 = new AbortController();
        const abort2 = new AbortController();
        const abort3 = new AbortController();

        dl.fetch(URL, { signal: abort1.signal });
        dl.fetch(URL, { signal: abort2.signal });
        dl.fetch(URL, { signal: abort3.signal });

        expect(aggregateSignal!).not.toBe(abort1.signal);
        expect(aggregateSignal!).not.toBe(abort2.signal);
        expect(aggregateSignal!).not.toBe(abort3.signal);

        expect(aggregateSignal!.aborted).toEqual(false);

        abort1.abort();
        expect(aggregateSignal!.aborted).toEqual(false);

        abort2.abort();
        expect(aggregateSignal!.aborted).toEqual(false);

        abort3.abort();
        expect(aggregateSignal!.aborted).toEqual(true);
        expect(aggregateSignal!.reason.name).toEqual('AbortError');
    });
});
