/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { describe, beforeEach, it, expect, vitest } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import StaticFeatureSource from '@giro3d/giro3d/sources/StaticFeatureSource';

let sourceWithTransformation: StaticFeatureSource;
let sourceWithoutTransformation: StaticFeatureSource;

beforeEach(async () => {
    sourceWithTransformation = new StaticFeatureSource({
        coordinateSystem: CoordinateSystem.epsg4326,
    });

    sourceWithoutTransformation = new StaticFeatureSource({
        coordinateSystem: CoordinateSystem.epsg4326,
    });

    await sourceWithTransformation.initialize({
        targetCoordinateSystem: CoordinateSystem.epsg3857,
    });
    await sourceWithoutTransformation.initialize({
        targetCoordinateSystem: CoordinateSystem.epsg4326,
    });
});

describe('addFeature', () => {
    it('should throw if not initialized', () => {
        const source = new StaticFeatureSource({ coordinateSystem: CoordinateSystem.epsg4326 });

        expect(() => source.addFeature(new Feature())).toThrow(
            /this source has not been initialized/,
        );
    });

    it('should transform the geometry if the source and target coordinate systems differ', () => {
        const geometry = new Point([3.24, 45.23]);
        const feature = new Feature(geometry);

        sourceWithTransformation.addFeature(feature);

        expect(sourceWithTransformation.features).toEqual([feature]);

        const [x, y] = geometry.getCoordinates();

        expect(x).toBeCloseTo(360675.15);
        expect(y).toBeCloseTo(5657803.247);
    });
});

describe('constructor', () => {
    it('should honot the list of features passed', async () => {
        const features = [new Feature(new Point([0, 0]))];

        const source = new StaticFeatureSource({
            features,
            coordinateSystem: CoordinateSystem.epsg4326,
        });

        await source.initialize({ targetCoordinateSystem: CoordinateSystem.epsg4326 });

        expect(source.features).toHaveLength(1);
        expect(source.features[0]).toBe(features[0]);
    });
});

describe('addFeatures', () => {
    it('should throw if not initialized', () => {
        const source = new StaticFeatureSource({ coordinateSystem: CoordinateSystem.epsg4326 });

        expect(() => source.addFeatures([])).toThrow(/this source has not been initialized/);
    });

    it('should assign a unique ID to each feature', () => {
        const f0 = new Feature(new Point([0, 0]));
        const f1 = new Feature(new Point([0, 0]));

        expect(f0.getId()).toBeUndefined();
        expect(f1.getId()).toBeUndefined();

        sourceWithTransformation.addFeatures([f0, f1]);

        expect(sourceWithTransformation.features).toEqual([f0, f1]);

        expect(f0.getId()).toBeDefined();
        expect(f1.getId()).toBeDefined();
    });

    it('should transform the geometry if the source and target coordinate systems differ', () => {
        const geometry0 = new Point([3.24, 45.23]);
        const geometry1 = new Point([3.24, 45.23]);

        sourceWithTransformation.addFeatures([new Feature(geometry0), new Feature(geometry1)]);

        const [x0, y0] = geometry0.getCoordinates();

        expect(x0).toBeCloseTo(360675.15);
        expect(y0).toBeCloseTo(5657803.247);

        const [x1, y1] = geometry1.getCoordinates();

        expect(x1).toBeCloseTo(360675.15);
        expect(y1).toBeCloseTo(5657803.247);
    });
});

describe('clear', () => {
    it('should raise the update event if some features were present', () => {
        const listener = vitest.fn();

        sourceWithTransformation.addEventListener('updated', listener);

        sourceWithTransformation.clear();

        expect(listener).not.toHaveBeenCalled();

        sourceWithTransformation.addFeature(new Feature(new Point([0, 0])));

        sourceWithTransformation.clear();

        expect(sourceWithTransformation.features).toHaveLength(0);

        expect(listener).toHaveBeenCalled();
    });
});

describe('removeFeature', () => {
    it('should return true if the feature was actually removed', () => {
        const feature = new Feature(new Point([3.24, 45.23]));

        sourceWithTransformation.addFeature(feature);

        expect(sourceWithTransformation.removeFeature(new Feature())).toEqual(false);
        expect(sourceWithTransformation.removeFeature(feature)).toEqual(true);
    });

    it('should raise the update event if the feature was actually removed', () => {
        const feature = new Feature(new Point([3.24, 45.23]));

        sourceWithTransformation.addFeature(feature);

        const listener = vitest.fn();
        sourceWithTransformation.addEventListener('updated', listener);

        sourceWithTransformation.removeFeature(feature);

        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('removeFeatures', () => {
    it('should return true if the feature was actually removed', () => {
        const feature = new Feature(new Point([3.24, 45.23]));

        sourceWithTransformation.addFeature(feature);

        expect(sourceWithTransformation.removeFeatures([new Feature()])).toEqual(false);
        expect(sourceWithTransformation.removeFeatures([feature])).toEqual(true);

        expect(sourceWithTransformation.features).toHaveLength(0);
    });

    it('should raise the update event if the feature was actually removed', () => {
        const feature = new Feature(new Point([3.24, 45.23]));

        sourceWithTransformation.addFeature(feature);

        const listener = vitest.fn();
        sourceWithTransformation.addEventListener('updated', listener);

        sourceWithTransformation.removeFeatures([feature]);

        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('getFeatures', () => {
    it('should return an empty array if no features are present', async () => {
        const result = await sourceWithoutTransformation.getFeatures({ extent: Extent.WGS84 });

        expect(result.features).toHaveLength(0);
    });

    it('should return all features that intersect the requested extent', async () => {
        const sw = new Feature(new Point([-1, -1]));
        const nw = new Feature(new Point([-1, 1]));
        const ne = new Feature(new Point([1, 1]));
        const se = new Feature(new Point([1, -1]));

        sourceWithoutTransformation.addFeatures([sw, nw, ne, se]);

        const fullExtent = await sourceWithoutTransformation.getFeatures({
            extent: Extent.WGS84,
        });

        expect(fullExtent.features).toEqual([sw, nw, ne, se]);

        const westernHemisphere = await sourceWithoutTransformation.getFeatures({
            extent: new Extent(CoordinateSystem.epsg4326, -180, 0, -90, +90),
        });

        expect(westernHemisphere.features).toEqual([sw, nw]);

        const easternHemisphere = await sourceWithoutTransformation.getFeatures({
            extent: new Extent(CoordinateSystem.epsg4326, 0, +180, -90, +90),
        });

        expect(easternHemisphere.features).toEqual([ne, se]);

        const northernHemisphere = await sourceWithoutTransformation.getFeatures({
            extent: new Extent(CoordinateSystem.epsg4326, -180, +180, 0, +90),
        });

        expect(northernHemisphere.features).toEqual([nw, ne]);

        const southernHemisphere = await sourceWithoutTransformation.getFeatures({
            extent: new Extent(CoordinateSystem.epsg4326, -180, +180, -90, 0),
        });

        expect(southernHemisphere.features).toEqual([sw, se]);
    });
});
