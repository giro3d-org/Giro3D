/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Object3D, WebGLRenderer } from 'three';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import { RenderingState } from '@giro3d/giro3d/core/MainLoop';
import OffscreenInstance from '@giro3d/giro3d/core/OffscreenInstance';
import Entity from '@giro3d/giro3d/entities/Entity';

import { setupGlobalMocks } from '../mocks';

class FakeEntity extends Entity {}

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

    describe('entity support', () => {
        it('should add an entity and expose it via getEntities/getObjects', async () => {
            const entity = new FakeEntity();

            await instance.add(entity);

            expect(instance.getEntities()).toStrictEqual([entity]);
            expect(instance.getObjects()).toStrictEqual([entity]);
        });

        it('should fire the entity-added event', async () => {
            const listener = vitest.fn();
            instance.addEventListener('entity-added', listener);

            await instance.add(new FakeEntity());

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should add a native THREE.js object to threeObjects', async () => {
            const obj = new Object3D();

            await instance.add(obj);

            expect(instance.threeObjects.children).toContain(obj);
            expect(instance.getObjects()).toStrictEqual([obj]);
        });

        it('should remove an entity added previously', async () => {
            const entity = new FakeEntity();

            await instance.add(entity);
            instance.remove(entity);

            expect(instance.getEntities()).toStrictEqual([]);
        });

        it('should fire the entity-removed event', async () => {
            const entity = new FakeEntity();
            const listener = vitest.fn();
            instance.addEventListener('entity-removed', listener);

            await instance.add(entity);
            instance.remove(entity);

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('notifyChange/mainLoop', () => {
        it('should expose a MainLoop that schedules an update', () => {
            expect(instance.mainLoop.renderingState).toBe(RenderingState.RENDERING_PAUSED);

            instance.notifyChange();

            expect(instance.mainLoop.renderingState).toBe(RenderingState.RENDERING_SCHEDULED);
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
