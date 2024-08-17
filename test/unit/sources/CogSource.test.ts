import Extent from '@giro3d/giro3d/core/geographic/Extent';
import CogSource from '@giro3d/giro3d/sources/CogSource';
import type { GeoTIFFImage } from 'geotiff';

describe('CogSource', () => {
    describe('constructor', () => {
        it('should assign properties', () => {
            const containsFn = jest.fn();
            const source = new CogSource({
                url: 'http://example.com',
                crs: 'EPSG:1234',
                containsFn,
            });
            expect(source.url).toEqual('http://example.com');
            expect(source.crs).toEqual('EPSG:1234');
            expect(source.containsFn).toBe(containsFn);
        });
    });

    describe('initialize', () => {
        it('should always return the same promise to avoid concurrent initializations', () => {
            const source = new CogSource({ url: 'http://example.com', crs: 'EPSG:1234' });
            const promise1 = source.initialize();
            const promise2 = source.initialize();

            expect(promise1).toBe(promise2);
        });
    });

    describe('adjustExtentAndPixelSize', () => {
        it('should not return huge texture sizes', () => {
            const source = new CogSource({
                url: 'foo',
                crs: 'EPSG:3857',
            });

            const sourceExtent = new Extent('EPSG:3857', 0, 1, 0, 1);

            // @ts-expect-error property is private
            source._extent = sourceExtent;
            // @ts-expect-error property is private
            source._imageCount = 1;
            // @ts-expect-error property is private
            source._dimensions = sourceExtent.dimensions();
            // @ts-expect-error property is private
            source._images = [{ width: 1024, height: 1024 }];

            const requestExtent = sourceExtent.withRelativeMargin(1000);

            const result = source.adjustExtentAndPixelSize(requestExtent, 512, 512);

            expect(result.width).not.toBeGreaterThan(1000);
            expect(result.height).not.toBeGreaterThan(1000);
        });
    });

    describe('computeExtent', () => {
        it('should rethrow unknown exceptions', () => {
            function getBoundingBox(): number[] {
                throw new Error('unknown');
            }

            const image = {
                getBoundingBox,
            };
            expect(() => CogSource.computeExtent('EPSG:3857', image as GeoTIFFImage)).toThrow(
                /unknown/,
            );
        });

        it('should return the computed extent from the image bounding box if found', () => {
            const minx = 1;
            const miny = 2;
            const maxx = 3;
            const maxy = 4;

            const image = {
                getBoundingBox: () => [minx, miny, maxx, maxy],
            };

            const extent = CogSource.computeExtent('EPSG:3857', image as GeoTIFFImage);

            expect(extent).toEqual(new Extent('EPSG:3857', minx, maxx, miny, maxy));
        });
    });
});
