import { PerspectiveCamera, Plane, Vector3 } from 'three';

import Context from '../../../src/core/Context';

describe('Context', () => {
    const threeCamera = new PerspectiveCamera(75);

    beforeEach(() => {
        threeCamera.position.set(2, 4, 10);
    });

    describe('Constructor', () => {
        it('should assigns properties', () => {
            const view = {
                camera: threeCamera,
            };
            const instance = {};

            const context = new Context(view, instance);

            expect(context.view).toBe(view);
            expect(context.instance).toBe(instance);
            expect(context.fastUpdateHint).toBeUndefined();
            expect(context.distance.min).toBe(Infinity);
            expect(context.distance.max).toBe(0);
            expect(context.distance.plane).toEqual(
                new Plane().setFromNormalAndCoplanarPoint(
                    threeCamera.getWorldDirection(new Vector3()),
                    threeCamera.position,
                ),
            );
        });
    });
});
