/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, Vector3 } from 'three';

import type { ParseResult } from './bin';
import type { Potree2Attribute } from './Potree2Metadata';

function decodePositionAttribute(
    view: DataView,
    pointCount: number,
    bytesPerPoint: number,
    attributeByteOffset: number,
    scale: [number, number, number],
): { buffer: ParseResult['positionBuffer']; localBoundingBox: Box3 } {
    const buf = new ArrayBuffer(pointCount * 4 * 3);
    const positions = new Float32Array(buf);

    let minX = +Infinity;
    let maxX = -Infinity;
    let minY = +Infinity;
    let maxY = -Infinity;
    let minZ = +Infinity;
    let maxZ = -Infinity;

    for (let j = 0; j < pointCount; j++) {
        const ptOffset = j * bytesPerPoint;
        const offset = ptOffset + attributeByteOffset;

        const x = view.getInt32(offset + 0, true) * scale[0];
        const y = view.getInt32(offset + 4, true) * scale[1];
        const z = view.getInt32(offset + 8, true) * scale[2];

        positions[3 * j + 0] = x;
        positions[3 * j + 1] = y;
        positions[3 * j + 2] = z;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);

        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
    }

    return {
        buffer: {
            array: buf,
            dimension: 3,
            normalized: false,
        },
        localBoundingBox: new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ)),
    };
}

export function decodeUncompressedBuffer(
    buffer: ArrayBuffer,
    pointCount: number,
    attributes: Potree2Attribute[],
    scale: number[],
): ParseResult {
    const attrOffset = 0;
    let bytesPerPoint = 0;

    for (let i = 0; i < attributes.length; i++) {
        bytesPerPoint += attributes[i].size;
    }
    const view = new DataView(buffer);

    const positionAttr = decodePositionAttribute(
        view,
        pointCount,
        bytesPerPoint,
        attrOffset,
        scale as [number, number, number],
    );

    return {
        positionBuffer: positionAttr.buffer,
        attributeBuffers: [],
        localBoundingBox: positionAttr.localBoundingBox,
    };
}
