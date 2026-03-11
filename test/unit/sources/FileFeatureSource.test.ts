/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type FeatureFormat from 'ol/format/Feature';

import { Projection } from 'ol/proj';
import { describe, expect, it, vitest } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import FileFeatureSource from '@giro3d/giro3d/sources/FileFeatureSource';

describe('reload', () => {
    it('should dispatch the updated event', () => {
        const source = new FileFeatureSource({
            url: 'foo',
        });

        const listener = vitest.fn();

        source.addEventListener('updated', listener);

        expect(listener).not.toHaveBeenCalled();

        source.reload();

        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('getFeatures', () => {
    it('should load the file', async () => {
        // @ts-expect-error incomplete implementation
        const format: FeatureFormat = {
            getType: () => 'json',
            readProjection: () => new Projection({ code: 'EPSG:4326' }),
            readFeatures: () => [],
        };

        const data = '';
        const getter = vitest.fn(() => Promise.resolve(data));

        const source = new FileFeatureSource({
            url: 'foo',
            format,
            getter,
        });

        await source.initialize({ targetCoordinateSystem: CoordinateSystem.epsg4326 });

        await source.getFeatures({ extent: Extent.WGS84 });

        expect(getter).toHaveBeenCalledWith('foo', 'json');
    });
});
