import Extent from '@giro3d/giro3d/core/geographic/Extent';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import OpenLayersUtils from '@giro3d/giro3d/utils/OpenLayersUtils';
import { describe, expect, it } from 'vitest';

describe('toOLExtent/fromOLExtent', () => {
    it('should round trip', () => {
        const extent = new Extent(CoordinateSystem.epsg3857, 1203, 405405, -20323, 202020);
        const ol = OpenLayersUtils.toOLExtent(extent);
        const extent2 = OpenLayersUtils.fromOLExtent(ol, extent.crs);

        expect(extent.crs).toEqual(extent2.crs);
        expect(extent.values).toEqual(extent2.values);
    });
});
