import type { TypedArray, Vector } from 'three';
import { Vector2, Vector3, Vector4 } from 'three';
import { nonNull } from '../utils/tsutils';

export type Dimension = 2 | 3 | 4;

const X = 0;
const Y = 1;
const Z = 2;
const W = 3;

/**
 * A typed array of three.js {@link Vector}s.
 *
 * @param V - The underlying {@link Vector} type.
 * @param Buffer - The underlying {@link TypedArray} type.
 */
export abstract class VectorArray<
    V extends Vector = Vector,
    Buffer extends TypedArray = TypedArray,
> {
    private readonly _dimension: Dimension;

    protected _array: Buffer;

    /**
     * The length in bytes of the array.
     */
    get byteLength(): number {
        return this.array.byteLength;
    }

    /**
     * Gets the underlying {@link Buffer}.
     */
    get array(): Buffer {
        return this._array;
    }

    /**
     * Returns the {@link Float32Array} equivalent of this vector array.
     * Note: if the underlying array is already a Float32Array, this array is returned.
     * Otherwise, a new array is constructed.
     */
    toFloat32Array(): Float32Array {
        if (this._array instanceof Float32Array) {
            return this._array;
        }

        return new Float32Array(this._array);
    }

    protected constructor(buffer: Buffer, dimension: Dimension) {
        this._dimension = dimension;
        if (buffer.length % this._dimension !== 0) {
            throw new Error(
                `invalid size, expected a multiple of ${this._dimension}, got ${buffer.length}`,
            );
        }
        this._array = buffer;
    }

    /**
     * Returns the number of vectors in this array.
     */
    get length() {
        return this._array.length / this._dimension;
    }

    /**
     * Gets the vector at the specified index.
     */
    abstract get(index: number, target?: V): V;

    setX(index: number, value: number): void {
        const idx = index * this._dimension;
        this._array[idx + X] = value;
    }

    /**
     * Gets the first component of the vector at the specified index.
     */
    getX(index: number): number {
        const idx = index * this._dimension;
        return this._array[idx + X];
    }

    setY(index: number, value: number): void {
        const idx = index * this._dimension;
        this._array[idx + Y] = value;
    }

    /**
     * Gets the second component of the vector at the specified index.
     */
    getY(index: number): number {
        const idx = index * this._dimension;
        return this._array[idx + Y];
    }

    setZ(index: number, value: number): void {
        if (this._dimension >= 3) {
            const idx = index * this._dimension;
            this._array[idx + Z] = value;
        }
    }

    /**
     * Gets the third component of the vector at the specified index, or `null` if the dimension
     * of this array is less than 3.
     */
    getZ(index: number): number | null {
        if (this._dimension >= 3) {
            const idx = index * this._dimension;
            return this._array[idx + Z];
        }
        return null;
    }

    setW(index: number, value: number): void {
        if (this._dimension >= 4) {
            const idx = index * this._dimension;
            this._array[idx + W] = value;
        }
    }

    /**
     * Gets the fourth component of the vector at the specified index, or `null` if the dimension
     * of this array is less than 4.
     */
    getW(index: number): number | null {
        if (this._dimension >= 4) {
            const idx = index * this._dimension;
            return this._array[idx + W];
        }
        return null;
    }

    /**
     * Sets the vector at the specified index.
     */
    setVector(index: number, v: V): void {
        const idx = index * this._dimension;

        this._array[idx + X] = v.getComponent(X);
        this._array[idx + Y] = v.getComponent(Y);
        if (this._dimension >= 3) {
            this._array[idx + Z] = v.getComponent(Z);
        }
        if (this._dimension >= 4) {
            this._array[idx + W] = v.getComponent(W);
        }
    }

    /**
     * Sets the component of the array at the specified index.
     */
    set(index: number, x: number, y: number, z?: number, w?: number): void {
        const idx = index * this._dimension;
        if (idx >= this._array.length) {
            throw new Error('index out of bounds');
        }
        this._array[idx + X] = x;
        this._array[idx + Y] = y;
        if (this._dimension >= Z && z != null) {
            this._array[idx + Z] = z;
        }
        if (this._dimension >= W && w != null) {
            this._array[idx + W] = w;
        }
    }

    /**
     * Copies an element from one location to another in the array.
     */
    copyItem(from: number, to: number): void {
        const dim = this._dimension;
        const toIdx = to * dim;
        const fromIdx = from * dim;

        this._array[toIdx + X] = this._array[fromIdx + X];
        this._array[toIdx + Y] = this._array[fromIdx + Y];
        if (dim >= 3) {
            this._array[toIdx + Z] = this._array[fromIdx + Z];
        }
        if (dim >= 4) {
            this._array[toIdx + W] = this._array[fromIdx + W];
        }
    }

    /**
     * Allocates a new underlying array to match the new size, then copy the content
     * of the previous array at the beginning of the new array.
     * @param newSize - The new size, in number of vectors.
     */
    expand(newSize: number): this {
        // @ts-expect-error "this expression is not constructable"
        const newArray = new this.array.constructor(newSize * this._dimension);
        newArray.set(this._array);
        this._array = newArray;

        return this;
    }

    /** @internal */
    protected abstract getTempVector(): V;
    /** @internal */
    protected abstract assignVector(rawIndex: number, tempVector: V): void;

    /**
     * Performs the specified action for each element in an array.
     *
     * Note that mutating the callback value will **not** mutate the underlying array. To mutate the
     * underlying array, use the index provided as second argument, then mutate the array with a
     * mutating method, such as {@link setVector}:
     * ```ts
     * const array = new Vector3Array(...);
     *
     * // Add one to each Y value of the array
     * array.forEach((v, index) => {
     *  // This has no effect on the Vector3Array:
     *  v.setY(v.y + 1);
     *
     *  // Use this pattern instead:
     *  array.setVector(index, new Vector3(v.x, v.y + 1, v.z));
     *
     *  // Or this one
     *  array.setY(index, v.y + 1);
     * })
     * ```
     * @param callbackfn - A function that accepts up to three arguments. forEach calls the
     * callbackfn function one time for each element in the array.
     */
    forEach(callbackfn: (value: Readonly<V>, index: number, array: this) => void): void {
        const value = this.getTempVector();

        const stride = this._dimension;

        // Raw index is the index to the first component of each vector, not the vector itself
        for (let rawIndex = 0; rawIndex < this._array.length; rawIndex += stride) {
            this.assignVector(rawIndex, value);

            const vectorIndex = rawIndex / stride;
            callbackfn(value, vectorIndex, this);
        }
    }

    /**
     * Clones this array.
     */
    abstract clone(): ThisType<this>;
}

