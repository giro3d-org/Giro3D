/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';

import type Context from '@giro3d/giro3d/core/Context';
import type { Volume } from '@giro3d/giro3d/entities/AxisGrid';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import AxisGrid, { DEFAULT_STYLE } from '@giro3d/giro3d/entities/AxisGrid';
import View from '@giro3d/giro3d/renderer/View';

const DEFAULT_EXTENT = new Extent(CoordinateSystem.epsg3857, -10, 10, -10, 10);
const defaultVolume: Volume = {
    extent: DEFAULT_EXTENT,
    ceiling: 0,
    floor: 0,
};

let context: Context;
let view: View;
let camera: THREE.PerspectiveCamera;

beforeEach(() => {
    camera = new THREE.PerspectiveCamera(45);
    view = new View({
        crs: CoordinateSystem.fromSrid('foo'),
        width: 1,
        height: 1,
        camera,
    });
    context = {
        view,
        distance: {
            plane: new THREE.Plane(),
            min: 0,
            max: 1,
        },
    };
});

describe('constructor', () => {
    it('should assign the extent property', () => {
        const grid = new AxisGrid({ volume: defaultVolume });

        expect(grid.volume.extent).toBe(DEFAULT_EXTENT);
    });

    it('should assign the default style', () => {
        const grid = new AxisGrid({ volume: defaultVolume });

        expect(grid.style).toEqual(DEFAULT_STYLE);
    });

    it('should assign the remaining values of a partial style', () => {
        const grid = new AxisGrid({
            volume: defaultVolume,
            style: {
                fontSize: 999,
            },
        });

        expect(grid.style.color).toEqual(DEFAULT_STYLE.color);
        expect(grid.style.fontSize).toEqual(999);
        expect(grid.style.numberFormat).toEqual(DEFAULT_STYLE.numberFormat);
    });

    it('should assign the object3d property', () => {
        const grid = new AxisGrid({ volume: defaultVolume });

        expect(grid.object3d).toBeInstanceOf(THREE.Group);
    });

    it('should throw if volume is undefined', () => {
        // @ts-expect-error invalid parameter
        expect(() => new AxisGrid({ volume: undefined })).toThrow(/volume is undefined/);
    });
});

describe('ticks', () => {
    it('should set the ticks property', () => {
        const grid = new AxisGrid({ volume: defaultVolume });
        grid.ticks = { x: 1, y: 2, z: 3 };
        expect(grid.ticks).toEqual({ x: 1, y: 2, z: 3 });
    });
});

describe('volume', () => {
    it('should set the volume property', () => {
        const grid = new AxisGrid({ volume: defaultVolume });
        grid.volume = {
            ceiling: 199,
            floor: 111,
            extent: new Extent(CoordinateSystem.epsg3857, 1, 2, 3, 4),
        };

        expect(grid.volume).toEqual({
            ceiling: 199,
            floor: 111,
            extent: new Extent(CoordinateSystem.epsg3857, 1, 2, 3, 4),
        });
    });
});

describe('preUpdate', () => {
    it('should set each side visible if its facing toward the camera', () => {
        const grid = new AxisGrid({
            volume: { extent: DEFAULT_EXTENT, floor: 0, ceiling: 100 },
        });
        const midHeight = 50;

        // Set the camera position in the middle of the volume
        camera.position.set(0, 0, midHeight);

        grid.preUpdate(context);

        const sides = [
            // @ts-expect-error private properties
            grid._front,
            // @ts-expect-error private properties
            grid._back,
            // @ts-expect-error private properties
            grid._left,
            // @ts-expect-error private properties
            grid._right,
            // @ts-expect-error private properties
            grid._floor,
            // @ts-expect-error private properties
            grid._ceiling,
        ];

        const vec = new THREE.Vector3();

        function testSide(sideIndex: number) {
            sides[sideIndex]!.getWorldPosition(vec);
            camera.lookAt(vec);
            camera.updateWorldMatrix(true, true);

            grid.preUpdate(context);

            for (let i = 0; i < 6; i++) {
                expect(sides[i]!.visible).toEqual(i === sideIndex);
            }
        }

        testSide(0);
        testSide(1);
        testSide(2);
        testSide(3);
        testSide(4);
        testSide(5);
    });
});
