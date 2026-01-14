/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import PriorityQueue from 'ol/structs/PriorityQueue';
import { EventDispatcher, MathUtils } from 'three';

import type Progress from './Progress';

import PromiseUtils from '../utils/PromiseUtils';
import OperationCounter from './OperationCounter';

function defaultShouldExecute(): boolean {
    return true;
}

class Task {
    public readonly id: string;
    private readonly _priority: number;
    private readonly _signal?: AbortSignal;
    private readonly _resolve: (arg: unknown) => void;
    private readonly _request: () => Promise<unknown>;

    public readonly reject: (reason?: unknown) => void;
    public readonly shouldExecute: () => boolean;

    public constructor(
        id: string,
        priority: number,
        request: () => Promise<unknown>,
        resolve: (arg: unknown) => void,
        reject: (reason?: unknown) => void,
        shouldExecute: (() => boolean) | undefined,
        signal: AbortSignal | undefined,
    ) {
        this.id = id;
        this._priority = priority;
        this._signal = signal;
        this._resolve = resolve;
        this.reject = reject;
        this._request = request;
        this.shouldExecute = shouldExecute ?? defaultShouldExecute;
    }

    public getKey(): string {
        return this.id;
    }

    public getPriority(): number {
        if (this._signal?.aborted === true) {
            // means "drop the request"
            return Infinity;
        }

        return this._priority;
    }

    public execute(): Promise<unknown> {
        if (this._signal?.aborted === true) {
            this.reject(PromiseUtils.abortError());
            return Promise.reject();
        }

        return this._request()
            .then(x => this._resolve(x))
            .catch(e => this.reject(e));
    }
}

function priorityFn(task: Task): number {
    return task.getPriority();
}

function keyFn(task: Task): string {
    return task.getKey();
}

const MAX_CONCURRENT_REQUESTS = 10;

export interface RequestQueueEvents {
    /**
     * Raised when a task has been executed.
     */
    'task-executed': unknown;
    /**
     * Raised when a task has been cancelled.
     */
    'task-cancelled': unknown;
}

/**
 * A generic priority queue that ensures that the same request cannot be added twice in the queue.
 */
class RequestQueue extends EventDispatcher<RequestQueueEvents> implements Progress {
    private readonly _pendingIds: Map<string, Promise<unknown>>;
    private readonly _queue: PriorityQueue<Task>;
    private readonly _opCounter: OperationCounter;
    private readonly _maxConcurrentRequests: number;

    private _concurrentRequests: number;

    /**
     * @param options - Options.
     */
    public constructor(
        options: {
            /** The maximum number of concurrent requests. */
            maxConcurrentRequests?: number;
        } = {},
    ) {
        super();
        this._pendingIds = new Map();
        this._queue = new PriorityQueue(priorityFn, keyFn);
        this._opCounter = new OperationCounter();
        this._concurrentRequests = 0;
        this._maxConcurrentRequests = options.maxConcurrentRequests ?? MAX_CONCURRENT_REQUESTS;
    }

    public get length(): number {
        return this._queue.getCount();
    }

    public get progress(): number {
        return this._opCounter.progress;
    }

    public get loading(): boolean {
        return this._opCounter.loading;
    }

    public get pendingRequests(): number {
        return this._pendingIds.size;
    }

    public get concurrentRequests(): number {
        return this._concurrentRequests;
    }

    public onQueueAvailable(): void {
        while (this._concurrentRequests < this._maxConcurrentRequests) {
            if (this._queue.isEmpty()) {
                break;
            }

            const task = this._queue.dequeue();
            const key = task.getKey();

            if (task.shouldExecute()) {
                this._concurrentRequests++;
                task.execute()
                    .catch(e => task.reject(e))
                    .finally(() => {
                        this._opCounter.decrement();
                        this._pendingIds.delete(key);
                        this._concurrentRequests--;
                        this.onQueueAvailable();
                        this.dispatchEvent({ type: 'task-executed' });
                    });
            } else {
                this._opCounter.decrement();
                this._pendingIds.delete(key);
                task.reject(PromiseUtils.abortError());
                this.dispatchEvent({ type: 'task-cancelled' });
            }
        }
    }

    /**
     * Enqueues a request. If a request with the same id is currently in the queue, then returns
     * the promise associated with the existing request.
     *
     * @param options - Options.
     * @returns A promise that resolves when the requested is completed.
     * @throws `AbortError` if the request is aborted before being started (either because
     * the `AbortSignal` became aborted, or if the `shouldExecute()` function returned `true`.
     */
    public enqueue<T>(options: {
        /** The unique identifier of this request. */
        id: string;
        /** The request. */
        request: () => Promise<T>;
        /** The abort signal. */
        signal?: AbortSignal;
        /** The priority of this request. */
        priority?: number;
        /** The optional predicate used to discard a task: if the function returns `false`,
         * the task is not executed. */
        shouldExecute?: () => boolean;
    }): Promise<T> {
        const { id, request, signal, shouldExecute } = options;

        const priority = options.priority ?? 0;

        if (signal?.aborted === true) {
            return Promise.reject(PromiseUtils.abortError());
        }

        if (this._pendingIds.has(id)) {
            return this._pendingIds.get(id) as Promise<T>;
        }

        this._opCounter.increment();

        const promise = new Promise((resolve, reject) => {
            const task = new Task(id, priority, request, resolve, reject, shouldExecute, signal);
            if (this._queue.isEmpty()) {
                this._queue.enqueue(task);
                this.onQueueAvailable();
            } else {
                this._queue.enqueue(task);
            }
        });
        this._pendingIds.set(id, promise);

        return promise as Promise<T>;
    }
}

/**
 * A global singleton queue.
 */
const DefaultQueue: RequestQueue = new RequestQueue();

export { DefaultQueue };

export default RequestQueue;

/**
 * Defers the action by queueing it to the default queue.
 */
export function defer<T>(action: () => T, signal?: AbortSignal): Promise<T> {
    return DefaultQueue.enqueue({
        id: MathUtils.generateUUID(),
        request: () => Promise.resolve(action()),
        shouldExecute: () => signal == null || !signal.aborted,
    });
}
