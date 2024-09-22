import { type TypedArray } from 'three';

/**
 * A redimensionable wrapper around a {@link TypedArray}.
 *
 * Here, 'vector' means 'resizeable' array, and not a three.js vector.
 */
export default class TypedArrayVector<T extends TypedArray> {
    private readonly _ctor: (capacity: number) => T;
    private _array: T;
    private _length = 0;

    constructor(capacity: number, createNew: (capacity: number) => T) {
        this._ctor = createNew;
        this._array = createNew(capacity);
    }

    /**
     * The capacity of this vector.
     */
    get capacity() {
        return this._array.length;
    }

    get length() {
        return this._length;
    }

    /**
     * Pushes a value at the end of the vector.
     */
    push(v: number): void {
        if (this.isFull) {
            this.expand();
        }
        this._array[this._length] = v;
        this._length++;
    }

    /**
     * Returns the underlying array, resized so that capacity = length.
     */
    getArray(): T {
        if (this.isFull) {
            return this._array;
        } else {
            return this._array.slice(0, this._length) as T;
        }
    }

    private get isFull() {
        return this._length === this.capacity;
    }

    private expand() {
        const newCap = Math.round(this.capacity * 1.5);
        const newArray = this._ctor(newCap);
        newArray.set(this._array);
        this._array = newArray;
    }
}
