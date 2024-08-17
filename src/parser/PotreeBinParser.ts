import { BufferAttribute, BufferGeometry } from 'three';

interface Attribute {
    numElements: number;
    numByte?: number;
    ArrayType: Float32ArrayConstructor | Uint8ArrayConstructor;
    attributeName: string;
    normalized?: boolean;
    potreeName?: string;
    byteSize?: number;
    getValue?: (view: DataView, offset: number) => number;
}

// See the different constants holding ordinal, name, numElements, byteSize in PointAttributes.cpp
// in PotreeConverter
// elementByteSize is byteSize / numElements
const POINT_ATTTRIBUTES: Record<string, Attribute> = {
    POSITION_CARTESIAN: {
        numElements: 3,
        ArrayType: Float32Array,
        attributeName: 'position',
    },
    COLOR_PACKED: {
        numElements: 4,
        ArrayType: Uint8Array,
        attributeName: 'color',
        normalized: true,
    },
    INTENSITY: {
        numElements: 1,
        numByte: 2,
        // using Float32Array because Float16Array doesn't exist
        ArrayType: Float32Array,
        attributeName: 'intensity',
        normalized: true,
    },
    CLASSIFICATION: {
        numElements: 1,
        ArrayType: Uint8Array,
        attributeName: 'classification',
    },
    // Note: at the time of writing, PotreeConverter will only generate normals in Oct16 format
    // see PotreeConverter.cpp:121
    // we keep all the historical value to still supports old conversion
    NORMAL_SPHEREMAPPED: {
        numElements: 2,
        ArrayType: Uint8Array,
        attributeName: 'sphereMappedNormal',
    },
    // see https://web.archive.org/web/20150303053317/http://lgdv.cs.fau.de/get/1602
    NORMAL_OCT16: {
        numElements: 2,
        ArrayType: Uint8Array,
        attributeName: 'oct16Normal',
    },
    NORMAL: {
        numElements: 3,
        ArrayType: Float32Array,
        attributeName: 'normal',
    },
};

for (const potreeName of Object.keys(POINT_ATTTRIBUTES)) {
    const attr = POINT_ATTTRIBUTES[potreeName];
    attr.potreeName = potreeName;
    attr.numByte = attr.numByte || attr.ArrayType.BYTES_PER_ELEMENT;
    attr.byteSize = attr.numElements * attr.numByte;
    attr.normalized = attr.normalized || false;
    // chrome is known to perform badly when we call a method without respecting its arity
    const fnName = `getUint${attr.numByte * 8}`;
    attr.getValue =
        attr.numByte === 1
            ? // @ts-expect-error implicy any
              (view: DataView, offset: number) => view[fnName](offset)
            : // @ts-expect-error implicy any
              (view: DataView, offset: number) => view[fnName](offset, true);
}

export default {
    /**
     * Parse .bin PotreeConverter format and convert to a BufferGeometry
     *
     * @param buffer - the bin buffer.
     * @param pointAttributes - the point attributes information contained in
     * layer.metadata coming from cloud.js
     * @returns a promise that resolves with a BufferGeometry.
     */
    parse: function parse(buffer: ArrayBuffer, pointAttributes: string[]) {
        if (!buffer) {
            throw new Error('No array buffer provided.');
        }

        const view = new DataView(buffer);
        // Format: X1,Y1,Z1,R1,G1,B1,A1,[...],XN,YN,ZN,RN,GN,BN,AN
        let pointByteSize = 0;
        for (const potreeName of pointAttributes) {
            pointByteSize += POINT_ATTTRIBUTES[potreeName].byteSize;
        }
        const numPoints = Math.floor(buffer.byteLength / pointByteSize);

        const geometry = new BufferGeometry();
        let elemOffset = 0;
        let attrOffset = 0;
        for (const potreeName of pointAttributes) {
            const attr = POINT_ATTTRIBUTES[potreeName];
            const arrayLength = attr.numElements * numPoints;
            const array = new attr.ArrayType(arrayLength);
            for (let arrayOffset = 0; arrayOffset < arrayLength; arrayOffset += attr.numElements) {
                for (let elemIdx = 0; elemIdx < attr.numElements; elemIdx++) {
                    array[arrayOffset + elemIdx] = attr.getValue(
                        view,
                        attrOffset + elemIdx * attr.numByte,
                    );
                }
                attrOffset += pointByteSize;
            }
            elemOffset += attr.byteSize;
            attrOffset = elemOffset;
            geometry.setAttribute(
                attr.attributeName,
                new BufferAttribute(array, attr.numElements, attr.normalized),
            );
        }

        geometry.computeBoundingBox();

        return Promise.resolve(geometry);
    },
};
