import type { View } from 'copc';
import type { BufferAttribute, TypedArray } from 'three';
import {
    Box3,
    Float32BufferAttribute,
    Int16BufferAttribute,
    Int32BufferAttribute,
    Int8BufferAttribute,
    IntType,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
    Uint8BufferAttribute,
    Vector3,
} from 'three';
import TypedArrayVector from '../../core/TypedArrayVector';
import { Vector3Array } from '../../core/VectorArray';
import { UnsupportedAttributeError } from '../../entities/PointCloud';
import type { PointCloudAttribute } from '../PointCloudSource';
import type { DimensionName } from './dimension';
import type { FilterByIndex } from './filter';
import { evaluateFilters } from './filter';

/**
 * Reads the color in the provided LAS view.
 *
 * Note: the color is the aggregate of the `Red`, `Green` and `Blue` dimensions.
 *
 * @param view - The view to read.
 * @param stride - The stride (take every Nth point). A stride of 3 means we take every 3rd point
 * and discard the others.
 * @param compress - Compress colors to 8-bit.
 * @param filters - The optional dimension filters to use.
 * @returns An object containing the color buffer.
 */
export function readColor(
    view: View,
    stride: number,
    compress: boolean,
    filters: FilterByIndex[] | null,
): ArrayBuffer {
    const pointCount = view.pointCount;

    const [readR, readG, readB] = ['Red', 'Green', 'Blue'].map(view.getter);

    const array = new Vector3Array(
        compress ? new Uint8Array(pointCount * 3) : new Uint16Array(pointCount * 3),
    );
    array.length = 0;

    const factor = compress ? (1 / 65536) * 256 : 1;

    for (let i = 0; i < pointCount; i += stride) {
        if (evaluateFilters(filters, i)) {
            const r = readR(i) * factor;
            const g = readG(i) * factor;
            const b = readB(i) * factor;

            array.push(r, g, b);
        }
    }

    return array.array.buffer;
}

/**
 * Reads the point position in the provided LAS view.
 * @param view - The view to read.
 * @param origin - The origin to use for relative point coordinates.
 * @param stride - The stride (take every Nth point). A stride of 3 means we take every 3rd point
 * and discard the others.
 * @param filters - The optional dimension filters to use.
 * @returns An object containing the relative position buffer, and a local (tight) bounding box of
 * the position buffer.
 */
export function readPosition(
    view: View,
    origin: { x: number; y: number; z: number },
    stride: number,
    filters: FilterByIndex[] | null,
): { buffer: ArrayBuffer; localBoundingBox: Box3 } {
    const pointCount = view.pointCount;

    const [readX, readY, readZ] = ['X', 'Y', 'Z'].map(view.getter);

    const pointCountIncludingStride = Math.floor(pointCount / stride) + (pointCount % stride);
    const elementCount = pointCountIncludingStride * 3;
    const array = new Vector3Array(new Float32Array(elementCount));
    array.length = 0;

    let minx = +Infinity;
    let miny = +Infinity;
    let minz = +Infinity;

    let maxx = -Infinity;
    let maxy = -Infinity;
    let maxz = -Infinity;

    for (let i = 0; i < pointCount; i += stride) {
        if (evaluateFilters(filters, i)) {
            const x = readX(i) - origin.x;
            const y = readY(i) - origin.y;
            const z = readZ(i) - origin.z;

            minx = Math.min(x, minx);
            miny = Math.min(y, miny);
            minz = Math.min(z, minz);

            maxx = Math.max(x, maxx);
            maxy = Math.max(y, maxy);
            maxz = Math.max(z, maxz);

            array.push(x, y, z);
        }
    }

    array.trim();

    return {
        buffer: array.array.buffer,
        localBoundingBox: new Box3(new Vector3(minx, miny, minz), new Vector3(maxx, maxy, maxz)),
    };
}

function fillBuffer<T extends TypedArray>(
    get: View.Getter,
    pointCount: number,
    stride: number,
    buffer: TypedArrayVector<T>,
    filters: FilterByIndex[] | null,
) {
    for (let i = 0; i < pointCount; i += stride) {
        if (evaluateFilters(filters, i)) {
            buffer.push(get(i));
        }
    }
}

