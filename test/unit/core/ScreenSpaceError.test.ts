/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, Matrix4, PerspectiveCamera, Sphere, Vector3, WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import ScreenSpaceError from '@giro3d/giro3d/core/ScreenSpaceError';
import View from '@giro3d/giro3d/renderer/View';

function makeView(
    width: number,
    height: number,
    cameraZ = 100,
): { view: View; renderer: WebGLRenderer } {
    const camera = new PerspectiveCamera(45, width / height);
    camera.position.set(0, 0, cameraZ);
    const renderer = new WebGLRenderer();
    const view = new View({
        crs: CoordinateSystem.epsg3857,
        renderer,
        width,
        height,
        camera,
    });
    view.update();
    return { view, renderer };
}

describe('computeFromSphere', () => {
    it('should return the same value as pixelRatio 1 when pixelRatio is not set', () => {
        const { view } = makeView(800, 600);
        const sphere = new Sphere(new Vector3(0, 0, 0), 10);

        const sse = ScreenSpaceError.computeFromSphere(view, sphere, 1);

        expect(view.pixelRatio).toEqual(1);
        expect(Number.isFinite(sse)).toBe(true);
        expect(sse).toBeGreaterThan(0);
    });

    it('should scale linearly with pixelRatio', () => {
        const { view, renderer } = makeView(800, 600);
        const sphere = new Sphere(new Vector3(0, 0, 0), 10);

        const sseAtRatio1 = ScreenSpaceError.computeFromSphere(view, sphere, 1);

        renderer.setPixelRatio(2);
        const sseAtRatio2 = ScreenSpaceError.computeFromSphere(view, sphere, 1);

        expect(sseAtRatio2).toBeCloseTo(sseAtRatio1 * 2);
    });
});

describe('computeFromBox3', () => {
    it('should scale lengths linearly with pixelRatio', () => {
        const { view, renderer } = makeView(800, 600);
        const box3 = new Box3(new Vector3(-5, -5, -5), new Vector3(5, 5, 5));
        const identity = new Matrix4();

        const sseAtRatio1 = ScreenSpaceError.computeFromBox3(
            view,
            box3,
            identity,
            1,
            ScreenSpaceError.Mode.MODE_2D,
        );

        renderer.setPixelRatio(2);
        const sseAtRatio2 = ScreenSpaceError.computeFromBox3(
            view,
            box3,
            identity,
            1,
            ScreenSpaceError.Mode.MODE_2D,
        );

        expect(sseAtRatio1).not.toBeNull();
        expect(sseAtRatio2).not.toBeNull();
        expect(sseAtRatio2.lengths.x).toBeCloseTo(sseAtRatio1.lengths.x * 2);
        expect(sseAtRatio2.lengths.y).toBeCloseTo(sseAtRatio1.lengths.y * 2);
        // ratio is dimensionless (a shape "squashedness" factor) and must not scale.
        expect(sseAtRatio2.ratio).toBeCloseTo(sseAtRatio1.ratio);
    });
});
