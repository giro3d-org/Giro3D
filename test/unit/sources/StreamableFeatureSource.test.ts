/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { beforeEach, describe, expect, it, vitest } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import StreamableFeatureSource from '@giro3d/giro3d/sources/StreamableFeatureSource';

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

    it('should drop the query if the query builder returns undefined', async () => {
        const extent = Extent.WGS84;

        queryBuilder.mockReturnValue(undefined);

        await source.getFeatures({ extent });

        expect(getter).not.toHaveBeenCalled();
    });
});
