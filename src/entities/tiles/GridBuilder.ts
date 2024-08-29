import type { TypedArray } from 'three';
import { PlaneGeometry } from 'three';
import type { VectorArray } from '../../core/VectorArray';
import { Vector2Array, Vector3Array } from '../../core/VectorArray';
import { nonNull } from '../../utils/tsutils';

type CachedBuffers = {
    positionBuffer: Vector3Array;
    normalBuffer: Vector3Array;
    uvBuffer: Vector2Array;
    indexBuffer: TypedArray;
};

const pool: Map<string, CachedBuffers> = new Map();

function expandWithSkirt<T extends VectorArray>(segments: number, array: T): T {
    const skirtStart = array.length;
    array.expand(array.length + 4);

    const rowSize = segments + 1;

    // Copy the skirt values from their non-skirt counterpart.
    array.copyItem(0, skirtStart + 0); // Top left
    array.copyItem(rowSize - 1, skirtStart + 1); // Top right
    array.copyItem(skirtStart - rowSize, skirtStart + 2); // Bottom left
    array.copyItem(skirtStart - 1, skirtStart + 3); // Bottom right

    return array;
}

function makeSkirtRow(
    indices: number[],
    row: number,
    rowSize: number,
    skirt0: number,
    skirt1: number,
    reversed: boolean,
) {
    const midRow = Math.round(rowSize / 2);

    for (let i = 0; i < rowSize - 1; i++) {
        // Switch to the other skirt vertex for the other half of triangles so
        // that it is less likely that triangles go "over" the terrain and produce
        // visual artifacts.
        indices.push(i <= midRow ? skirt0 : skirt1);

        const a = row * rowSize + i + 0;
        const b = row * rowSize + i + 1;
        indices.push(reversed ? b : a);
        indices.push(reversed ? a : b);
    }
    indices.push(row * rowSize + midRow + 1);
    indices.push(reversed ? skirt0 : skirt1);
    indices.push(reversed ? skirt1 : skirt0);
}

function makeSkirtColumn(
    indices: number[],
    column: number,
    rowSize: number,
    skirt0: number,
    skirt1: number,
    reversed: boolean,
) {
    const midRow = Math.round(rowSize / 2);

    for (let row = 0; row < rowSize - 1; row++) {
        // Switch to the other skirt vertex for the other half of triangles so
        // that it is less likely that triangles go "over" the terrain and produce
        // visual artifacts.
        indices.push(row <= midRow ? skirt0 : skirt1);

        const a = row * (rowSize + 0) + column;
        const b = (row + 1) * rowSize + column;
        indices.push(reversed ? b : a);
        indices.push(reversed ? a : b);
    }

    const mid = (midRow + 1) * rowSize + column;
    indices.push(mid);
    indices.push(reversed ? skirt0 : skirt1);
    indices.push(reversed ? skirt1 : skirt0);
}

function expandIndexBufferWithSkirts(segments: number, array: TypedArray): TypedArray {
    let result: TypedArray;
    const rowSize = segments + 1;
    const sides = 4;
    const skirtStart = rowSize * rowSize;
    const additionalIndices = sides * rowSize * 3;
    const length = array.length + additionalIndices;

    if (array instanceof Uint16Array) {
        result = new Uint16Array(length);
    } else {
        result = new Uint32Array(length);
    }

    const skirtTL = skirtStart + 0;
    const skirtTR = skirtStart + 1;
    const skirtBL = skirtStart + 2;
    const skirtBR = skirtStart + 3;

    const skirt: number[] = [];

    makeSkirtRow(skirt, 0, rowSize, skirtTL, skirtTR, false); // Top row
    makeSkirtRow(skirt, rowSize - 1, rowSize, skirtBL, skirtBR, true); // Bottom row

    makeSkirtColumn(skirt, 0, rowSize, skirtTL, skirtBL, true); // Left column
    makeSkirtColumn(skirt, rowSize - 1, rowSize, skirtTR, skirtBR, false); // Right column

    result.set(array, 0); // Initial index array
    result.set(skirt, array.length); // Skirt additional indices

    return result;
}

export function getGridBuffers(segments: number, includeSkirt: boolean): CachedBuffers {
    const cacheKey = `${segments}-${includeSkirt ? 1 : 0}`;

    let buffers = pool.get(cacheKey);

    if (!buffers) {
        // A shortcut to get ready to use buffers
        const geom = new PlaneGeometry(1, 1, segments, segments);

        let position = new Vector3Array(geom.getAttribute('position').array as Float32Array);
        let normal = new Vector3Array(geom.getAttribute('normal').array as Float32Array);
        let uv = new Vector2Array(geom.getAttribute('uv').array as Float32Array);
        let index = nonNull(geom.getIndex()).array;

        if (includeSkirt) {
            // Note that skirt vertices are pushed at the end of the original arrays,
            // so that code that deal with skirts does not have to change too much
            // if they are present or absent (i.e the loop that deal with the main vertices
            // remain the same).
            position = expandWithSkirt(segments, position);
            normal = expandWithSkirt(segments, normal);
            uv = expandWithSkirt(segments, uv);
            index = expandIndexBufferWithSkirts(segments, index);
        }

        buffers = {
            positionBuffer: position,
            normalBuffer: normal,
            uvBuffer: uv,
            indexBuffer: index,
        };

        pool.set(cacheKey, buffers);
    }

    return {
        normalBuffer: buffers.positionBuffer,
        positionBuffer: buffers.positionBuffer,
        uvBuffer: buffers.uvBuffer,
        indexBuffer: buffers.indexBuffer,
    };
}
