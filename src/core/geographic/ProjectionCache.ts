import proj4 from 'proj4';

const cache: Map<string, Map<string, proj4.Converter>> = new Map();

/**
 * Returns a coordinate converter from the specified source and destination CRSes.
 */
export function getConverter(crsIn: string, crsOut: string): proj4.Converter {
    if (cache.has(crsIn)) {
        const p = cache.get(crsIn);
        if (p.has(crsOut)) {
            return p.get(crsOut);
        }
    } else {
        cache.set(crsIn, new Map());
    }
    const converter = proj4(crsIn, crsOut);
    cache.get(crsIn).set(crsOut, converter);
    return converter;
}
