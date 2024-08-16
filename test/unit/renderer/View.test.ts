import View from 'src/renderer/View';
import { PerspectiveCamera } from 'three';

const DEFAULT_CRS = 'EPSG:1234';

describe('Camera', () => {
    describe('constructor', () => {
        it('should assign properties', () => {
            const width = 123;
            const height = 456;
            const crs = 'EPSG:1234';
            const options = {};
            const view = new View(crs, width, height, options);

            expect(view.crs).toEqual(crs);
            expect(view.width).toEqual(width);
            expect(view.height).toEqual(height);
            expect(view.camera).toBeInstanceOf(PerspectiveCamera);
        });
    });

    describe('update', () => {
        it('should update the size', () => {
            const view = new View(DEFAULT_CRS, 0, 0);

            view.update(123, 456);

            expect(view.width).toEqual(123);
            expect(view.height).toEqual(456);
        });
    });
});
