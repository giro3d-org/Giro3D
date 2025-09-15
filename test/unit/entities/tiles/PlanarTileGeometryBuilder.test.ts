/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import Extent from '@giro3d/giro3d/core/geographic/Extent';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import PlanarTileGeometryBuilder from '@giro3d/giro3d/entities/tiles/PlanarTileGeometryBuilder';
import { describe, expect, it } from 'vitest';

describe('rootTileMatrix', () => {
    it('should produce multiple horizontal root tiles if needed', async () => {
        const horizontalExtent = new Extent(CoordinateSystem.epsg3857, -250, 250, -100, 100);
        const builder = new PlanarTileGeometryBuilder({
            extent: horizontalExtent,
            maxAspectRatio: 10,
            segments: 32,
            skirtDepth: undefined,
        });

        expect(builder.rootTileMatrix).toEqual({ x: 3, y: 1 });
    });

    it('should produce multiple vertical root tiles if needed', async () => {
        const verticalExtent = new Extent(CoordinateSystem.epsg3857, -100, 100, -250, 250);
        const builder = new PlanarTileGeometryBuilder({
            extent: verticalExtent,
            maxAspectRatio: 10,
            segments: 32,
            skirtDepth: undefined,
        });
        expect(builder.rootTileMatrix).toEqual({ x: 1, y: 3 });
    });
});
