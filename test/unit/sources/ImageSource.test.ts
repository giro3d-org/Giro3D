/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it, vitest } from 'vitest';

import type {
    CustomContainsFn,
    GetImageOptions,
    ImageResponse,
} from '@giro3d/giro3d/sources/ImageSource';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import ImageSource from '@giro3d/giro3d/sources/ImageSource';

class TestSource extends ImageSource {
    extent: Extent;

    constructor(opts: { extent: Extent; containsFn?: CustomContainsFn }) {
        super({ containsFn: opts.containsFn });
        this.extent = opts.extent;
    }

    getCrs() {
        return this.extent.crs;
    }

    getExtent() {
        return this.extent;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getImages(options: GetImageOptions): ImageResponse[] {
        throw new Error('Method not implemented.');
    }
}

describe('contains', () => {
    it('should use the custom contains function if it exists', () => {
        const customFunction = vitest.fn();
        const sourceExtent = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);

        const source = new TestSource({ containsFn: customFunction, extent: sourceExtent });

        const extentToTest = new Extent(CoordinateSystem.epsg4326, -179, 180, -90, 90);

        source.contains(extentToTest);

        expect(customFunction).not.toHaveBeenCalledWith(extentToTest);
        expect(customFunction).toHaveBeenCalledWith(
            extentToTest.clone().as(CoordinateSystem.epsg3857),
        );
    });

    it('should default to the intersection of the extent and the source extent', () => {
        const sourceExtent = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extentToTest = new Extent(CoordinateSystem.epsg3857, 1, 2, 3, 4);

        const source = new TestSource({ extent: sourceExtent });

        expect(source.contains(extentToTest)).toEqual(true);
    });
});
