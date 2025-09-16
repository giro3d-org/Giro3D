/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import OpenLayersUtils from '@giro3d/giro3d/utils/OpenLayersUtils';

describe('toOLExtent/fromOLExtent', () => {
    it('should round trip', () => {
        const extent = new Extent(CoordinateSystem.epsg3857, 1203, 405405, -20323, 202020);
        const ol = OpenLayersUtils.toOLExtent(extent);
        const extent2 = OpenLayersUtils.fromOLExtent(ol, extent.crs);

        expect(extent.crs).toEqual(extent2.crs);
        expect(extent.values).toEqual(extent2.values);
    });
});
