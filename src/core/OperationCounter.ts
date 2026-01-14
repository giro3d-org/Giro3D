/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { EventDispatcher } from 'three';

import type Progress from './Progress';

export interface OperationCounterEvents {
    /**
     * Raised when the counter is changed.
     */
    changed: unknown;
    /**
     * Raised when all operations are completed.
     */
    complete: unknown;
}

/**
 * Provides a way to track the progress of running operations.
 */
class OperationCounter extends EventDispatcher<OperationCounterEvents> implements Progress {
    private _operations: number;
    private _completed: number;
    private _total: number;

    public constructor() {
        super();

        this._operations = 0;
        this._completed = 0;
        this._total = 0;
    }

    /**
     * Gets the number of pending operations.
     */
    public get operations(): number {
        return this._operations;
    }

    /**
     * Gets the number of completed operations.
     */
    public get completed(): number {
        return this._completed;
    }

    /**
     * Gets whether at least one operation is being executed.
     */
    public get loading(): boolean {
        return this._operations > 0;
    }

    /**
     * Returns a number between 0 and 1 which represent the ratio between
     * completed operations and total operations.
     */
    public get progress(): number {
        if (this._operations === 0) {
            return 1;
        }

        return this._completed / this._total;
    }

    /**
     * Decrements the number of pending operations.
     */
    public decrement(): void {
        if (this._operations === 0) {
            return;
        }

        this._operations--;
        this._completed++;

        this.dispatchEvent({ type: 'changed' });

        if (this._operations === 0) {
            this._total = 0;
            this._completed = 0;
            this.dispatchEvent({ type: 'complete' });
        }
    }

    /**
     * Increments the counter before starting the promise, then decrements it safely when the
     * promises resolves or fails.
     */
    public wrap<T>(promise: Promise<T>): Promise<T> {
        this.increment();

        return promise.finally(() => this.decrement());
    }

    /**
     * Increment the number of pending operations.
     * @param count - How many increments to do. Default is 1.
     */
    public increment(count = 1): void {
        this._operations += count;
        this._total += count;
        this.dispatchEvent({ type: 'changed' });
    }
}

export default OperationCounter;
