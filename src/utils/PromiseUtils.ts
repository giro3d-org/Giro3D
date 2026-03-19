/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Returns a promise that will resolve after the specified duration.
 *
 * @param duration - The duration, in milliseconds.
 * @returns The promise.
 */
function delay(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
}

function nextFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(_ => resolve()));
}

export enum PromiseStatus {
    Fullfilled = 'fulfilled',
    Rejected = 'rejected',
}

export class AbortError extends Error {
    public constructor() {
        super('aborted');
        this.name = 'AbortError';
    }
}

/**
 * Returns an Error with the 'aborted' reason.
 *
 * @returns The error.
 */
function abortError(): Error {
    return new AbortError();
}

const SLICE_DURATION_MILLISECONDS = 4;

function batch<I, O>(
    items: I[],
    transformer: (obj: I, index: number) => O | null,
    options?: {
        outputItems?: O[];
        start?: number;
        signal?: AbortSignal;
    },
): Promise<O[]> {
    const result: O[] = options?.outputItems ?? [];

    const processSlice = (start: number): Promise<number | undefined> => {
        const begin = performance.now();

        for (let i = start; i < items.length; i++) {
            const input = items[i];
            const output = transformer(input, i);

            if (output != null) {
                result.push(output);
            }

            const elapsed = performance.now() - begin;

            if (elapsed > SLICE_DURATION_MILLISECONDS) {
                const nextStart = i + 1;
                return Promise.resolve(nextStart);
            }
        }

        options?.signal?.throwIfAborted();

        return Promise.resolve(undefined);
    };

    return processSlice(options?.start ?? 0).then(async nextStart => {
        if (nextStart != null) {
            options?.signal?.throwIfAborted();

            await batch(items, transformer, {
                outputItems: result,
                signal: options?.signal,
                start: nextStart,
            });
        }
        return result;
    });
}

export default {
    delay,
    PromiseStatus,
    abortError,
    nextFrame,
    batch,
};
