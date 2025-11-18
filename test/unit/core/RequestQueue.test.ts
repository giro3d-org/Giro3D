/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import RequestQueue from '@giro3d/giro3d/core/RequestQueue';
import { AbortError } from '@giro3d/giro3d/utils/PromiseUtils';

describe('progress & loading', () => {
    it('progress should return the ratio between enqueued tasks and executed tasks', async () => {
        const queue = new RequestQueue({ maxConcurrentRequests: 1 });

        expect(queue.loading).toEqual(false);
        expect(queue.progress).toEqual(1);

        let executedTasks = 0;
        const totalTasks = 30;

        queue.addEventListener('task-executed', () => {
            executedTasks++;
        });

        for (let i = 0; i < totalTasks; i++) {
            queue.enqueue({
                id: `${i}`,
                request: () => Promise.resolve(),
            });
        }

        while (executedTasks < totalTasks) {
            expect(queue.loading).toEqual(true);
            expect(queue.progress).toBeCloseTo(executedTasks / totalTasks, 1);

            await null;
        }

        expect(queue.progress).toEqual(1);
        expect(queue.loading).toEqual(false);
    });
});

describe('enqueue', () => {
    it('should return a rejected promise if the shouldExecute() function returned false', async () => {
        const queue = new RequestQueue({ maxConcurrentRequests: 1 });

        await expect(
            queue.enqueue({
                id: 'foo',
                request: () => Promise.resolve(),
                shouldExecute: () => false,
            }),
        ).rejects.toEqual(new AbortError());
    });

    it('should return a rejected promise if the signal was aborted', async () => {
        const queue = new RequestQueue({ maxConcurrentRequests: 1 });

        const controller = new AbortController();
        controller.abort();

        await expect(
            queue.enqueue({
                id: 'foo',
                signal: controller.signal,
                request: () => Promise.resolve(),
            }),
        ).rejects.toEqual(new AbortError());
    });

    it('should return an existing promise for the same id', async () => {
        const queue = new RequestQueue({ maxConcurrentRequests: 1 });

        const id = 'uniqueId';

        const promise1 = queue.enqueue({ id, request: () => Promise.resolve() });
        const promise2 = queue.enqueue({ id, request: () => Promise.resolve() });
        const promise3 = queue.enqueue({ id, request: () => Promise.resolve() });

        await promise1;
        await promise2;
        await promise3;

        expect(promise1).toBe(promise2);
        expect(promise1).toBe(promise3);
    });

    it('should infer the return type of the promise', async () => {
        const queue = new RequestQueue({ maxConcurrentRequests: 1 });

        const id = 'uniqueId';

        const request = () => Promise.resolve(1);

        const promise1: Promise<number> = queue.enqueue({ id, request });

        const result = await promise1;

        expect(result).toEqual(1);
    });

    it('should not throw an exception if there are too many tasks that have been cancelled', async () => {
        const queue = new RequestQueue({ maxConcurrentRequests: 1 });

        let id = 0;
        const promisesList: Promise<void>[] = [];
        let tasksInSuccessCount = 0;
        let tasksInErrorCount = 0;

        // fill the queue
        for (let i = 0; i < 2; i++) {
            promisesList.push(
                queue
                    .enqueue({
                        id: `${id++}`,
                        request: () => new Promise(resolve => setTimeout(resolve, 100)),
                    })
                    .then(() => {
                        tasksInSuccessCount++;
                    })
                    .catch(() => {
                        tasksInErrorCount++;
                    }),
            );
        }

        // add lots of tasks that are cancelled
        for (let i = 0; i < 10000; i++) {
            promisesList.push(
                queue
                    .enqueue({
                        id: `${id++}`,
                        request: () => Promise.resolve(),
                        shouldExecute: () => false,
                    })
                    .then(() => {
                        tasksInSuccessCount++;
                    })
                    .catch(() => {
                        tasksInErrorCount++;
                    }),
            );
        }

        // add a few other tasks just to make sure they are executed
        for (let i = 0; i < 3; i++) {
            promisesList.push(
                queue
                    .enqueue({
                        id: `${id++}`,
                        request: () =>
                            new Promise<void>(resolve =>
                                setTimeout(() => {
                                    console.log('success');
                                    resolve();
                                }, 100),
                            ),
                    })
                    .then(() => {
                        tasksInSuccessCount++;
                    })
                    .catch(() => {
                        tasksInErrorCount++;
                    }),
            );
        }

        try {
            await Promise.all(promisesList);
            expect(tasksInSuccessCount).toBe(2 + 3);
            expect(tasksInErrorCount).toBe(10000);
        } catch (error: unknown) {
            expect.fail(`There was an uncaught error: ${error}`);
        }
    });
});
