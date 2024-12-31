import PriorityQueue from 'ol/structs/PriorityQueue';
import { EventDispatcher, MathUtils } from 'three';
import PromiseUtils from '../utils/PromiseUtils';
import OperationCounter from './OperationCounter';
import type Progress from './Progress';

function defaultShouldExecute() {
    return true;
}

class Task {
    readonly id: string;
    private readonly _priority: number;
    private readonly _signal?: AbortSignal;
    private readonly _resolve: (arg: unknown) => void;
    private readonly _request: () => Promise<unknown>;

    readonly reject: (reason?: Error | string) => void;
    readonly shouldExecute: () => boolean;

    constructor(
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

    getKey() {
        return this.id;
    }

    getPriority() {
        if (this._signal?.aborted === true) {
            // means "drop the request"
            return Infinity;
        }

        return this._priority;
    }

    execute() {
        if (this._signal?.aborted === true) {
            this.reject(PromiseUtils.abortError());
            return Promise.reject();
        }

        return this._request()
            .then(x => this._resolve(x))
            .catch(e => this.reject(e));
    }
}

function priorityFn(task: Task) {
    return task.getPriority();
}

function keyFn(task: Task) {
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
    constructor(
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

    get length() {
        return this._queue.getCount();
    }

    get progress() {
        return this._opCounter.progress;
    }

    get loading() {
        return this._opCounter.loading;
    }

    get pendingRequests() {
        return this._pendingIds.size;
    }

    get concurrentRequests() {
        return this._concurrentRequests;
    }

    onQueueAvailable() {
        if (this._queue.isEmpty()) {
            return;
        }

        while (this._concurrentRequests < this._maxConcurrentRequests) {
            if (this._queue.isEmpty()) {
                break;
            }

            const task = this._queue.dequeue();
            const key = task.getKey();

            if (task.shouldExecute()) {
                this._concurrentRequests++;
                task.execute().finally(() => {
                    this._opCounter.decrement();
                    this._pendingIds.delete(key);
                    this._concurrentRequests--;
                    this.onQueueAvailable();
                    this.dispatchEvent({ type: 'task-executed' });
                });
            } else {
                this._opCounter.decrement();
                this._pendingIds.delete(key);
                this.onQueueAvailable();
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
     */
    enqueue<T>(options: {
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
