/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Feature } from 'ol';
import { describe, expect, it, vitest } from 'vitest';

import type { FeatureSource } from '@giro3d/giro3d/sources/FeatureSource';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import AggregateFeatureSource from '@giro3d/giro3d/sources/AggregateFeatureSource';

describe('initialize', () => {
    it('should initialize all sub-sources', async () => {
        // @ts-expect-error incomplete mock
        const source1: FeatureSource = {
            initialize: vitest.fn().mockReturnValue(Promise.resolve()),
        };

        // @ts-expect-error incomplete mock
        const source2: FeatureSource = {
            initialize: vitest.fn().mockReturnValue(Promise.resolve()),
        };

        const source = new AggregateFeatureSource({
            sources: [source1, source2],
        });

        await source.initialize({
            targetCoordinateSystem: CoordinateSystem.fromEpsg(4326),
        });

        expect(source1.initialize).toHaveBeenCalledExactlyOnceWith({
            targetCoordinateSystem: CoordinateSystem.fromEpsg(4326),
        });

        expect(source2.initialize).toHaveBeenCalledExactlyOnceWith({
            targetCoordinateSystem: CoordinateSystem.fromEpsg(4326),
        });
    });
});

describe('getFeatures', () => {
    it('should query all sub-sources', async () => {
        const feature1 = new Feature();
        const feature2 = new Feature();
        const feature3 = new Feature();
        const feature4 = new Feature();

        // @ts-expect-error incomplete mock
        const source1: FeatureSource = {
            initialize: vitest.fn().mockReturnValue(Promise.resolve()),
            getFeatures: vitest.fn().mockReturnValue({ features: [feature1, feature3] }),
        };

        // @ts-expect-error incomplete mock
        const source2: FeatureSource = {
            initialize: vitest.fn().mockReturnValue(Promise.resolve()),
            getFeatures: vitest.fn().mockReturnValue({ features: [feature2, feature4] }),
        };

        const source = new AggregateFeatureSource({
            sources: [source1, source2],
        });

        await source.initialize({
            targetCoordinateSystem: CoordinateSystem.fromEpsg(4326),
        });

        const signal = new AbortController().signal;
        const extent = new Extent(CoordinateSystem.fromEpsg(4325), {
            west: 0,
            east: 1,
            north: 1,
            south: 0,
        });

        const result = await source.getFeatures({
            extent,
            signal,
        });

        expect(source1.getFeatures).toHaveBeenCalledExactlyOnceWith({ extent, signal });
        expect(source2.getFeatures).toHaveBeenCalledExactlyOnceWith({ extent, signal });

        expect(result.features).toHaveLength(4);
        expect(result.features).toContain(feature1);
        expect(result.features).toContain(feature2);
        expect(result.features).toContain(feature3);
        expect(result.features).toContain(feature4);
    });
});
