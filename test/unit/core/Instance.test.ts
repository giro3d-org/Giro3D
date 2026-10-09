/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Group, Object3D, Vector2, WebGLRenderer } from 'three';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Instance from '@giro3d/giro3d/core/Instance';
import Entity from '@giro3d/giro3d/entities/Entity';
import Entity3D from '@giro3d/giro3d/entities/Entity3D';
import Fetcher from '@giro3d/giro3d/utils/Fetcher';

import { resizeObservers, setupGlobalMocks } from '../mocks';

const renderer = new WebGLRenderer();
class FakeEntity extends Entity {}
class FakeEntity3D extends Entity3D {}

describe('Instance', () => {
    let viewerDiv: HTMLDivElement;
    let instance: Instance;
    let mouseEvent: MouseEvent;
    let touchEvent: TouchEvent;

    beforeEach(() => {
        setupGlobalMocks();
        viewerDiv = document.createElement('div');
        mouseEvent = new MouseEvent('foo', {
            // @ts-expect-error incorrect
            target: viewerDiv,
            offsetX: 10,
            offsetY: 10,
        });
        touchEvent = new TouchEvent('foo', {
            touches: [
                {
                    clientX: 10,
                    clientY: 10,
                    force: 0,
                    identifier: 0,
                    pageX: 0,
                    pageY: 0,
                    radiusX: 0,
                    radiusY: 0,
                    rotationAngle: 0,
                    screenX: 0,
                    screenY: 0,
                    // @ts-expect-error incorrect
                    target: undefined,
                },
            ],
        });
        instance = new Instance({
            target: viewerDiv,
            crs: CoordinateSystem.epsg3857,
            renderer,
        });
        Fetcher.json = vitest.fn();
    });

    describe('constructor', () => {
        it('should observe the resizing of the DOM element', () => {
            const lastObserver = resizeObservers[resizeObservers.length - 1];
            expect(lastObserver.observe).toHaveBeenCalledWith(viewerDiv);
        });
    });

    describe('canvasToNormalizedCoords', () => {
        it('should return the passed target', () => {
            const target = new Vector2();
            const input = new Vector2();
            const result = instance.canvasToNormalizedCoords(input, target);
            expect(result).toBe(target);
        });
    });

    describe('normalizedToCanvasCoords', () => {
        it('should return the passed target', () => {
            const target = new Vector2();
            const input = new Vector2();
            const result = instance.normalizedToCanvasCoords(input, target);
            expect(result).toBe(target);
        });
    });

    describe('eventToNormalizedCoords', () => {
        it('should return the passed target, using TouchEvent', () => {
            const target = new Vector2();
            const result = instance.eventToNormalizedCoords(touchEvent, target);
            expect(result).toBe(target);
        });
        it('should return the passed target, using MouseEvent on domElement', () => {
            const target = new Vector2();
            const result = instance.eventToNormalizedCoords(mouseEvent, target);
            expect(result).toBe(target);
        });
        it('should return the passed target, using MouseEvent on other element', () => {
            const target = new Vector2();
            const result = instance.eventToNormalizedCoords(mouseEvent, target);
            expect(result).toBe(target);
        });
    });

    describe('eventToCanvasCoords', () => {
        it('should return the passed target', () => {
            const target = new Vector2();
            const result = instance.eventToCanvasCoords(touchEvent, target);
            expect(result).toBe(target);
        });
        it('should return the passed target, using MouseEvent on domElement', () => {
            const target = new Vector2();
            const result = instance.eventToCanvasCoords(mouseEvent, target);
            expect(result).toBe(target);
        });
        it('should return the passed target, using MouseEvent on other element', () => {
            const target = new Vector2();
            const result = instance.eventToCanvasCoords(mouseEvent, target);
            expect(result).toBe(target);
        });
    });

    describe('add', () => {
        it('should return a rejected promise if not of correct type', async () => {
            const invalid = {};
            // @ts-expect-error invalid type
            await expect(instance.add(invalid)).rejects.toThrowError(
                'object is not an instance of THREE.Object3D or Giro3D.Entity',
            );
        });

        it('should add the object to threeObjects if it is a native three.js object', () => {
            const o = new Object3D();
            instance.add(o);
            expect(instance.threeObjects.children).toContain(o);
        });

        it('should not add the object to threeObjects if it already has a parent', () => {
            const parented = new Object3D();
            const parent = new Object3D();

            parent.add(parented);
            instance.add(parented);
            expect(instance.threeObjects.children).not.toContain(parented);
        });

        it('should add an entity', () => {
            const entity = new FakeEntity();
            return instance.add(entity).then(() => {
                expect(instance.getObjects()).toStrictEqual([entity]);
            });
        });

        it('should add the entity object3D to the default location if it has no parent', async () => {
            const entity1 = new FakeEntity3D({ object3d: new Object3D() });

            await instance.add(entity1);

            expect(instance.scene.children).toContain(entity1.object3d);
        });
        it('should honor the entity object3D location in scenegraph if it has a parent', async () => {
            const entity1 = new FakeEntity3D({ object3d: new Object3D() });

            const parent = new Object3D();

            parent.add(entity1.object3d);

            await instance.add(entity1);

            expect(instance.scene.children).not.toContain(entity1.object3d);
        });

        it('should add a THREE.js Object3D', () => {
            const obj = new Group();
            return instance.add(obj).then(() => {
                expect(instance.getObjects()).toStrictEqual([obj]);
            });
        });

        it('should fire the entity-added event', () => {
            let eventFired = false;

            instance.addEventListener('entity-added', () => {
                eventFired = true;
            });

            expect(eventFired).toBeFalsy();

            return instance.add(new FakeEntity()).then(() => {
                expect(eventFired).toBeTruthy();
            });
        });
    });

    describe('remove', () => {
        it('should remove the entity object3d from the scenegraph', async () => {
            const entity1 = new FakeEntity3D({ object3d: new Object3D() });

            entity1.object3d.removeFromParent = vitest.fn();

            await instance.add(entity1);

            instance.remove(entity1);

            expect(entity1.object3d.removeFromParent).toHaveBeenCalled();
        });

        it('should remove the object from the list', () => {
            const entity1 = new FakeEntity();
            const entity2 = new FakeEntity();
            const entity3 = new FakeEntity();

            instance.add(entity1);
            instance.add(entity2);
            instance.add(entity3);

            expect(instance.getObjects().includes(entity1)).toBeTruthy();
            expect(instance.getObjects().includes(entity2)).toBeTruthy();
            expect(instance.getObjects().includes(entity3)).toBeTruthy();

            instance.remove(entity1);

            expect(instance.getObjects().includes(entity1)).toBeFalsy();
            expect(instance.getObjects().includes(entity2)).toBeTruthy();
            expect(instance.getObjects().includes(entity3)).toBeTruthy();

            instance.remove(entity2);

            expect(instance.getObjects().includes(entity1)).toBeFalsy();
            expect(instance.getObjects().includes(entity2)).toBeFalsy();
            expect(instance.getObjects().includes(entity3)).toBeTruthy();

            instance.remove(entity3);

            expect(instance.getObjects().includes(entity1)).toBeFalsy();
            expect(instance.getObjects().includes(entity2)).toBeFalsy();
            expect(instance.getObjects().includes(entity3)).toBeFalsy();
        });

        it('should remove the object from threeObjects if it is a native three.js object', () => {
            const o = new Object3D();
            instance.add(o);
            expect(instance.threeObjects.children).toContain(o);

            instance.remove(o);
            expect(instance.threeObjects.children).not.toContain(o);
        });

        it('should call the dispose() method if it exists', () => {
            const entity = new FakeEntity();
            entity.dispose = vitest.fn();

            return instance.add(entity).then(() => {
                instance.remove(entity);
                expect(entity.dispose).toHaveBeenCalled();
            });
        });

        it('should fire the entity-removed event', async () => {
            let eventFired = false;

            const entity = new FakeEntity();

            instance.addEventListener('entity-removed', () => {
                eventFired = true;
            });

            expect(eventFired).toBeFalsy();

            await instance.add(entity).then(() => {
                instance.remove(entity);
            });
            expect(eventFired).toBeTruthy();
        });
    });

    describe('loading', () => {
        it('should return false if no entity is present', () => {
            expect(instance.loading).toBeFalsy();
        });

        it('should return true if any entity is loading', () => {
            const entity1 = new FakeEntity();
            const entity2 = new FakeEntity();

            let map1Loading = false;
            let map2Loading = false;

            Object.defineProperty(entity1, 'loading', {
                get: vitest.fn(() => map1Loading),
                set: vitest.fn(),
            });

            Object.defineProperty(entity2, 'loading', {
                get: vitest.fn(() => map2Loading),
                set: vitest.fn(),
            });

            instance.add(entity1);
            instance.add(entity2);

            map1Loading = false;
            map2Loading = true;
            expect(instance.loading).toEqual(true);

            map1Loading = true;
            map2Loading = false;
            expect(instance.loading).toEqual(true);

            map1Loading = false;
            map2Loading = false;
            expect(instance.loading).toEqual(false);

            map1Loading = true;
            map2Loading = true;
            expect(instance.loading).toEqual(true);
        });
    });

    describe('getEntities', () => {
        it('should return added entities', () => {
            const entity1 = new FakeEntity();
            const entity2 = new FakeEntity();

            instance.add(entity1);

            expect(instance.getEntities()).toEqual(expect.arrayContaining([entity1]));

            instance.add(entity2);

            expect(instance.getEntities()).toEqual(expect.arrayContaining([entity1, entity2]));

            instance.remove(entity1);

            expect(instance.getEntities()).toEqual(expect.arrayContaining([entity2]));

            instance.remove(entity2);

            expect(instance.getEntities()).toEqual(expect.arrayContaining([]));
        });
    });

    describe('getObjects', () => {
        it('should return added objects and entities', () => {
            const map1 = new FakeEntity();
            const map2 = new FakeEntity();
            const object1 = new Object3D();
            const object2 = new Object3D();

            instance.add(map1);
            instance.add(object1);

            expect(instance.getObjects()).toEqual(expect.arrayContaining([map1, object1]));

            instance.add(object2);
            instance.add(map2);

            expect(instance.getObjects()).toEqual(
                expect.arrayContaining([map1, object1, object2, map2]),
            );

            instance.remove(object1);
            instance.remove(map2);

            expect(instance.getObjects()).toEqual(expect.arrayContaining([map1, object2]));
        });
    });

    describe('progress', () => {
        it('should return 1 if no entity is present', () => {
            expect(instance.progress).toEqual(1);
        });

        it('should return the average of all entities progress', () => {
            const map1 = new FakeEntity();
            const map2 = new FakeEntity();

            Object.defineProperty(map1, 'progress', {
                get: vitest.fn(() => 0.7),
                set: vitest.fn(),
            });

            Object.defineProperty(map2, 'progress', {
                get: vitest.fn(() => 0.2),
                set: vitest.fn(),
            });

            instance.add(map1);
            instance.add(map2);

            expect(instance.progress).toEqual((0.7 + 0.2) / 2);
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
    });
});
