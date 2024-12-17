import { type TypedArray } from 'three';
import { defined } from '../../utils/tsutils';
import { DEFAULT_VALUE_RANGES, type DimensionName } from '../las/dimension';
import type { PointCloudAttribute } from '../PointCloudSource';
import type BoundingBox from './BoundingBox';

/**
 * The names of attributes for legacy Potree point clouds (the ones with .bin files in a hierarchy).
 * For LAZ-based potree datasets, the names are the actual LAS dimension names.
 */
export type AttributeName =
    | 'POSITION_CARTESIAN'
    | 'RGB_PACKED'
    | 'RGBA_PACKED'
    | 'COLOR_PACKED'
    | 'INTENSITY'
    | 'CLASSIFICATION'
    | 'RETURN_NUMBER'
    | 'NUMBER_OF_RETURNS'
    | 'GPS_TIME'
    | 'SOURCE_ID'
    | 'SPACING'
    | 'INDICES'
    | 'NORMAL_FLOATS'
    | 'NORMAL_SPHEREMAPPED'
    | 'NORMAL_OCT16'
    | 'NORMAL';

/**
 * A function that reads point at the given index, and fills the array with the point data.
 */
type Reader = (view: DataView, pointIndex: number, target: TypedArray) => void;

enum PotreeDataType {
    Uint8,
    Uint16,
    Uint32,
    Float,
    Double,
}

export type PotreeAttribute = {
    type: PotreeDataType;
    dimension: 1 | 2 | 3 | 4;
    normalized: boolean;
    interpretation: PointCloudAttribute['interpretation'];
    min?: number;
    max?: number;
};

/**
 * Point cloud attribute for LAZ-based Potree datasets.
 */
export type LazPointCloudAttribute = PointCloudAttribute & {
    // Stronger typing than string
    name: DimensionName | 'Color';
};

/**
 * Point cloud attribute for BIN-based Potree datasets.
 */
export type PotreePointCloudAttribute = PointCloudAttribute & {
    // Stronger typing than string
    name: AttributeName;

    // Whether this attribute should be normalized on the 0-1 floating point range.
    normalized: boolean;

    // The original potree attribute
    potreeAttribute: PotreeAttribute;

    // The byte offset where this attribute starts in the buffer.
    offset: number;
};

function getDefaultMin(type: PotreeDataType): number | undefined {
    switch (type) {
        case PotreeDataType.Uint8:
        case PotreeDataType.Uint16:
        case PotreeDataType.Uint32:
            return 0;
        case PotreeDataType.Float:
        case PotreeDataType.Double:
            return undefined;
    }
}

function attribute(
    type: PotreeDataType,
    dimension: PotreeAttribute['dimension'],
    normalized?: boolean,
    interpretation?: PointCloudAttribute['interpretation'],
    min?: number,
    max?: number,
): PotreeAttribute {
    return {
        type,
        dimension,
        normalized: normalized ?? false,
        interpretation: interpretation ?? 'unknown',
        min: min ?? getDefaultMin(type),
        max,
    };
}

const POTREE_ATTRIBUTES: Record<AttributeName, PotreeAttribute> = {
    POSITION_CARTESIAN: attribute(PotreeDataType.Float, 3),

    // Color attributes. We don't support the alpha component.
    COLOR_PACKED: attribute(PotreeDataType.Uint8, 4, true, 'color'),
    RGBA_PACKED: attribute(PotreeDataType.Uint8, 4, true, 'color'),
    RGB_PACKED: attribute(PotreeDataType.Uint8, 3, true, 'color'),

    // Normal attributes (unsupported)
    NORMAL_FLOATS: attribute(PotreeDataType.Float, 3),
    NORMAL: attribute(PotreeDataType.Float, 3),
    NORMAL_SPHEREMAPPED: attribute(PotreeDataType.Uint8, 2),
    NORMAL_OCT16: attribute(PotreeDataType.Uint8, 2),

    // LAS-like attributes
    INTENSITY: attribute(PotreeDataType.Uint16, 1),
    CLASSIFICATION: attribute(PotreeDataType.Uint8, 1, false, 'classification'),
    RETURN_NUMBER: attribute(PotreeDataType.Uint8, 1),
    NUMBER_OF_RETURNS: attribute(PotreeDataType.Uint8, 1),
    SOURCE_ID: attribute(PotreeDataType.Uint16, 1),
    GPS_TIME: attribute(PotreeDataType.Double, 1),

    // Misc
    SPACING: attribute(PotreeDataType.Float, 1),
    INDICES: attribute(PotreeDataType.Uint32, 1),
};

