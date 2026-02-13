/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Mock } from 'vitest';

import { afterEach, beforeAll, beforeEach, describe, expect, it, test, vitest } from 'vitest';

import Fetcher from '@giro3d/giro3d/utils/Fetcher';
import HttpConfiguration from '@giro3d/giro3d/utils/HttpConfiguration';
import TextureGenerator from '@giro3d/giro3d/utils/TextureGenerator';

beforeAll(() => {
    // @ts-expect-error property does not exist

    window.Request = function Request(input: RequestInfo | URL, init?: RequestInit) {
        // @ts-expect-error unknown property
        this.url = input;
        // @ts-expect-error unknown property
        this.headers = init?.headers ?? {};
    };
});
afterEach(() => {
    // @ts-expect-error cannot delete fetch
    delete global.fetch;
    // @ts-expect-error property does not exist
    Fetcher._eventTarget._listeners = {};
    HttpConfiguration.clear();
});

describe('FetcherEventDispatcher', () => {
    it('should register & unregister listeners', async () => {
        let events = 0;
        const mycallback = vitest.fn(() => {
            events += 1;
        });

        expect(Fetcher.hasEventListener('error', mycallback)).toBe(false);
        Fetcher._eventTarget.dispatchEvent({ type: 'error', error: new Error('Foo') });
        expect(mycallback).not.toHaveBeenCalled();
        expect(events).toBe(0);

        Fetcher.addEventListener('error', mycallback);
        expect(Fetcher.hasEventListener('error', mycallback)).toBe(true);
        Fetcher._eventTarget.dispatchEvent({ type: 'error', error: new Error('Foo') });
        expect(mycallback).toHaveBeenCalledTimes(1);
        expect(events).toBe(1);
        Fetcher._eventTarget.dispatchEvent({ type: 'error', error: new Error('Foo') });
        expect(mycallback).toHaveBeenCalledTimes(2);
        expect(events).toBe(2);

        Fetcher.removeEventListener('error', mycallback);
        expect(Fetcher.hasEventListener('error', mycallback)).toBe(false);
        expect(mycallback).toHaveBeenCalledTimes(2);
        expect(events).toBe(2);
    });
});

describe('fetch', () => {
    it('honors the number of retries in case of HTTP errors', async () => {
        global.fetch = vitest.fn(() => Promise.resolve({ ok: false })) as Mock;

        const retries = 5;

        await expect(
            Fetcher.fetch('http://example.com', { retries, retryDelay: 0 }),
        ).rejects.toBeDefined();

        expect(global.fetch).toHaveBeenCalledTimes(retries + 1);
    });

    it('should pass the request to the Fetch API', async () => {
        global.fetch = vitest.fn(() => Promise.resolve({ ok: true })) as Mock;

        await expect(Fetcher.fetch('http://example.com')).resolves.toEqual({ ok: true });

        expect(global.fetch).toHaveBeenCalled();
    });

    it('should pass the request to the HttpConfiguration', async () => {
        HttpConfiguration.setAuth('http://example.com', 'the auth');

        global.fetch = vitest.fn(() => Promise.resolve({ ok: true })) as Mock;

        await expect(Fetcher.fetch('http://example.com')).resolves.toEqual({ ok: true });

        expect(global.fetch).toHaveBeenCalledWith(
            {
                url: 'http://example.com',
                headers: {
                    Authorization: 'the auth',
                },
            },
            {
                priority: undefined,
            },
        );
    });

    it('should honor request priority', async () => {
        global.fetch = vitest.fn(() => Promise.resolve({ ok: true })) as Mock;

        await expect(Fetcher.fetch('http://example.com', { priority: 'high' })).resolves.toEqual({
            ok: true,
        });

        expect(global.fetch).toHaveBeenCalledWith(
            { url: 'http://example.com', headers: {} },
            { priority: 'high' },
        );
    });

    it('should honor existing headers', async () => {
        HttpConfiguration.setAuth('http://example.com', 'the auth');

        global.fetch = vitest.fn(() => Promise.resolve({ ok: true })) as Mock;

        const opts = {
            headers: {
                ExistingHeader: 'value',
            },
        };
        await expect(Fetcher.fetch('http://example.com', opts)).resolves.toEqual({ ok: true });

        expect(global.fetch).toHaveBeenCalledWith(
            {
                url: 'http://example.com',
                headers: {
                    Authorization: 'the auth',
                    ExistingHeader: 'value',
                },
            },
            {
                priority: undefined,
            },
        );
    });
});

describe('blob', () => {
    it('should pass the request to the Fetch API', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(new Blob([])),
            }),
        ) as Mock;

        await expect(Fetcher.blob('http://example.com')).resolves.toBeInstanceOf(Blob);

        expect(global.fetch).toHaveBeenCalled();
    });

    it('decoding errors should not be captured', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.reject(new Error('error decoding blob')),
            }),
        ) as Mock;

        let events = 0;
        Fetcher.addEventListener('error', () => {
            events += 1;
        });

        await expect(Fetcher.blob('http://example.com')).rejects.toThrow('error decoding blob');
        expect(events).toBe(0);
    });
});

