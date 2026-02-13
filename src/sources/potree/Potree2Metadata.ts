/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { PointCloudAttribute } from '../PointCloudSource';

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
    numElements: number;
    elementSize: number;
    type: Potree2AttributeType;
    min: number[];
    max: number[];
    scale: number[];
    offset: number[];
}

// TODO handle brotli
// Note: DEFAULT and UNCOMPRESSED are the same
export type Compression = 'DEFAULT' | 'BROTLI' | 'UNCOMPRESSED';

export function toPointCloudAttribute(attr: Potree2Attribute): PointCloudAttribute {
    throw new Error('not implemented');
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
