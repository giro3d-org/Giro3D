/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import StadiaMaps from 'ol/source/StadiaMaps.js';
import { UnsignedByteType } from 'three';
import { describe, expect, it, test, vitest } from 'vitest';

import GeoTIFFFormat from '@giro3d/giro3d/formats/GeoTIFFFormat';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource';

const source = new StadiaMaps({ layer: 'stamen_watercolor', apiKey: 'foo', retina: false });

describe('constructor', () => {
    it('should assign properties', () => {
        const containsFn = vitest.fn();
        const format = new GeoTIFFFormat();
        const noDataValue = 999;

        const tiled = new TiledImageSource({
            source,
            containsFn,
            format,
            noDataValue,
        });

        expect(tiled.format).toBe(format);
        expect(tiled.type).toEqual('TiledImageSource');
        expect(tiled.isTiledImageSource).toEqual(true);
        expect(tiled.containsFn).toBe(containsFn);
        expect(tiled.noDataValue).toEqual(noDataValue);
        expect(tiled.source).toBe(source);
    });

    it('should assign flipY to false by default, as flipping is handled internally', () => {
        const tiled = new TiledImageSource({
            source,
        });

        expect(tiled.flipY).toEqual(false);
    });

    describe.each([true, false])(
        'should assign flipY to the flipY of the format, if provided',
        b => {
            test(`${b}`, () => {
                const flipY = b;

                const tiled = new TiledImageSource({
                    source,
                    format: {
                        flipY,
                        dataType: UnsignedByteType,
                        isImageFormat: true,
                        type: '',
                        decode: vitest.fn(),
                    },
                });

                expect(tiled.flipY).toEqual(flipY);
            });
        },
    );
});
