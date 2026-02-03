/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid';
import EllipsoidTileGeometryBuilder from '@giro3d/giro3d/entities/tiles/EllipsoidTileGeometryBuilder';

describe('rootTileMatrix', () => {
    it('should return 4x2', () => {
        const builder = new EllipsoidTileGeometryBuilder(Ellipsoid.WGS84, 32, null);
        expect(builder.rootTileMatrix).toEqual(new Vector2(4, 2));
    });
});
