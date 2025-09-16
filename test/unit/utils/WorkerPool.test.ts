/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it, vitest } from 'vitest';

import type { BaseMessageMap, PoolWorker } from '@giro3d/giro3d/utils/WorkerPool';

import WorkerPool from '@giro3d/giro3d/utils/WorkerPool';

type TestWorker = PoolWorker;

type MessageKeys = 'HelloMessage';
interface TestMessageMap extends BaseMessageMap<MessageKeys> {
    HelloMessage: { payload: string; response: string };
}

describe('dispose', () => {
    it('should terminate all workers', () => {
        const workers: TestWorker[] = [];

        const createWorker = () => {
            // @ts-expect-error incomplete
            const worker: TestWorker = {
                postMessage: vitest.fn(),
                addEventListener: vitest.fn(),
                terminate: vitest.fn(),
            };

            workers.push(worker);

            return worker;
        };
        const pool = new WorkerPool<MessageKeys, TestMessageMap>({
            createWorker,
            concurrency: 3,
        });

        pool.queue('HelloMessage', 'hello 1');
        pool.queue('HelloMessage', 'hello 2');
        pool.queue('HelloMessage', 'hello 3');

        expect(workers).toHaveLength(3);

        pool.dispose();
        pool.dispose();
        pool.dispose();

        expect(workers[0].terminate).toHaveBeenCalledTimes(1);
        expect(workers[1].terminate).toHaveBeenCalledTimes(1);
        expect(workers[2].terminate).toHaveBeenCalledTimes(1);
    });
});
describe('queue', () => {
    it('should send the message to the worker', () => {
        // @ts-expect-error incomplete
        const worker: TestWorker = {
            postMessage: vitest.fn(),
            addEventListener: vitest.fn(),
        };

        const createWorker = () => worker;
        const pool = new WorkerPool<MessageKeys, TestMessageMap>({
            createWorker,
            concurrency: 1,
        });

        pool.queue('HelloMessage', 'hello');

        expect(worker.postMessage).toHaveBeenCalledWith(
            { id: 0, type: 'HelloMessage', payload: 'hello' },
            [],
        );
    });

    it('should transmit the correct response to the caller', async () => {
        // @ts-expect-error incomplete
        const worker: TestWorker = {
            postMessage: vitest.fn(),
            addEventListener: (type, listener) => {
                // @ts-expect-error incomplete
                listener({ data: { requestId: 1, payload: 'IGNORE THIS ONE' } });
                // @ts-expect-error incomplete
                listener({ data: { requestId: 0, payload: 'world' } });
            },
            removeEventListener: vitest.fn(),
        };

        const createWorker = () => worker;
        const pool = new WorkerPool<MessageKeys, TestMessageMap>({
            createWorker,
            concurrency: 1,
        });

        const response = await pool.queue('HelloMessage', 'hello');

        expect(response).toEqual('world');
    });
});
