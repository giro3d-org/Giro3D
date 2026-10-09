/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { WebGLRenderer } from 'three';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import OffscreenInstance from '@giro3d/giro3d/core/OffscreenInstance';

import { setupGlobalMocks } from '../mocks';

function createFakeOffscreenCanvas(width = 320, height = 240): OffscreenCanvas {
    return {
        width,
        height,
        getContext: vitest.fn(),
    } as unknown as OffscreenCanvas;
}

describe('OffscreenInstance', () => {
    let instance: OffscreenInstance;
    let canvas: OffscreenCanvas;

    beforeEach(() => {
        setupGlobalMocks();
        canvas = createFakeOffscreenCanvas();
        instance = new OffscreenInstance({
            canvas,
            crs: CoordinateSystem.epsg3857,
            renderer: new WebGLRenderer(),
        });
    });

    describe('constructor', () => {
        it('should expose the given canvas', () => {
            expect(instance.canvas).toBe(canvas);
        });
    });

    describe('scene/view/engine', () => {
        it('should expose a usable scene, view, and renderer', () => {
            expect(instance.scene).toBeDefined();
            expect(instance.view).toBeDefined();
            expect(instance.renderer).toBeDefined();
            expect(instance.coordinateSystem).toBe(CoordinateSystem.epsg3857);
        });
    });

    describe('render', () => {
        it('should not throw', () => {
            expect(() => instance.render()).not.toThrow();
        });
    });

    describe('dispose', () => {
        it('should fire the dispose event', () => {
            const listener = vitest.fn();
            instance.addEventListener('dispose', listener);

            expect(listener).toHaveBeenCalledTimes(0);

            instance.dispose();

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should not throw when disposing twice', () => {
            instance.dispose();

            expect(() => instance.dispose()).not.toThrow();
        });
    });
});
