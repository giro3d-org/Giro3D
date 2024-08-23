import { BufferAttribute, BufferGeometry } from 'three';

export type AttributeName =
    | 'POSITION_CARTESIAN'
    | 'COLOR_PACKED'
    | 'INTENSITY'
    | 'CLASSIFICATION'
    | 'NORMAL_SPHEREMAPPED'
    | 'NORMAL_OCT16'
    | 'NORMAL';

type ArrayType = Float32ArrayConstructor | Uint8ArrayConstructor;

interface Attribute {
    numElements: number;
    numByte: number;
    ArrayType: ArrayType;
    attributeName: string;
    normalized: boolean;
    potreeName: AttributeName;
    byteSize: number;
    getValue: (view: DataView, offset: number) => number;
}

function makeAttribute(options: {
    potreeName: AttributeName;
    attributeName: string;
    numElements: number;
    arrayType: ArrayType;
    normalized?: boolean;
    numByte?: number;
}): Attribute {
    const numByte = options.numByte ?? options.arrayType.BYTES_PER_ELEMENT;

    // chrome is known to perform badly when we call a method without respecting its arity
    const fnName = `getUint${numByte * 8}`;
    const getValue =
        numByte === 1
            ? // @ts-expect-error implicy any
              (view: DataView, offset: number) => view[fnName](offset)
            : // @ts-expect-error implicy any
              (view: DataView, offset: number) => view[fnName](offset, true);

    return {
        normalized: options.normalized ?? false,
        numByte,
        byteSize: options.numElements * numByte,
        ArrayType: options.arrayType,
        attributeName: options.attributeName,
        potreeName: options.potreeName,
        numElements: options.numElements,
        getValue,
    };
}

// See the different constants holding ordinal, name, numElements, byteSize in PointAttributes.cpp
// in PotreeConverter
// elementByteSize is byteSize / numElements
const POINT_ATTRIBUTES: Record<AttributeName, Attribute> = {
    POSITION_CARTESIAN: makeAttribute({
        numElements: 3,
        arrayType: Float32Array,
        attributeName: 'position',
        potreeName: 'POSITION_CARTESIAN',
    }),
    COLOR_PACKED: makeAttribute({
        numElements: 4,
        arrayType: Uint8Array,
        attributeName: 'color',
        normalized: true,
        potreeName: 'COLOR_PACKED',
    }),
    INTENSITY: makeAttribute({
        numElements: 1,
        numByte: 2,
        // using Float32Array because Float16Array doesn't exist
        arrayType: Float32Array,
        attributeName: 'intensity',
        normalized: true,
        potreeName: 'INTENSITY',
    }),
    CLASSIFICATION: makeAttribute({
        numElements: 1,
        arrayType: Uint8Array,
        attributeName: 'classification',
        potreeName: 'CLASSIFICATION',
    }),
    // Note: at the time of writing, PotreeConverter will only generate normals in Oct16 format
    // see PotreeConverter.cpp:121
    // we keep all the historical value to still supports old conversion
    NORMAL_SPHEREMAPPED: makeAttribute({
        numElements: 2,
        arrayType: Uint8Array,
        attributeName: 'sphereMappedNormal',
        potreeName: 'NORMAL_SPHEREMAPPED',
    }),
    // see https://web.archive.org/web/20150303053317/http://lgdv.cs.fau.de/get/1602
    NORMAL_OCT16: makeAttribute({
        numElements: 2,
        arrayType: Uint8Array,
        attributeName: 'oct16Normal',
        potreeName: 'NORMAL_OCT16',
    }),
    NORMAL: makeAttribute({
        numElements: 3,
        arrayType: Float32Array,
        attributeName: 'normal',
        potreeName: 'NORMAL',
    }),
};

export default {
    /**
     * Parse .bin PotreeConverter format and convert to a BufferGeometry
     *
     * @param buffer - the bin buffer.
     * @param pointAttributes - the point attributes information contained in
     * layer.metadata coming from cloud.js
     * @returns a promise that resolves with a BufferGeometry.
     */
    parse: function parse(buffer: ArrayBuffer, pointAttributes: AttributeName[]) {
        if (!buffer) {
            throw new Error('No array buffer provided.');
        }

        const view = new DataView(buffer);
        // Format: X1,Y1,Z1,R1,G1,B1,A1,[...],XN,YN,ZN,RN,GN,BN,AN
        let pointByteSize = 0;
        for (const potreeName of pointAttributes) {
            const attr = POINT_ATTRIBUTES[potreeName];
            if (attr !== undefined) {
                pointByteSize += attr.byteSize;
            }
        }
        const numPoints = Math.floor(buffer.byteLength / pointByteSize);

        const geometry = new BufferGeometry();
        let elemOffset = 0;
        let attrOffset = 0;
        for (const potreeName of pointAttributes) {
            const attr = POINT_ATTRIBUTES[potreeName];
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
