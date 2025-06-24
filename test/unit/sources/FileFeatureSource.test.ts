import type FeatureFormat from 'ol/format/Feature';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import FileFeatureSource from '@giro3d/giro3d/sources/FileFeatureSource';
import { Projection } from 'ol/proj';

describe('FileFeatureSource', () => {
    describe('getFeatures', () => {
        it('should load the file', async () => {
            // @ts-expect-error incomplete implementation
            const format: FeatureFormat = {
                getType: () => 'json',
                readProjection: () => new Projection({ code: 'EPSG:4326' }),
                readFeatures: () => [],
            };

            const data = '';
            const getter = jest.fn(() => Promise.resolve(data));

            const source = new FileFeatureSource({
                url: 'foo',
                format,
                getter,
            });

            await source.initialize({ targetProjection: CoordinateSystem.epsg4326 });

            await source.getFeatures({ extent: Extent.WGS84 });

            expect(getter).toHaveBeenCalledWith('foo', 'json');
        });
    });
});
