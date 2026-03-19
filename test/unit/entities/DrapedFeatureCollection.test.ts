/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

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
});
