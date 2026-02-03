/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { UnsignedByteType } from 'three';
import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import VideoSource from '@giro3d/giro3d/sources/VideoSource';

const extent = new Extent(CoordinateSystem.epsg4326, {
    west: -10,
    north: 10,
    east: -5,
    south: 3,
});

describe('constructor', () => {
    it('should assign properties', () => {
        const source = new VideoSource({
            extent,
            source: 'http://example.com/video.mp4',
        });

        expect(source.synchronous).toBe(true);
        expect(source.colorSpace).toEqual('srgb');
        expect(source.getExtent()).toEqual(extent);
        expect(source.datatype).toEqual(UnsignedByteType);
        expect(source.getCrs()).toEqual(CoordinateSystem.epsg4326);
    });

    it('should assign flipY to false by default, as flipping is handled internally', () => {
        const tiled = new VideoSource({
            extent,
            source: 'http://example.com/video.mp4',
        });

        expect(tiled.flipY).toEqual(false);
    });
});
