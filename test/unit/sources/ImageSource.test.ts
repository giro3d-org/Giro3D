import Extent from '@giro3d/giro3d/core/geographic/Extent';
import type {
    CustomContainsFn,
    GetImageOptions,
    ImageResponse,
} from '@giro3d/giro3d/sources/ImageSource';
import ImageSource from '@giro3d/giro3d/sources/ImageSource';

class TestSource extends ImageSource {
    extent: Extent;

    constructor(opts: { extent: Extent; containsFn?: CustomContainsFn }) {
        super({ containsFn: opts.containsFn });
        this.extent = opts.extent;
    }

    getCrs() {
        return this.extent.crs();
    }

    getExtent() {
        return this.extent;
    }

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
    getImages(options: GetImageOptions): ImageResponse[] {
        throw new Error('Method not implemented.');
    }
}

describe('ImageSource', () => {
    describe('contains', () => {
        it('should use the custom contains function if it exists', () => {
            const customFunction = jest.fn();
            const sourceExtent = new Extent('EPSG:3857', 0, 10, 0, 10);

            const source = new TestSource({ containsFn: customFunction, extent: sourceExtent });

            const extentToTest = new Extent('EPSG:4326', -179, 180, -90, 90);

            source.contains(extentToTest);

            expect(customFunction).not.toHaveBeenCalledWith(extentToTest);
            expect(customFunction).toHaveBeenCalledWith(extentToTest.clone().as('EPSG:3857'));
        });

        it('should default to the intersection of the extent and the source extent', () => {
            const sourceExtent = new Extent('EPSG:3857', 0, 10, 0, 10);
            const extentToTest = new Extent('EPSG:3857', 1, 2, 3, 4);

            const source = new TestSource({ extent: sourceExtent });

            expect(source.contains(extentToTest)).toEqual(true);
        });
    });
});
