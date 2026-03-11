/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { beforeEach, describe, expect, it, vitest } from 'vitest';

import type { GetFeatureRequest } from '@giro3d/giro3d/sources/FeatureSource';
import type { StreamableFeatureSourceLoadingStrategy } from '@giro3d/giro3d/sources/StreamableFeatureSource';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import StreamableFeatureSource, {
    defaultLoadingStrategy,
    tiledLoadingStrategy,
} from '@giro3d/giro3d/sources/StreamableFeatureSource';

const queryBuilder = vitest.fn();
const getter = vitest.fn();

let source: StreamableFeatureSource;

beforeEach(async () => {
    getter.mockReset().mockReturnValue(JSON.stringify({ type: 'FeatureCollection', features: [] }));
    queryBuilder.mockReset().mockReturnValue(new URL('http://example.com'));

    source = new StreamableFeatureSource({
        sourceCoordinateSystem: CoordinateSystem.epsg4326,
        queryBuilder,
        getter,
    });

    await source.initialize({ targetCoordinateSystem: CoordinateSystem.epsg4326 });
});

describe('getFeatures', () => {
    it('should use the provided query builder', async () => {
        const extent = Extent.WGS84;

        await source.getFeatures({ extent });

        expect(queryBuilder).toHaveBeenCalledWith({
            extent,
            sourceCoordinateSystem: CoordinateSystem.epsg4326,
        });

        expect(getter).toHaveBeenCalledWith('http://example.com/', 'json');
    });

    it('should use the provided loading strategy', async () => {
        const strategy: StreamableFeatureSourceLoadingStrategy = vitest
            .fn()
            .mockReturnValue({ requests: [] });

        source = new StreamableFeatureSource({
            sourceCoordinateSystem: CoordinateSystem.epsg4326,
            queryBuilder,
            getter,
            loadingStrategy: strategy,
        });

        await source.initialize({ targetCoordinateSystem: CoordinateSystem.epsg4326 });

        const extent = Extent.WGS84;

        await source.getFeatures({ extent });

        expect(strategy).toHaveBeenCalledWith({
            extent,
        });
    });

    it('should drop the query if the query builder returns undefined', async () => {
        const extent = Extent.WGS84;

        queryBuilder.mockReturnValue(undefined);

        await source.getFeatures({ extent });

        expect(getter).not.toHaveBeenCalled();
    });
});

describe('tiledLoadingStrategy', () => {
    it('should split the input request according to the tile size', () => {
        const strategy = tiledLoadingStrategy({ tileSize: 1 });
        const request: GetFeatureRequest = {
            extent: Extent.WGS84,
        };
        const result = strategy(request);

        expect(result.requests).toHaveLength(360 * 180);
    });
});

describe('defaultLoadingStrategy', () => {
    it('should return the same input', () => {
        const request: GetFeatureRequest = {
            extent: Extent.WGS84,
            signal: {} as AbortSignal,
        };
        const result = defaultLoadingStrategy(request);

        expect(result.requests).toHaveLength(1);
        expect(result.requests[0]).toEqual({
            extent: request.extent,
            signal: request.signal,
        });
    });
});
