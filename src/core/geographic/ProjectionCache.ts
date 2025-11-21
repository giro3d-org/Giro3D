/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import proj4 from 'proj4';

import type { CreateValueFn } from '../../utils/NestedMap';
import type CoordinateSystem from './CoordinateSystem';

import NestedMap from '../../utils/NestedMap';

type SrcCrs = CoordinateSystem;
type DstCrs = CoordinateSystem;

const createConverter: CreateValueFn<SrcCrs, DstCrs, proj4.Converter> = (
    src: SrcCrs,
    dst: DstCrs,
) => proj4(src.id, dst.id);

const cache: NestedMap<SrcCrs, DstCrs, proj4.Converter> = new NestedMap();

/**
 * Returns a coordinate converter from the specified source and destination CRSes.
 */
export function getConverter(crsIn: CoordinateSystem, crsOut: CoordinateSystem): proj4.Converter {
    return cache.getOrCreate(crsIn, crsOut, createConverter);
}
