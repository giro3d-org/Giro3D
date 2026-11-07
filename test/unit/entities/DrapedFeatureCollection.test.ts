/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it, vi } from 'vitest';

import type { MapLike } from '@giro3d/giro3d/entities/DrapedFeatureCollection';

import DrapedFeatureCollection from '@giro3d/giro3d/entities/DrapedFeatureCollection';
import FileFeatureSource from '@giro3d/giro3d/sources/FileFeatureSource';

describe('constructor', () => {
    it('should honor options', () => {
        const entity = new DrapedFeatureCollection({
            minLod: 10,
            source: new FileFeatureSource({ url: 'http://example.com' }),
        });

        expect(entity.minLod).toEqual(10);
        expect(entity.type).toEqual('DrapedFeatureCollection');
    });

    it('should use the target map in the constructor options', () => {
        const target: MapLike = {
            addEventListener: vi.fn(),
            traverseTiles: vi.fn(),
        } as unknown as MapLike;

        new DrapedFeatureCollection({
            minLod: 10,
            target,
            source: new FileFeatureSource({ url: 'http://example.com' }),
        });

        expect(target.addEventListener).toHaveBeenCalled();
        expect(target.traverseTiles).toHaveBeenCalled();
    });
});
