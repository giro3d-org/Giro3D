/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { FloatType, RGFormat } from 'three';
import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import HeightMap from '@giro3d/giro3d/core/HeightMap';
import OffsetScale from '@giro3d/giro3d/core/OffsetScale';
import PlanarTileGeometry from '@giro3d/giro3d/entities/tiles/PlanarTileGeometry';

const extent = new Extent(CoordinateSystem.epsg3857, -100, 100, -100, 100);
const DEFAULT_OFFSET_SCALE = new OffsetScale(0, 0, 1, 1);

// Actual buffer arrays to prevent regression
const uvsSquare = new Float32Array([
    0, 1, 0.2, 1, 0.4, 1, 0.6, 1, 0.8, 1, 1, 1, 0, 0.8, 0.2, 0.8, 0.4, 0.8, 0.6, 0.8, 0.8, 0.8, 1,
    0.8, 0, 0.6, 0.2, 0.6, 0.4, 0.6, 0.6, 0.6, 0.8, 0.6, 1, 0.6, 0, 0.4, 0.2, 0.4, 0.4, 0.4, 0.6,
    0.4, 0.8, 0.4, 1, 0.4, 0, 0.2, 0.2, 0.2, 0.4, 0.2, 0.6, 0.2, 0.8, 0.2, 1, 0.2, 0, 0, 0.2, 0,
    0.4, 0, 0.6, 0, 0.8, 0, 1, 0,
]);
const positionsSquare = new Float32Array([
    -100, 100, 0, -60, 100, 0, -20, 100, 0, 20, 100, 0, 60, 100, 0, 100, 100, 0, -100, 60, 0, -60,
    60, 0, -20, 60, 0, 20, 60, 0, 60, 60, 0, 100, 60, 0, -100, 20, 0, -60, 20, 0, -20, 20, 0, 20,
    20, 0, 60, 20, 0, 100, 20, 0, -100, -20, 0, -60, -20, 0, -20, -20, 0, 20, -20, 0, 60, -20, 0,
    100, -20, 0, -100, -60, 0, -60, -60, 0, -20, -60, 0, 20, -60, 0, 60, -60, 0, 100, -60, 0, -100,
    -100, 0, -60, -100, 0, -20, -100, 0, 20, -100, 0, 60, -100, 0, 100, -100, 0,
]);

const indicesSquare = new Uint16Array([
    0, 6, 1, 6, 7, 1, 1, 7, 2, 7, 8, 2, 2, 8, 3, 8, 9, 3, 3, 9, 4, 9, 10, 4, 4, 10, 5, 10, 11, 5, 6,
    12, 7, 12, 13, 7, 7, 13, 8, 13, 14, 8, 8, 14, 9, 14, 15, 9, 9, 15, 10, 15, 16, 10, 10, 16, 11,
    16, 17, 11, 12, 18, 13, 18, 19, 13, 13, 19, 14, 19, 20, 14, 14, 20, 15, 20, 21, 15, 15, 21, 16,
    21, 22, 16, 16, 22, 17, 22, 23, 17, 18, 24, 19, 24, 25, 19, 19, 25, 20, 25, 26, 20, 20, 26, 21,
    26, 27, 21, 21, 27, 22, 27, 28, 22, 22, 28, 23, 28, 29, 23, 24, 30, 25, 30, 31, 25, 25, 31, 26,
    31, 32, 26, 26, 32, 27, 32, 33, 27, 27, 33, 28, 33, 34, 28, 28, 34, 29, 34, 35, 29,
]);

it('should have the proper attributes for a 6x6 squared grid given segment=5 parameter', () => {
    const geometry = new PlanarTileGeometry({ extent, segments: 5 });

    expect(geometry.attributes.position.array).toStrictEqual(positionsSquare);
    expect(geometry.attributes.uv.array).toStrictEqual(uvsSquare);
    expect(geometry.index!.array).toStrictEqual(indicesSquare);
});

it('should create an index buffer with 16bit numbers if possible', () => {
    const small = new PlanarTileGeometry({ extent, segments: 5 });
    const big = new PlanarTileGeometry({ extent, segments: 300 });

    expect(small.getIndex()!.array.BYTES_PER_ELEMENT).toEqual(2);
    expect(big.getIndex()!.array.BYTES_PER_ELEMENT).toEqual(4);
});

describe('resetHeights', () => {
    it('should set all Z coordinates to zero', () => {
        const geometry = new PlanarTileGeometry({ extent, segments: 3 });
        const positions = geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            positions.setZ(i, 999);
        }
        geometry.resetHeights();

        for (let i = 0; i < positions.count; i++) {
            expect(positions.getZ(i)).toEqual(0);
        }
    });
});

describe('applyHeightMap', () => {
    it('should return the min/max height of computed vertices', () => {
        const width = 2;
        const height = 2;
        const buffer = new Float32Array(width * height * 2);

        const ALPHA = 1;
        buffer[0] = -102;
        buffer[1] = ALPHA;
        buffer[2] = 989;
        buffer[3] = ALPHA;
        buffer[4] = 600;
        buffer[5] = ALPHA;
        buffer[6] = 800;
        buffer[7] = ALPHA;

        const grid_2x2 = new PlanarTileGeometry({ extent, segments: 2 });

        const { min, max } = grid_2x2.applyHeightMap(
            new HeightMap(buffer, width, height, DEFAULT_OFFSET_SCALE, RGFormat, FloatType),
        );

        expect(min).toEqual(-102);
        expect(max).toEqual(989);
    });

    it('should correctly sample the buffer', () => {
        const small = new PlanarTileGeometry({ extent, segments: 2 });

        // Create 2x2 heightmap, with a stride of 2 (the elevation is in the even indices)
        const width = 2;
        const height = 2;
        const buffer = new Float32Array(width * height * 2);

        const ALPHA = 1;
        buffer[0] = 200;
        buffer[1] = ALPHA;
        buffer[2] = 400;
        buffer[3] = ALPHA;
        buffer[4] = 600;
        buffer[5] = ALPHA;
        buffer[6] = 800;
        buffer[7] = ALPHA;

        // The heightmap looks like this:
        //
        // +-----+-----+
        // | 200 | 400 |
        // +-----+-----+
        // | 600 | 800 |
        // +-----+-----+

        // The grid looks like this:
        //
        // 6 --- 7 --- 8
        // |     |     |
        // 3 --- 4 --- 5
        // |     |     |
        // 0 --- 1 --- 2

        const heightMap = new HeightMap(
            buffer,
            width,
            height,
            DEFAULT_OFFSET_SCALE,
            RGFormat,
            FloatType,
        );
        small.applyHeightMap(heightMap);

        const positions = small.getAttribute('position');

        // Top row
        expect(positions.getZ(0)).toEqual(600);
        expect(positions.getZ(1)).toEqual(600);
        expect(positions.getZ(2)).toEqual(800);

        // Middle row
        expect(positions.getZ(3)).toEqual(200);
        expect(positions.getZ(4)).toEqual(200);
        expect(positions.getZ(5)).toEqual(400);

        // Bottom row
        expect(positions.getZ(6)).toEqual(200);
        expect(positions.getZ(7)).toEqual(200);
        expect(positions.getZ(8)).toEqual(400);
    });
});
