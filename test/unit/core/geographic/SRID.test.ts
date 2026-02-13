/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import SRID from '@giro3d/giro3d/core/geographic/SRID';

describe('constructor', () => {
    it('should assign property authority and code', () => {
        const srid = new SRID('EPSG', 4978);
        expect(srid.authority).toEqual('EPSG');
        expect(srid.code).toEqual(4978);
    });
});

describe('parse()', () => {
    it('should correctly parse string', () => {
        const srid = SRID.parse('EPSG:4978');
        expect(srid.authority).toEqual('EPSG');
        expect(srid.code).toEqual(4978);
    });
});

describe('toString', () => {
    it('should properly format SRID', () => {
        const srid = new SRID('EPSG', 4978);
        expect(srid.toString()).toEqual('EPSG:4978');
    });
});

describe('isEpsg()', () => {
    it('should detect epsg', () => {
        const srid = SRID.parse('EPSG:2992');
        expect(srid.isEpsg(2992)).toEqual(true);
        expect(srid.isEpsg(4978)).toEqual(false);
    });
});

describe('tryGetEpsgCode()', () => {
    it('should extract epsg code', () => {
        const srid = SRID.parse('EPSG:2992');
        expect(srid.tryGetEpsgCode()).toEqual(2992);
    });

    it('should return null if SRID is not EPSG', () => {
        const srid = SRID.parse('ESRI:1234');
        expect(srid.tryGetEpsgCode()).toEqual(null);
    });
});