describe('text', () => {
    it('should pass the request to the Fetch API', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve('Foo'),
            }),
        ) as Mock;

        await expect(Fetcher.text('http://example.com')).resolves.toEqual('Foo');

        expect(global.fetch).toHaveBeenCalled();
    });

    it('decoding errors should not be captured', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.reject(new Error('error decoding text')),
            }),
        ) as Mock;

        let events = 0;
        Fetcher.addEventListener('error', () => {
            events += 1;
        });

        await expect(Fetcher.text('http://example.com')).rejects.toThrow('error decoding text');
        expect(events).toBe(0);
    });
});

describe('json', () => {
    it('should pass the request to the Fetch API', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(JSON.parse('{"foo": "bar"}')),
            }),
        ) as Mock;

        await expect(Fetcher.json('http://example.com')).resolves.toEqual({ foo: 'bar' });

        expect(global.fetch).toHaveBeenCalled();
    });

    it('decoding errors should not be captured', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.reject(new Error('error decoding json')),
            }),
        ) as Mock;

        let events = 0;
        Fetcher.addEventListener('error', () => {
            events += 1;
        });

        await expect(Fetcher.json('http://example.com')).rejects.toThrow('error decoding json');
        expect(events).toBe(0);
    });
});

describe('xml', () => {
    it('should pass the request to the Fetch API', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve('<foo>bar</foo>'),
            }),
        ) as Mock;

        await expect(Fetcher.xml('http://example.com')).resolves.toBeInstanceOf(Document);

        expect(global.fetch).toHaveBeenCalled();
    });

    it('decoding errors should not be captured', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.reject(new Error('error decoding text')),
            }),
        ) as Mock;

        let events = 0;
        Fetcher.addEventListener('error', () => {
            events += 1;
        });

        await expect(Fetcher.xml('http://example.com')).rejects.toThrow('error decoding text');
        expect(events).toBe(0);
    });
});

describe('arrayBuffer', () => {
    it('should pass the request to the Fetch API', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
            }),
        ) as Mock;

        await expect(Fetcher.arrayBuffer('http://example.com')).resolves.toBeInstanceOf(
            ArrayBuffer,
        );

        expect(global.fetch).toHaveBeenCalled();
    });

    it('decoding errors should not be captured', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                arrayBuffer: () => Promise.reject(new Error('error decoding arrayBuffer')),
            }),
        ) as Mock;

        let events = 0;
        Fetcher.addEventListener('error', () => {
            events += 1;
        });

        await expect(Fetcher.arrayBuffer('http://example.com')).rejects.toThrow(
            'error decoding arrayBuffer',
        );
        expect(events).toBe(0);
    });
});

describe('texture', () => {
    beforeEach(() => {
        TextureGenerator.decodeBlob = vitest.fn(() => Promise.resolve('Bar')) as Mock;
    });

    it('should pass the request to the Fetch API', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve('Foo'),
            }),
        ) as Mock;

        await expect(Fetcher.texture('http://example.com')).resolves.toBe('Bar');

        expect(global.fetch).toHaveBeenCalled();
        expect(TextureGenerator.decodeBlob).toHaveBeenCalledWith('Foo', undefined);
    });

    it('decoding errors should not be captured', async () => {
        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.reject(new Error('error decoding blob')),
            }),
        ) as Mock;

        let events = 0;
        Fetcher.addEventListener('error', () => {
            events += 1;
        });

        await expect(Fetcher.texture('http://example.com')).rejects.toThrow('error decoding blob');
        expect(events).toBe(0);
    });
});

describe.each([
    Fetcher.fetch,
    Fetcher.blob,
    Fetcher.text,
    Fetcher.json,
    Fetcher.xml,
    Fetcher.arrayBuffer,
    Fetcher.texture,
])('%p', func => {
    test('should throw if the response is not HTTP Code 2XX', async () => {
        expect.assertions(3);

        global.fetch = vitest.fn(() =>
            Promise.resolve({
                ok: false,
                status: 404,
                statusText: 'Not found',
                url: 'my url',
            }),
        ) as Mock;
        let events = 0;
        Fetcher.addEventListener('error', e => {
            expect(e.error.message).toMatch(/404 Not found - my url/);
            events += 1;
        });

        await expect(func('http://example.com')).rejects.toThrow('404 Not found - my url');
        expect(events).toBe(1);
    });

    test('should throw if fetch fails', async () => {
        expect.assertions(3);

        global.fetch = vitest.fn(() => Promise.reject(new Error('My network error')));
        let events = 0;
        Fetcher.addEventListener('error', e => {
            expect(e.error.message).toMatch(/My network error/);
            events += 1;
        });

        await expect(func('http://example.com')).rejects.toThrow('My network error');
        expect(events).toBe(1);
    });
});
