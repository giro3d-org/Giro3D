import type { Dimension } from 'copc';
import type { Box3 } from 'three';
import type { PointCloudAttribute } from '../PointCloudSource';
import type { DimensionFilter } from './filter';

// The list of supported LAS dimensions.
export type DimensionName =
    | 'X'
    | 'Y'
    | 'Z'
    | 'Intensity'
    | 'ReturnNumber'
    | 'NumberOfReturns'
    | 'ScanDirectionFlag'
    | 'EdgeOfFlightLine'
    | 'Classification'
    | 'ScanAngle'
    | 'ScanAngleRank'
    | 'Red'
    | 'Green'
    | 'Blue'
    | 'UserData'
    | 'ScannerChannel'
    | 'PointSourceId'
    | 'Infrared'
    | 'ScanChannel'
    | 'ScannerChannel'
    | 'GpsTime';

const bitRange = (bits: number) => ({ min: 0, max: 2 ** bits - 1 });
const boolRange = { min: 0, max: 1 };
const u8Range = { min: 0, max: 255 };
const u16Range = { min: 0, max: 65536 };

/**
 * Default min/max values for various LAS dimensions. Most default values are directly dependent on
 * the data type of the dimension (e.g a `Uint8` dimensions will have a default range of 0-255), but
 * some dimensions have narrower min/max, for example `ScanAngle`:
 *
 * ```js
 * // Get the default min/max for return number
 * const { min, max } = DEFAULT_VALUE_RANGES['ReturnNumber'];
 * // { min: 0, max: 8 }
 * ```
 */
export const DEFAULT_VALUE_RANGES: Record<DimensionName, { min?: number; max?: number }> = {
    // Point Data Record Format 0
    X: { min: undefined, max: undefined },
    Y: { min: undefined, max: undefined },
    Z: { min: undefined, max: undefined },
    Intensity: u16Range,
    ReturnNumber: bitRange(3),
    NumberOfReturns: bitRange(3),
    ScanDirectionFlag: boolRange,
    EdgeOfFlightLine: boolRange,
    Classification: u8Range,
    ScanAngle: { min: -90, max: +90 },
    ScanAngleRank: { min: -90, max: +90 },
    UserData: u8Range,
    PointSourceId: u16Range,
    ScanChannel: u16Range,

    GpsTime: { min: 0, max: +9999 },

    Red: u16Range,
    Green: u16Range,
    Blue: u16Range,

    ScannerChannel: bitRange(2),

    Infrared: u16Range,
};

/**
 * Given a size in bytes for a LAS dimension, return a size in bytes for point cloud attributes,
 * performing downcasting for unsupported sizes (i.e 64-bit numbers).
 */
function getAttributeByteSize(input: Dimension['size']): PointCloudAttribute['size'] {
    switch (input) {
        case 8:
            // Since shaders do not support 64-bit numbers, we have to downcast them to 32-bit.
            return 4;
        default:
            // Other sizes are well supported in shaders, no need for downcasting.
            return input;
    }
}

/**
 * Extracts attributes from LAS dimensions.
 */
export function extractAttributes(
    dimensions: Dimension.Map,
    volume: Box3,
    compressColors: boolean,
    gpsTimeRange: [number, number] | null,
): PointCloudAttribute[] {
    const dimensionKeys = new Set(Object.keys(dimensions));

    const has = (...dims: DimensionName[]) => {
        for (const dim of dims) {
            if (!dimensionKeys.has(dim)) {
                return false;
            }
        }

        return true;
    };

    function getInterpretation(
        dimensionName: DimensionName,
    ): PointCloudAttribute['interpretation'] {
        if (dimensionName === 'Classification') {
            return 'classification';
        }

        return 'unknown';
    }

    const result: PointCloudAttribute[] = [];

    // Pseudo-dimension 'Color'
    if (has('Red', 'Green', 'Blue')) {
        result.push({
            name: 'Color',
            interpretation: 'color',
            type: 'unsigned',
            size: compressColors ? 1 : 2,
            dimension: 3,
            min: 0,
            max: compressColors ? 255 : 65535,
        });
    }

    for (const entry of Object.entries(dimensions)) {
        const name = entry[0] as DimensionName;
        const dimension = entry[1];

        if (dimension == null) {
            continue;
        }

        if (name === 'X' || name === 'Y') {
            continue;
        }

        if (name === 'Z') {
            result.push({
                dimension: 1,
                interpretation: 'unknown',
                type: 'float',
                size: getAttributeByteSize(dimension.size),
                name: 'Z',
                min: volume.min.z,
                max: volume.max.z,
            });
            continue;
        }

        // Special case for GPS time range, since we may
        // have the bounds in the file header
        if (name === 'GpsTime' && gpsTimeRange != null) {
            result.push({
                dimension: 1,
                interpretation: 'unknown',
                type: 'float',
                size: getAttributeByteSize(dimension.size),
                name: 'GpsTime',
                min: gpsTimeRange[0],
                max: gpsTimeRange[1],
            });
            continue;
        }

        const type = dimension.type;

        if (type == null) {
            continue;
        }

        const range = DEFAULT_VALUE_RANGES[name as DimensionName];
        const attr: PointCloudAttribute = {
            name,
            dimension: 1,
            size: getAttributeByteSize(dimension.size),
            type,
            interpretation: getInterpretation(name as DimensionName),
            min: range?.min,
            max: range?.max,
        };

        result.push(attr);
    }

    return result;
}

/**
 * Return all the dimensions that we expect to read from a given view. The dimensions are the union
 * of the required dimensions (the X, Y, Z dimension), the optional requested attribute, and all the
 * dimensions that are concerned by filters, if any.
 *
 * For example: if we want to read intensities, but exclude some classifications and GPS time, we
 * have to read dimensions:
 * - `X`, `Y`, `Z` for the point position,
 * - `Intensity` for the requested attribute
 * - `Classification` and `GpsTime` for filtering.
 */
export function getDimensionsToRead(
    attribute: PointCloudAttribute | undefined,
    readPosition: boolean,
    filters: DimensionFilter[],
): DimensionName[] {
    const set = new Set<DimensionName>(readPosition ? ['X', 'Y', 'Z'] : []);

    for (const filter of filters) {
        set.add(filter.dimension);
    }

    if (attribute != null) {
        if (attribute.interpretation === 'color') {
            set.add('Red');
            set.add('Green');
            set.add('Blue');
        } else {
            set.add(attribute.name as DimensionName);
        }
    }

    return [...set];
}