/** The list of attributes that we expose to the API. */
export const EXPOSED_ATTRIBUTES: Set<AttributeName | DimensionName | 'Color'> = new Set([
    // BIN based potree clouds
    'COLOR_PACKED',
    'RGBA_PACKED',
    'RGB_PACKED',
    'INTENSITY',
    'CLASSIFICATION',
    'RETURN_NUMBER',
    'NUMBER_OF_RETURNS',
    'SOURCE_ID',
    'GPS_TIME',
    'SPACING',
    'INDICES',

    // LAZ-based potree clouds
    'Color',
    'Classification',
    'Intensity',
    'GpsTime',
    'ReturnNumber',
    'PointSourceId',
    'NumberOfReturns',
    'Z',
]);

const UNSUPPORTED_ATTRIBUTES: Set<AttributeName> = new Set([
    'NORMAL',
    'NORMAL_FLOATS',
    'NORMAL_OCT16',
    'NORMAL_SPHEREMAPPED',
]);

function getSize(type: PotreeDataType): number {
    switch (type) {
        case PotreeDataType.Uint8:
            return 1;
        case PotreeDataType.Uint16:
            return 2;
        case PotreeDataType.Uint32:
        case PotreeDataType.Float:
            return 4;
        case PotreeDataType.Double:
            return 8;
    }
}

function mapSize(type: PotreeDataType): PointCloudAttribute['size'] {
    switch (type) {
        case PotreeDataType.Uint8:
            return 1;
        case PotreeDataType.Uint16:
            return 2;
        case PotreeDataType.Uint32:
        case PotreeDataType.Float:
        case PotreeDataType.Double:
            // We have to downcast 64-bit numbers to 32-bit.
            return 4;
    }
}

function mapType(type: PotreeDataType): PointCloudAttribute['type'] {
    switch (type) {
        case PotreeDataType.Uint8:
        case PotreeDataType.Uint16:
        case PotreeDataType.Uint32:
            return 'unsigned';
        case PotreeDataType.Float:
        case PotreeDataType.Double:
            return 'float';
    }
}

function mapDimension(input: PotreeAttribute['dimension']): PointCloudAttribute['dimension'] {
    switch (input) {
        case 4:
            // The point cloud source does not support 4-component vectors (i.e RGBA colors),
            // so we have to ignore the 4th component.
            return 3;
        case 2:
            // This should not happen since Vec2 attributes such as NORMAL_OCT16 are not exposed.
            throw new Error('not supported.');
        default:
            return input;
    }
}

/**
 * Generates a reader function from an attribute and a byte offset.
 *
 * Note: Potree .bin data has interleaved attributes: X0,Y0,Z0,R0,G0,B0,A0,[...],Xn,Yn,Zn,Rn,Gn,Bn,An
 */
type ReaderGen = (
    attribute: PotreeAttribute,
    attributeOffset: number,
    pointByteSize: number,
) => Reader;

const readScalar: ReaderGen = (
    attribute: PotreeAttribute,
    attributeOffset: number,
    pointByteSize: number,
) => {
    let readFn: (view: DataView, offset: number) => number;

    switch (attribute.type) {
        case PotreeDataType.Uint8:
            readFn = (view, offset) => view.getUint8(offset);
            break;
        case PotreeDataType.Uint16:
            readFn = (view, offset) => view.getUint16(offset, true);
            break;
        case PotreeDataType.Uint32:
            readFn = (view, offset) => view.getUint32(offset, true);
            break;
        case PotreeDataType.Float:
            readFn = (view, offset) => view.getFloat32(offset, true);
            break;
        case PotreeDataType.Double:
            readFn = (view, offset) => view.getFloat64(offset, true);
            break;
    }

    return (view, pointIndex, target) => {
        const offset = pointIndex * pointByteSize + attributeOffset;
        target[pointIndex] = readFn(view, offset);
    };
};

const readPositionCartesian: ReaderGen = (_attribute, attributeOffset, pointByteSize) => {
    const itemSize = 4; // 4 bytes per component

    return (view, pointIndex, target) => {
        const offset = pointIndex * pointByteSize + attributeOffset;

        const x = view.getUint32(offset + 0 * itemSize, true);
        const y = view.getUint32(offset + 1 * itemSize, true);
        const z = view.getUint32(offset + 2 * itemSize, true);

        target[pointIndex * 3 + 0] = x;
        target[pointIndex * 3 + 1] = y;
        target[pointIndex * 3 + 2] = z;
    };
};

const readColor: ReaderGen = (attribute, attributeOffset, pointByteSize) => {
    return (view, pointIndex, target) => {
        const offset = pointIndex * pointByteSize + attributeOffset;

        // Note that we ignore the alpha component (i.e RGBA_PACKED is equivalent to RGB_PACKED)
        const r = view.getUint8(offset + 0);
        const g = view.getUint8(offset + 1);
        const b = view.getUint8(offset + 2);

        target[pointIndex * 3 + 0] = r;
        target[pointIndex * 3 + 1] = g;
        target[pointIndex * 3 + 2] = b;
    };
};

