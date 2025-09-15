/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import Extent from '@giro3d/giro3d/core/geographic/Extent';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection';
import VectorSource from 'ol/source/Vector';
import { describe, expect, it } from 'vitest';

describe('constructor', () => {
    const source = new VectorSource();
    const extent = new Extent(CoordinateSystem.epsg4326, {
        west: 0,
        east: 10,
        south: 0,
        north: 10,
    });

    it('should throw if the extent is not provided', () => {
        // @ts-expect-error null parameter
        expect(() => new FeatureCollection({ source, extent: null })).toThrow(
            /Error while initializing FeatureCollection: missing options.extent/,
        );
    });

    it('should throw if the extent is invalid', () => {
        // reversed extent (min values are greater than max values)
        const invalid = new Extent(CoordinateSystem.epsg3857, +10, -10, +5, -5);

        expect(() => new FeatureCollection({ source, extent: invalid })).toThrow(/Invalid extent/);
    });

    it('should throw if the source is not present', () => {
        // @ts-expect-error source is undefined
        expect(() => new FeatureCollection({ extent })).toThrow('options.source is mandatory.');
        // @ts-expect-error source is null
        expect(() => new FeatureCollection({ extent, source: null })).toThrow(
            'options.source is mandatory.',
        );
    });

    it('should assign the correct options', () => {
        const fc = new FeatureCollection({
            source,
            extent,
            minLevel: 10,
            maxLevel: 15,
            elevation: 50,
        });
        expect(fc.minLevel).toEqual(10);
        expect(fc.maxLevel).toEqual(15);
        expect(fc.extent).toEqual(extent);
    });
});
