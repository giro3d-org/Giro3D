import type { Box3 } from 'three';
import { createReader, getTypedArray, type PotreePointCloudAttribute } from './attributes';

export type BufferAttributeDescriptor = {
    array: ArrayBuffer;
    dimension: number;
    normalized: boolean;
};

function readAttribute(
    attribute: PotreePointCloudAttribute,
    view: DataView,
    pointByteSize: number,
    pointCount: number,
): BufferAttributeDescriptor {
    const array = getTypedArray(attribute.type, attribute.size, attribute.dimension, pointCount);

    const read = createReader(attribute, pointByteSize);

    for (let i = 0; i < pointCount; i++) {
        read(view, i, array);
    }

    return {
        array: array.buffer,
        dimension: attribute.dimension,
        normalized: attribute.normalized,
    };
}

export type ParseResult = {
    positionBuffer: BufferAttributeDescriptor;
    attributeBuffer?: BufferAttributeDescriptor;
    localBoundingBox?: Box3;
};

export function readBinFile(
    buffer: ArrayBuffer,
    pointByteSize: number,
    positionAttribute: PotreePointCloudAttribute,
    optionalAttribute?: PotreePointCloudAttribute,
): ParseResult {
    const view = new DataView(buffer);

    // Format: X1,Y1,Z1,R1,G1,B1,A1,[...],XN,YN,ZN,RN,GN,BN,AN
    const pointCount = Math.floor(buffer.byteLength / pointByteSize);

    const positionBuffer = readAttribute(positionAttribute, view, pointByteSize, pointCount);

    let attributeBuffer: BufferAttributeDescriptor | undefined = undefined;
    if (optionalAttribute != null) {
        attributeBuffer = readAttribute(optionalAttribute, view, pointByteSize, pointCount);
    }

    return {
        positionBuffer,
        attributeBuffer,
    };
}