type ReadFn = (
    dimension: DimensionName,
    view: View,
    stride: number,
    filters: FilterByIndex[] | null,
) => ArrayBuffer;

export function readScalarAttribute(
    view: Readonly<View>,
    attribute: PointCloudAttribute,
    stride: number,
    filters: FilterByIndex[] | null,
): ArrayBuffer {
    const dimension = attribute.name as DimensionName;

    let readFn: ReadFn;

    switch (attribute.type) {
        case 'float':
            readFn = read(Float32Array);
            break;
        case 'signed':
            switch (attribute.size) {
                case 1:
                    readFn = read(Int8Array);
                    break;
                case 2:
                    readFn = read(Int16Array);
                    break;
                case 4:
                    readFn = read(Int32Array);
                    break;
                default:
                    throw new Error('invalid attribute size for signed values: ' + attribute.size);
            }
            break;
        case 'unsigned':
            switch (attribute.size) {
                case 1:
                    readFn = read(Uint8Array);
                    break;
                case 2:
                    readFn = read(Uint16Array);
                    break;
                case 4:
                    readFn = read(Uint32Array);
                    break;
                default:
                    throw new Error(
                        'invalid attribute size for unsigned values: ' + attribute.size,
                    );
            }
            break;
        default:
            throw new UnsupportedAttributeError(dimension);
    }

    return readFn(dimension, view, stride, filters);
}

export function createBufferAttribute(
    buffer: ArrayBuffer,
    attribute: PointCloudAttribute,
    compressColors: boolean,
): BufferAttribute {
    const dimension = attribute.name as DimensionName;

    // Special case for colors, since they can be either 8-bit or 16-bit
    // depending on the user's choice. Note that since they are normalized in both cases,
    // the shader will handle both cases the same way. The only (potential) difference is
    // for very high dynamic range colors, the 16-bit case might reduce banding and other
    // similar artifacts. However, in 99% using a 8-bit color buffer is enough.
    if (attribute.interpretation === 'color') {
        return compressColors
            ? new Uint8BufferAttribute(buffer, 3, true)
            : new Uint16BufferAttribute(buffer, 3, true);
    }

    switch (attribute.type) {
        case 'float':
            return new Float32BufferAttribute(buffer, attribute.dimension);
        case 'signed': {
            let result: BufferAttribute;
            switch (attribute.size) {
                case 1:
                    result = new Int8BufferAttribute(buffer, attribute.dimension);
                    break;
                case 2:
                    result = new Int16BufferAttribute(buffer, attribute.dimension);
                    break;
                case 4:
                    result = new Int32BufferAttribute(buffer, attribute.dimension);
                    break;
                default:
                    throw new Error('invalid attribute size for signed values: ' + attribute.size);
            }
            result.gpuType = IntType;
            return result;
        }
        case 'unsigned': {
            let result: BufferAttribute;
            switch (attribute.size) {
                case 1:
                    result = new Uint8BufferAttribute(buffer, attribute.dimension);
                    break;
                case 2:
                    result = new Uint16BufferAttribute(buffer, attribute.dimension);
                    break;
                case 4:
                    result = new Uint32BufferAttribute(buffer, attribute.dimension);
                    break;
                default:
                    throw new Error(
                        'invalid attribute size for unsigned values: ' + attribute.size,
                    );
            }
            result.gpuType = IntType;
            return result;
        }
        default:
            throw new UnsupportedAttributeError(dimension);
    }
}

/**
 * Reads an attribute from the view.
 */
function read<T extends TypedArray>(ctor: new (capacity: number) => T): ReadFn {
    return (dimension, view, stride, filters) => {
        const pointCount = view.pointCount;

        const array = new TypedArrayVector(pointCount, cap => new ctor(cap));

        fillBuffer(view.getter(dimension), pointCount, stride, array, filters);

        return array.getArray().buffer;
    };
}
