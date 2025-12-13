/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type Disposable from '../core/Disposable';
import type Progress from '../core/Progress';

import OperationCounter from '../core/OperationCounter';

/**
 * A message to send to the worker.
 */
export interface Message<T = unknown> {
    /**
     * The unique id of this message. Used to match the response to the original message.
     */
    id: number;
    type: string;
    payload: T;
}

export interface BaseResponse {
    requestId: number;
}
export interface SuccessResponse<T = unknown> extends BaseResponse {
    payload: T;
}
export interface ErrorResponse extends BaseResponse {
    error: string;
}
export type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;

export class WorkerError extends Error {
    public readonly messageId: number;

    public constructor(messageId: number, message: string) {
        super(message);
        this.messageId = messageId;
    }
}

export interface PoolWorker {
    terminate(): void;
    postMessage(message: Message, transfer: Transferable[]): void;
    addEventListener(type: 'message', listener: (ev: MessageEvent<Response>) => void): void;
    removeEventListener(type: 'message', listener: (ev: MessageEvent<Response>) => void): void;
}

export function createErrorResponse(requestId: number, error: unknown): Response {
    return {
        requestId,
        error: error instanceof Error ? error.message : 'unknown error',
    };
}

interface WorkerWrapper {
    counter: OperationCounter;
    worker: PoolWorker;
    idleTimeout: NodeJS.Timeout | null;
}

export type BaseMessageMap<K extends string> = Record<K, { payload: unknown; response: unknown }>;

/**
 * A simple Web Worker pool that can select idle workers to perform work.
 *
 * Additionally, idle workers are terminated after a delay to free resources.
 *
 * @typeParam TMessageType - The type of the messages supported by the workers.
 * @typeParam TMessageMap - The map between request and response messages.
 */
export default class WorkerPool<
    TMessageType extends string,
    TMessageMap extends BaseMessageMap<TMessageType>,
>
    implements Disposable, Progress
{
    private readonly _concurrency: number;
    private readonly _workers: Set<WorkerWrapper> = new Set();
    private readonly _createWorker: () => PoolWorker;
    private _disposed = false;
    private _terminationDelay: number;

    private _messageId = 0;

    public get loading(): boolean {
        let result = false;
        this._workers.forEach(w => {
            if (w.counter.loading) {
                result = true;
            }
        });

        return result;
    }

    public get progress(): number {
        let sum = 0;
        this._workers.forEach(w => {
            sum += w.counter.progress;
        });

        return sum / this._workers.size;
    }

    public constructor(options: {
        /**
         * The function to create a worker.
         */
        createWorker: () => PoolWorker;
        /**
         * Optional concurrency (i.e max number of simultaneous workers)
         * @defaultValue `navigator.hardwareConcurrency`
         */
        concurrency?: number;
        /**
         * The delay, in milliseconds, after which an idle worker is terminated.
         * @defaultValue 10000
         */
        terminationDelay?: number;
    }) {
        this._createWorker = options.createWorker;
        this._terminationDelay = options.terminationDelay ?? 10000;

        if (options.concurrency != null) {
            this._concurrency = options.concurrency;
        } else {
            this._concurrency = WorkerPool.defaultConcurrency;
        }
    }

    public static get defaultConcurrency(): number {
        if (typeof window !== 'undefined' && window.navigator != null) {
            return window.navigator.hardwareConcurrency;
        } else {
            return 1;
        }
    }

    /**
     * Sends a message to the first available worker, then waits for a response matching this
     * message's id, then returns this response, or throw an error if an error response is received.
     */
    public queue<K extends keyof TMessageMap>(
        type: K,
        payload: TMessageMap[K]['payload'],
        transfer?: Transferable[],
    ): Promise<TMessageMap[K]['response']> {
        if (this._disposed) {
            throw new Error('this object is disposed');
        }

        const wrapper = this.getWorker();

        wrapper.counter.increment();

        if (wrapper.idleTimeout) {
            clearTimeout(wrapper.idleTimeout);
            wrapper.idleTimeout = null;
        }

        const worker = wrapper.worker;

        const message: Message<TMessageMap[K]['payload']> = {
            id: this._messageId++,
            payload,
            type: type as string,
        };

        return new Promise((resolve, reject) => {
            // eslint-disable-next-line prefer-const
            let stopListening: () => void;

            const onResponse = (event: MessageEvent<Response>): void => {
                const response = event.data;

                if (response.requestId === message.id) {
                    stopListening();

                    if ('error' in response) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response.payload as TMessageMap[K]['response']);
                    }
                }
            };

            stopListening = (): void => {
                wrapper.counter.decrement();

                // The worker is idle, start the termination timeout. It will be cancelled
                // if the worker becomes busy again before the timeout finishes.
                if (!wrapper.counter.loading) {
                    this.startWorkerTerminationTimeout(wrapper);
                }

                worker.removeEventListener('message', onResponse);
            };

            worker.addEventListener('message', onResponse);
            worker.postMessage(message, transfer ?? []);
        });
    }

    /**
     * Terminates all workers.
     */
    public dispose(): void {
        if (this._disposed) {
            return;
        }

        this._disposed = true;

        this._workers.forEach(w => w.worker.terminate());
    }

    private startWorkerTerminationTimeout(wrapper: WorkerWrapper): void {
        const worker = wrapper.worker;
        wrapper.idleTimeout = setTimeout(() => {
            worker.terminate();
            this._workers.delete(wrapper);
        }, this._terminationDelay);
    }

    private createWorker(): WorkerWrapper {
        const worker = this._createWorker();

        const wrapper: WorkerWrapper = {
            counter: new OperationCounter(),
            worker,
            idleTimeout: null,
        };

        this._workers.add(wrapper);

        return wrapper;
    }

    private getWorker(): WorkerWrapper {
        // Create the first worker.
        if (this._workers.size === 0) {
            return this.createWorker();
        }

        const workers = [...this._workers];

        // Attempt to return the first idle worker.
        const idle = workers.find(w => !w.counter.loading);

        if (idle) {
            return idle;
        }

        // No idle worker, create one if possible.
        if (this._workers.size < this._concurrency) {
            return this.createWorker();
        }

        // All workers are busy and impossible to create one, just return the least busy.
        workers.sort((a, b) => a.counter.operations - b.counter.operations);

        const leastBusy = workers[0];

        return leastBusy;
    }
}
