/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import Authority from '@giro3d/giro3d/core/geographic/coordinate-system/Authority';

describe('constructor', () => {
    it('should assign property crs', () => {
        const authority = new Authority('EPSG:4978');
        expect(authority.asString).toEqual('EPSG:4978');
    });
});

describe('isEpsg()', () => {
    it('should detect epsg', () => {
        const authority = new Authority('EPSG:2992');
        expect(authority.isEpsg()).toEqual(true);
        expect(authority.isEpsg(2992)).toEqual(true);
        expect(authority.isEpsg(4978)).toEqual(false);
    });
});

describe('tryGetEpsgCode()', () => {
    it('should extract epsg code', () => {
        const authority = new Authority('EPSG:2992');
        expect(authority.tryGetEpsgCode()).toEqual(2992);
    });
});
