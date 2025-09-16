/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { beforeEach, describe, expect, it, vitest } from 'vitest';

import OperationCounter from '@giro3d/giro3d/core/OperationCounter';

let counter: OperationCounter;

beforeEach(() => {
    counter = new OperationCounter();
});

describe('increment', () => {
    it('should set loading to true if it was false', () => {
        expect(counter.loading).toBeFalsy();
        counter.increment();
        expect(counter.loading).toBeTruthy();
        counter.increment();
        expect(counter.loading).toBeTruthy();
    });

    it('should honor the number to increment', () => {
        expect(counter.loading).toBeFalsy();

        counter.increment(3);
        expect(counter.loading).toBeTruthy();

        counter.decrement();
        expect(counter.loading).toBeTruthy();

        counter.decrement();
        expect(counter.loading).toBeTruthy();

        counter.decrement();
        expect(counter.loading).toBeFalsy();
    });
});

describe('wrap', () => {
    it('should increment and decrement accordingly', async () => {
        const promise = new Promise<void>(resolve => {
            resolve();
        });

        expect(counter.progress).toEqual(1);

        const wrapped = counter.wrap(promise);

        expect(counter.progress).toEqual(0);

        await wrapped;

        expect(counter.progress).toEqual(1);
    });

    it('should increment and decrement even if promise rejects', async () => {
        try {
            await counter.wrap(
                new Promise<void>((_, reject) => {
                    reject();
                }),
            );
        } catch {
            // Do nothing
        } finally {
            expect(counter.progress).toEqual(1);
        }
    });
});

describe('decrement', () => {
    it('should do nothing if no operation is running', () => {
        let shouldNotHappen = false;

        counter.addEventListener('changed', () => (shouldNotHappen = true));

        counter.decrement();

        expect(shouldNotHappen).toEqual(false);
    });
    it('should set loading to false if task count reaches zero', () => {
        counter.increment();
        counter.increment();
        counter.increment();

        counter.decrement();
        expect(counter.loading).toBeTruthy();
        counter.decrement();
        expect(counter.loading).toBeTruthy();
        counter.decrement();
        expect(counter.loading).toBeFalsy();
    });

    it('should fire the complete event if the task count reaches zero', () => {
        const listener = vitest.fn();
        counter.addEventListener('complete', listener);

        counter.increment();
        counter.increment();
        counter.increment();

        counter.decrement();
        expect(listener).not.toHaveBeenCalled();
        counter.decrement();
        expect(listener).not.toHaveBeenCalled();
        counter.decrement();
        expect(listener).toHaveBeenCalled();
    });
});

describe('progress', () => {
    it('should be 1 if no task is pending', () => {
        expect(counter.progress).toEqual(1);

        counter.increment();
        counter.increment();
        counter.decrement();
        counter.increment();
        counter.decrement();
        counter.decrement();

        expect(counter.progress).toEqual(1);
    });

    it('should be zero if no task has been completed', () => {
        counter.increment();
        counter.increment();
        counter.increment();
        counter.increment();

        expect(counter.progress).toEqual(0);
    });

    it('should be the ratio between completed tasks and total tasks', () => {
        const total = 12;
        const completed = 5;

        for (let i = 0; i < total; i++) {
            counter.increment();
        }

        for (let i = 0; i < completed; i++) {
            counter.decrement();
        }

        expect(counter.progress).toEqual(5 / 12);
    });
});
