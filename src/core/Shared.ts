/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type Disposable from './Disposable';

type RefCount = { count: number };

/**
 * Represents an object that can be shared among multiple instances (multiple ownership).
 */
export default class Shared<T extends object, Owner = unknown> implements Disposable {
    private _disposed = false;

    private constructor(
        private readonly _object: T,
        private readonly _owner: Owner,
        private readonly _refCount: RefCount,
        private readonly _onDispose: (obj: T) => void,
    ) {}

    /**
     * The underlying shared object.
     */
    public get object(): T {
        this.checkDisposed();
        return this._object;
    }

    /**
     * Gets the original (first) owner of the shared object.
     */
    public get owner(): Owner {
        this.checkDisposed();
        return this._owner;
    }

    /**
     * Creates a new shared object with the specified owner.
     * @param obj - The object to share.
     * @param owner - The owner of the object.
     * @param onDispose - The callback to apply when the ref count reaches zero.
     */
    public static new<T extends object, Owner = unknown>(
        obj: T,
        owner: Owner,
        onDispose: (obj: T) => void,
    ): Shared<T, Owner> {
        const result = new Shared(obj, owner, { count: 1 }, onDispose);
        return result;
    }

    /**
     * Clones the reference to the shared object, incrementing the ref count.
     * Note: this does _not_ clone the shared object itself.
     */
    public clone(): Shared<T, Owner> {
        this.checkDisposed();
        this._refCount.count++;
        return new Shared(this._object, this.owner, this._refCount, this._onDispose);
    }

    private checkDisposed(): void {
        if (this._refCount.count === 0) {
            throw new Error('cannot use disposed Shared object');
        }
    }

    /**
     * Decrement the ref count of this object. If the count becomes zero, the underlying object is also disposed.
     */
    public dispose(): void {
        // Idempotence of dispose()
        if (this._disposed) {
            return;
        }

        this._refCount.count--;

        if (this._refCount.count === 0) {
            this._disposed = true;
            this._onDispose(this._object);
        }
    }
}
