import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import type HasDefaultPointOfView from '@giro3d/giro3d/core/HasDefaultPointOfView';
import type PointOfView from '@giro3d/giro3d/core/PointOfView';
import type { ExternalControls } from '@giro3d/giro3d/renderer/View';
import View from '@giro3d/giro3d/renderer/View';
import {
    BoxGeometry,
    EventDispatcher,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    Vector3,
} from 'three';
import { beforeAll, describe, expect, it, vitest } from 'vitest';

const DEFAULT_CRS = CoordinateSystem.fromEpsg(1234);

describe('constructor', () => {
    it('should assign properties', () => {
        const width = 123;
        const height = 456;
        const crs = CoordinateSystem.fromEpsg(1234);
        const view = new View({ crs: DEFAULT_CRS, width, height });

        expect(view.crs.equals(crs)).toEqual(true);
        expect(view.width).toEqual(width);
        expect(view.height).toEqual(height);
        expect(view.camera).toBeInstanceOf(PerspectiveCamera);
    });
});

describe('setSize', () => {
    it('should update the size', () => {
        const view = new View({ crs: DEFAULT_CRS, width: 0, height: 0 });

        view.setSize(123, 456);

        expect(view.width).toEqual(123);
        expect(view.height).toEqual(456);
    });
});

describe('setControls', () => {
    it('should update the controls in its update() step', () => {
        const view = new View({ crs: DEFAULT_CRS, width: 0, height: 0 });

        const controls: ExternalControls = {
            addEventListener: vitest.fn(),
            removeEventListener: vitest.fn(),
            dispatchEvent: vitest.fn(),
            update: vitest.fn(),
            hasEventListener: vitest.fn(),
        };

        view.setControls(controls);

        view.update();

        expect(controls.update).toHaveBeenCalledTimes(1);

        view.setControls(null);

        view.update();

        expect(controls.update).toHaveBeenCalledTimes(1);
    });

    it('should raise an event when the controls change', () => {
        const view = new View({ crs: DEFAULT_CRS, width: 0, height: 0 });

        // @ts-expect-error incorrect type
        const controls: ExternalControls = new EventDispatcher();

        view.setControls(controls);

        let called = false;

        view.addEventListener('change', () => (called = true));

        controls.dispatchEvent({ type: 'change' });

        expect(called).toEqual(true);
    });
});

describe('goTo', () => {
    let view: View;
    beforeAll(() => {
        view = new View({ crs: DEFAULT_CRS, width: 0, height: 0 });
        Object3D.DEFAULT_UP.set(0, 0, 1);
    });

    describe('Object3D', () => {
        describe('should compute a top down POV from the bounding box of the object', () => {
            it('perspective camera', () => {
                const camera = new PerspectiveCamera(45, 1);
                view.camera = camera;

                const mesh = new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial());
                mesh.position.set(2, 4, 10);

                const pov = view.goTo(mesh);

                expect(pov).toBeDefined();
                expect(pov?.target).toEqual(new Vector3(2, 4, 10));
                expect(pov?.origin).toEqual(new Vector3(2, 4, 35.08924330211234));
            });

            it('orthographic camera', () => {
                const camera = new OrthographicCamera(-10, 10, 10, -10);
                view.camera = camera;

                const mesh = new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial());
                mesh.position.set(2, 4, 10);

                const pov = view.goTo(mesh);

                expect(pov).toBeDefined();
                expect(pov?.target).toEqual(new Vector3(2, 4, 10));
                expect(pov?.origin).toEqual(new Vector3(2, 4, 51.569219381653056));
                expect(pov?.orthographicZoom).toBeCloseTo(0.48);
            });
        });
    });

    describe('PointOfView', () => {
        describe('should set the camera to match the point of view', () => {
            it('perspective camera', () => {
                const camera = new PerspectiveCamera();

                view.camera = camera;

                const pov: PointOfView = {
                    origin: new Vector3(1, 2, 3),
                    target: new Vector3(5, 6, 7),
                    orthographicZoom: 1,
                };

                view.goTo(pov);

                const expected = new PerspectiveCamera();

                expected.position.copy(pov.origin);

                expected.updateMatrix();
                expected.updateMatrixWorld(true);

                expected.lookAt(pov.target);

                expect(camera.position.equals(pov.origin)).toBe(true);
                expect(camera.quaternion.equals(expected.quaternion)).toBe(true);
            });

            it('orthographic camera', () => {
                const camera = new OrthographicCamera();

                view.camera = camera;

                const pov: PointOfView = {
                    origin: new Vector3(1, 2, 3),
                    target: new Vector3(5, 6, 7),
                    orthographicZoom: 1.25,
                };

                view.goTo(pov);

                const expected = new PerspectiveCamera();

                expected.position.copy(pov.origin);

                expected.updateMatrix();
                expected.updateMatrixWorld(true);

                expected.lookAt(pov.target);

                expect(camera.position.equals(pov.origin)).toBe(true);
                expect(camera.quaternion.equals(expected.quaternion)).toBe(true);
                expect(camera.zoom).toEqual(pov.orthographicZoom);
            });
        });
    });

    describe('HasDefaultPointOfView', () => {
        describe('should set the camera to match the point of view', () => {
            it('perspective camera', () => {
                const camera = new PerspectiveCamera();

                view.camera = camera;

                const pov: PointOfView = {
                    origin: new Vector3(1, 2, 3),
                    target: new Vector3(5, 6, 7),
                    orthographicZoom: 1,
                };

                const impl: HasDefaultPointOfView = {
                    hasDefaultPointOfView: true,
                    getDefaultPointOfView: () => pov,
                };

                view.goTo(impl);

                const expected = new PerspectiveCamera();

                expected.position.copy(pov.origin);

                expected.updateMatrix();
                expected.updateMatrixWorld(true);

                expected.lookAt(pov.target);

                expect(camera.position.equals(pov.origin)).toBe(true);
                expect(camera.quaternion.equals(expected.quaternion)).toBe(true);
            });

            it('orthographic camera', () => {
                const camera = new OrthographicCamera();

                view.camera = camera;

                const pov: PointOfView = {
                    origin: new Vector3(1, 2, 3),
                    target: new Vector3(5, 6, 7),
                    orthographicZoom: 1.25,
                };

                const impl: HasDefaultPointOfView = {
                    hasDefaultPointOfView: true,
                    getDefaultPointOfView: () => pov,
                };

                view.goTo(impl);

                const expected = new PerspectiveCamera();

                expected.position.copy(pov.origin);

                expected.updateMatrix();
                expected.updateMatrixWorld(true);

                expected.lookAt(pov.target);

                expect(camera.position.equals(pov.origin)).toBe(true);
                expect(camera.quaternion.equals(expected.quaternion)).toBe(true);
                expect(camera.zoom).toEqual(pov.orthographicZoom);
            });
        });
    });
});
