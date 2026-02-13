/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { PointCloudAttribute } from '../PointCloudSource';

export type Potree2AttributeType =
    | 'double'
    | 'float'
    | 'int8'
    | 'uint8'
    | 'int16'
    | 'uint16'
    | 'int32'
    | 'uint32'
    | 'int64'
    | 'uint64';

export interface Potree2Attribute {
    name: string;
    description: string;
    size: number;
    numElements: 1 | 3;
    elementSize: 1 | 2 | 4;
    type: Potree2AttributeType;
    min: number[];
    max: number[];
    scale: number[];
    offset: number[];
}

// TODO handle brotli
// Note: DEFAULT and UNCOMPRESSED are the same
export type Compression = 'DEFAULT' | 'BROTLI' | 'UNCOMPRESSED';

export function isSupported(attr: Potree2Attribute): boolean {
    // TODO explain
    if (attr.name === 'position' || attr.name === 'POSITION_CARTESIAN') {
        return false;
    }

    return true;
}

export function toPointCloudAttribute(attr: Potree2Attribute): PointCloudAttribute {
    let type: PointCloudAttribute['type'];

    switch (attr.type) {
        case 'double':
        case 'float':
            type = 'float';
            break;
        case 'uint8':
        case 'int16':
        case 'uint32':
        case 'uint16':
        case 'uint64':
            type = 'unsigned';
            break;
        case 'int8':
        case 'int32':
        case 'int64':
            type = 'signed';
    }

    return {
        name: attr.name,
        type,
        size: attr.elementSize,
        dimension: attr.numElements,
        interpretation: 'unknown',
        min: attr.min[0],
        max: attr.max[0],
    };
}

export default interface Potree2Metadata {
    version: '2.0';
    name: string;
    description: string;
    points: number;
    projection: string;
    hierarchy: {
        firstChunkSize: number;
        stepSize: number;
        depth: number;
    };
    offset: [number, number, number];
    scale: [number, number, number];
    spacing: number;
    boundingBox: {
        min: [number, number, number];
        max: [number, number, number];
    };
    encoding: Compression;
    attributes: Array<Potree2Attribute>;
}
