/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { TypedArray } from 'three';

import { PlaneGeometry } from 'three';

import type { VectorArray } from '../../core/VectorArray';

import { Vector2Array, Vector3Array } from '../../core/VectorArray';
import { nonNull } from '../../utils/tsutils';

interface CachedBuffers {
    positionBuffer: Vector3Array;
    normalBuffer: Vector3Array;
    uvBuffer: Vector2Array;
    indexBuffer: TypedArray;
}

const pool: Map<string, CachedBuffers> = new Map();

export enum SkirtSide {
    Top = 0,
    Right = 1,
    Bottom = 2,
    Left = 3,
}

export function iterateBottomVertices<T extends VectorArray>(
    array: T,
    callback: (index: number) => void,
): void {
    const vertexCount = array.length;

    callback(vertexCount - 4);
    callback(vertexCount - 3);
    callback(vertexCount - 2);
    callback(vertexCount - 1);
}

export function iterateSkirtVertices<T extends VectorArray>(
    segments: number,
    array: T,
    callback: (
        skirtSide: SkirtSide,
        topIndex: number,
        skirtTopIndex: number,
        skirtBottomIndex: number,
    ) => void,
): void {
    const rowSize = segments + 1;
    const skirtTopStart = rowSize * rowSize;
    const skirtVertexCount = rowSize * 2;

    // Top edge
    let offset = 0;
    let skirtOffset = 0;
    for (let i = 0; i < rowSize; i++) {
        const skirtTop = skirtTopStart + skirtOffset + i;
        const skirtBottom = skirtTop + rowSize;
        callback(SkirtSide.Top, i + offset, skirtTop, skirtBottom);
    }

    // Right edge
    skirtOffset += skirtVertexCount;
    for (let i = 0; i < rowSize; i++) {
        const lastVertexOnRow = rowSize - 1;
        const skirtTop = skirtTopStart + skirtOffset + i;
        const skirtBottom = skirtTop + rowSize;
        callback(SkirtSide.Right, i * rowSize + lastVertexOnRow, skirtTop, skirtBottom);
    }

    // Bottom edge
    offset = rowSize * (rowSize - 1);
    skirtOffset += skirtVertexCount;
    for (let i = 0; i < rowSize; i++) {
        const skirtTop = skirtTopStart + skirtOffset + i;
        const skirtBottom = skirtTop + rowSize;
        callback(SkirtSide.Bottom, i + offset, skirtTop, skirtBottom);
    }

    // Left edge
    skirtOffset += skirtVertexCount;
    for (let i = 0; i < rowSize; i++) {
        const skirtTop = skirtTopStart + skirtOffset + i;
        const skirtBottom = skirtTop + rowSize;
        callback(SkirtSide.Left, i * rowSize, skirtTop, skirtBottom);
    }
}

function expandWithSkirt<T extends VectorArray>(segments: number, array: T): T {
    // Skirts vertices are organized in 5 blocks: one for each
    // vertical side, and one for the bottom rectangle.
    // Each vertical side is simply a rowSize * 2 vertex grid, so that
    // each vertex on the edge of the original mesh has an equivalent vertex on the skirt.
    // There are as many vertices on each skirt edge as there are vertices
    // on the original edge.
    // However, the bottom rectangle is only 4 vertices, as there is no need for more,
    // since all the vertices on the bottom edges will have the same height.
    // Note that there are no shared vertices between the skirts and the original mesh
    // because we want the skirts to have their own normals and UV coordinates.

    // Viewed from the side, a 3-segment tile will look like this:
    //
    //      +         + <-- Z = whatever height the mesh has
    // +    |    +    |
    // |    |    |    |
    // |    |    |    |
    // |    |    |    |
    // |    |    |    |
    // |    |    |    |
    // +----+----+----+ <-- Z = fixed skirt depth

    const rowSize = segments + 1;
    const verticesPerSide = rowSize * 2;
    const vertexForBottomRectangle = 4;
    const additionalVertices = 4 * verticesPerSide + vertexForBottomRectangle;

    // Let's create the additional skirt vertices
    array.expand(array.length + additionalVertices);

    return array;
}

function expandIndexBufferWithSkirts(segments: number, array: TypedArray): TypedArray {
    const template = nonNull(new PlaneGeometry(1, 1, segments, 1).index).array;
    const templateInverted = template.slice(0);
    for (let i = 0; i < templateInverted.length; i += 3) {
        const a = templateInverted[i + 0];
        const b = templateInverted[i + 1];

        templateInverted[i + 0] = b;
        templateInverted[i + 1] = a;
    }

    let result: TypedArray;
    const rowSize = segments + 1;
    const vertexCount = rowSize * rowSize;
    const vertexCountIncludingSkirts = vertexCount + rowSize * 2 * 4 + 4;
    const verticesPerSide = rowSize * 2;
    // // Note: the 2 * 3 vertices are for the bottom rectangle
    const additionalIndices = template?.length * 4 + 2 * 3;
    const length = array.length + additionalIndices;

    if (array instanceof Uint16Array) {
        result = new Uint16Array(length);
    } else {
        result = new Uint32Array(length);
    }

    result.set(array, 0); // Initial index array

    // Let's create the indices for each vertical side, by reusing the indices
    // from the template and offsetting them to match the starting index of the
    // side's first vertex.

    const firstSkirtIndex = array.length;
    let indexOffset = vertexCount;
    let arrayOffset = firstSkirtIndex;

    // Top side
    result.set(
        templateInverted.slice(0).map(idx => idx + indexOffset),
        arrayOffset,
    );

    indexOffset += verticesPerSide;
    arrayOffset += template.length;

    // Right side
    result.set(
        templateInverted.slice(0).map(idx => idx + indexOffset),
        arrayOffset,
    );

    indexOffset += verticesPerSide;
    arrayOffset += template.length;

    // Bottom side
    result.set(
        template.slice(0).map(idx => idx + indexOffset),
        arrayOffset,
    );

    indexOffset += verticesPerSide;
    arrayOffset += template.length;

    // Left side
    result.set(
        template.slice(0).map(idx => idx + indexOffset),
        arrayOffset,
    );

    indexOffset += verticesPerSide;
    arrayOffset += template.length;

    // Finally, the bottom rectangle
    const topLeft = vertexCountIncludingSkirts - 4;
    const topRight = topLeft + 1;
    const bottomRight = topLeft + 2;
    const bottomLeft = topLeft + 3;
    const bottomRectangle = [topLeft, topRight, bottomRight, topLeft, bottomRight, bottomLeft];
    result.set(bottomRectangle, arrayOffset);

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
