/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import ProjUtils from '@giro3d/giro3d/utils/ProjUtils';

describe('transformBufferInPlace', () => {
    it('should do nothing if both CRSes are equal', () => {
        const buffer = new Float64Array([0, 1, 2]);
        ProjUtils.transformBufferInPlace(buffer, {
            srcCrs: CoordinateSystem.fromEpsg(1234),
            dstCrs: CoordinateSystem.fromEpsg(1234),
            stride: 3,
        });

        expect(buffer[0]).toEqual(0);
        expect(buffer[1]).toEqual(1);
        expect(buffer[2]).toEqual(2);
    });

    it('should honor the stride, leaving unrelated values untouched', () => {
        const Z = 99999;
        const W = 12345;
        const vec3Buffer = new Float64Array([1.2, 0.2, Z, 2.3, 10.2, Z]);
        const vec4Buffer = new Float64Array([1.2, 0.2, Z, W, 2.3, 10.2, Z, W]);

        ProjUtils.transformBufferInPlace(vec3Buffer, {
            srcCrs: CoordinateSystem.epsg4326,
            dstCrs: CoordinateSystem.epsg3857,
            stride: 3,
        });

        expect(vec3Buffer[0]).toBeCloseTo(133583.38895192827);
        expect(vec3Buffer[1]).toBeCloseTo(22263.943371933852);
        expect(vec3Buffer[2]).toEqual(Z);

        expect(vec3Buffer[3]).toBeCloseTo(256034.82882452922);
        expect(vec3Buffer[4]).toBeCloseTo(1141504.335717432);
        expect(vec3Buffer[5]).toEqual(Z);

        ProjUtils.transformBufferInPlace(vec4Buffer, {
            srcCrs: CoordinateSystem.epsg4326,
            dstCrs: CoordinateSystem.epsg3857,
            stride: 4,
        });

        expect(vec4Buffer[0]).toBeCloseTo(133583.38895192827);
        expect(vec4Buffer[1]).toBeCloseTo(22263.943371933852);
        expect(vec4Buffer[2]).toEqual(Z);
        expect(vec4Buffer[3]).toEqual(W);

        expect(vec4Buffer[4]).toBeCloseTo(256034.82882452922);
        expect(vec4Buffer[5]).toBeCloseTo(1141504.335717432);
        expect(vec4Buffer[6]).toEqual(Z);
        expect(vec4Buffer[7]).toEqual(W);
    });

    it('should honor the offset', () => {
        const Z = 99999;
        const vec3Buffer = new Float64Array([1.2, 0.2, Z, 2.3, 10.2, Z]);

        ProjUtils.transformBufferInPlace(vec3Buffer, {
            srcCrs: CoordinateSystem.epsg4326,
            dstCrs: CoordinateSystem.epsg3857,
            stride: 3,
            offset: new Vector2(-1000, -1000),
        });

        expect(vec3Buffer[0]).toBeCloseTo(132583.38895192827);
        expect(vec3Buffer[1]).toBeCloseTo(21263.943371933852);
        expect(vec3Buffer[2]).toEqual(Z);

        expect(vec3Buffer[3]).toBeCloseTo(255034.82882452922);
        expect(vec3Buffer[4]).toBeCloseTo(1140504.335717432);
        expect(vec3Buffer[5]).toEqual(Z);
    });
});