export function createReader(attribute: PotreePointCloudAttribute, pointByteSize: number): Reader {
    const { name, offset, potreeAttribute } = attribute;
    if (name === 'POSITION_CARTESIAN') {
        return readPositionCartesian(potreeAttribute, offset, pointByteSize);
    }

    // Some special readers
    switch (attribute.interpretation) {
        case 'color':
            return readColor(potreeAttribute, offset, pointByteSize);
    }

    return readScalar(potreeAttribute, offset, pointByteSize);
}

export function processLazAttributes(boundingBox: BoundingBox): LazPointCloudAttribute[] {
    const result: LazPointCloudAttribute[] = [];

    function attr(
        name: DimensionName | 'Color',
        dimension: PointCloudAttribute['dimension'],
        size: PointCloudAttribute['size'],
        type: PointCloudAttribute['type'],
        interp?: PointCloudAttribute['interpretation'],
    ): LazPointCloudAttribute {
        const result: LazPointCloudAttribute = {
            name,
            dimension,
            size,
            type,
            interpretation: interp ?? 'unknown',
        };

        if (name === 'Color') {
            result.min = 0;
            result.max = 255;
        } else if (name === 'Z') {
            result.min = boundingBox.lz;
            result.max = boundingBox.uz;
        } else if (DEFAULT_VALUE_RANGES[name] != null) {
            const { min, max } = DEFAULT_VALUE_RANGES[name];
            result.min = min;
            result.max = max;
        }

        return result;
    }

    result.push(attr('Z', 1, 4, 'float'));
    result.push(attr('Color', 3, 1, 'unsigned', 'color'));
    result.push(attr('Intensity', 1, 2, 'unsigned'));
    result.push(attr('Classification', 1, 1, 'unsigned', 'classification'));
    result.push(attr('GpsTime', 1, 4, 'float'));
    result.push(attr('NumberOfReturns', 1, 1, 'unsigned'));
    result.push(attr('ReturnNumber', 1, 1, 'unsigned'));
    result.push(attr('PointSourceId', 1, 2, 'unsigned'));

    return result;
}

/**
 * Given a list of attribute names, returns a list of actual attributes.
 */
export function processAttributes(names: Readonly<AttributeName[]>): {
    attributes: PotreePointCloudAttribute[];
    pointByteSize: number;
} {
    let offset = 0;
    let pointByteSize = 0;

    const attributes: PotreePointCloudAttribute[] = [];

    // Loop once to compute the total byte size of a single point, including all attributes.
    // This will be used to compute the byte offsets when reading the data buffer.
    for (const name of names) {
        const potreeAttribute = defined(POTREE_ATTRIBUTES, name);
        const sizeBytes = potreeAttribute.dimension * getSize(potreeAttribute.type);

        pointByteSize += sizeBytes;
    }

    for (const name of names) {
        if (UNSUPPORTED_ATTRIBUTES.has(name)) {
            continue;
        }

        const potreeAttribute = defined(POTREE_ATTRIBUTES, name);
        const sizeBytes = potreeAttribute.dimension * getSize(potreeAttribute.type);

        const minmax = getMinMax(name);

        const sourceAttribute: PotreePointCloudAttribute = {
            name,
            normalized: potreeAttribute.normalized,
            interpretation: potreeAttribute.interpretation,
            dimension: mapDimension(potreeAttribute.dimension),
            size: mapSize(potreeAttribute.type),
            type: mapType(potreeAttribute.type),
            potreeAttribute,
            offset,
            min: minmax?.min,
            max: minmax?.max,
        };

        attributes.push(sourceAttribute);

        offset += sizeBytes;
    }

    return { attributes, pointByteSize };
}

export function getTypedArray(
    type: PotreePointCloudAttribute['type'],
    size: PotreePointCloudAttribute['size'],
    dimension: PotreePointCloudAttribute['dimension'],
    itemCount: number,
): TypedArray {
    const arrayLength = itemCount * dimension;

    switch (type) {
        case 'signed':
            switch (size) {
                case 1:
                    return new Int8Array(arrayLength);
                case 2:
                    return new Int16Array(arrayLength);
                case 4:
                    return new Int32Array(arrayLength);
            }
            break;
        case 'unsigned':
            switch (size) {
                case 1:
                    return new Uint8Array(arrayLength);
                case 2:
                    return new Uint16Array(arrayLength);
                case 4:
                    return new Uint32Array(arrayLength);
            }
            break;
        case 'float':
            return new Float32Array(arrayLength);
    }
}
function getMinMax(name: AttributeName): { min: number; max: number } | undefined {
    switch (name) {
        case 'RGB_PACKED':
        case 'RGBA_PACKED':
        case 'COLOR_PACKED':
        case 'CLASSIFICATION':
            return { min: 0, max: 255 };
        case 'INTENSITY':
            return { min: 0, max: 65535 };
        case 'RETURN_NUMBER':
            return { min: 0, max: 7 };
        case 'NUMBER_OF_RETURNS':
            return { min: 0, max: 7 };
        default:
            return undefined;
    }
}
