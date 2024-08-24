import proj4 from 'proj4';
import type { CreateValueFn } from '../../utils/NestedMap';
import NestedMap from '../../utils/NestedMap';

type SrcCrs = string;
type DstCrs = string;

const createConverter: CreateValueFn<SrcCrs, DstCrs, proj4.Converter> = (
    src: SrcCrs,
    dst: DstCrs,
) => proj4(src, dst);

const cache: NestedMap<SrcCrs, DstCrs, proj4.Converter> = new NestedMap();

/**
 * Returns a coordinate converter from the specified source and destination CRSes.
 */
export function getConverter(crsIn: string, crsOut: string): proj4.Converter {
    return cache.getOrCreate(crsIn, crsOut, createConverter);
}