/**
 * A typed array of three.js {@link Vector2}s.
 *
 * @param Buffer - The underlying {@link TypedArray} type.
 */
export class Vector2Array<Buffer extends TypedArray = TypedArray> extends VectorArray<
    Vector2,
    Buffer
> {
    readonly dimension = 2 as const;

    constructor(buffer: Buffer) {
        super(buffer, 2);
    }

    override get(index: number, target?: Vector2): Vector2 {
        target = target ?? new Vector2();

        return target.set(this.getX(index), this.getY(index));
    }

    clone() {
        return new Vector2Array(this._array.slice(0));
    }

    protected getTempVector(): Vector2 {
        return new Vector2();
    }

    protected assignVector(rawIndex: number, tempVector: Vector2): void {
        const arr = this._array;
        tempVector.set(arr[rawIndex + X], arr[rawIndex + Y]);
    }
}

/**
 * A typed array of three.js {@link Vector3}s.
 *
 * @param Buffer - The underlying {@link TypedArray} type.
 */
export class Vector3Array<Buffer extends TypedArray = TypedArray> extends VectorArray<
    Vector3,
    Buffer
> {
    readonly dimension = 3 as const;

    constructor(buffer: Buffer) {
        super(buffer, 3);
    }

    override get(index: number, target?: Vector3): Vector3 {
        target = target ?? new Vector3();

        return target.set(this.getX(index), this.getY(index), nonNull(this.getZ(index)));
    }

    clone() {
        return new Vector3Array(this._array.slice(0));
    }

    protected getTempVector(): Vector3 {
        return new Vector3();
    }

    protected assignVector(rawIndex: number, tempVector: Vector3): void {
        const arr = this._array;
        tempVector.set(arr[rawIndex + X], arr[rawIndex + Y], arr[rawIndex + Z]);
    }
}

/**
 * A typed array of three.js {@link Vector4}s.
 *
 * @param Buffer - The underlying {@link TypedArray} type.
 */
export class Vector4Array<Buffer extends TypedArray = TypedArray> extends VectorArray<
    Vector4,
    Buffer
> {
    readonly dimension = 4 as const;

    constructor(buffer: Buffer) {
        super(buffer, 4);
    }

    override get(index: number, target?: Vector4): Vector4 {
        target = target ?? new Vector4();

        return target.set(
            this.getX(index),
            this.getY(index),
            nonNull(this.getZ(index)),
            nonNull(this.getW(index)),
        );
    }

    clone() {
        return new Vector4Array(this._array.slice(0));
    }

    protected getTempVector(): Vector4 {
        return new Vector4();
    }

    protected assignVector(rawIndex: number, tempVector: Vector4): void {
        const arr = this._array;
        tempVector.set(arr[rawIndex + X], arr[rawIndex + Y], arr[rawIndex + Z], arr[rawIndex + W]);
    }
}
