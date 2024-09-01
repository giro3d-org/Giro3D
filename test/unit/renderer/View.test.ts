import type { ExternalControls } from '@giro3d/giro3d/renderer/View';
import View from '@giro3d/giro3d/renderer/View';
import { EventDispatcher, PerspectiveCamera } from 'three';

const DEFAULT_CRS = 'EPSG:1234';

describe('Camera', () => {
    describe('constructor', () => {
        it('should assign properties', () => {
            const width = 123;
            const height = 456;
            const crs = 'EPSG:1234';
            const options = {};
            const view = new View(crs, width, height, options);

            expect(view.crs).toEqual(crs);
            expect(view.width).toEqual(width);
            expect(view.height).toEqual(height);
            expect(view.camera).toBeInstanceOf(PerspectiveCamera);
        });
    });

    describe('setSize', () => {
        it('should update the size', () => {
            const view = new View(DEFAULT_CRS, 0, 0);

            view.setSize(123, 456);

            expect(view.width).toEqual(123);
            expect(view.height).toEqual(456);
        });
    });

    describe('setControls', () => {
        it('should update the controls in its update() step', () => {
            const view = new View(DEFAULT_CRS, 0, 0);

            const controls: ExternalControls = {
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
                update: jest.fn(),
                hasEventListener: jest.fn(),
            };

            view.setControls(controls);

            view.update();

            expect(controls.update).toHaveBeenCalledTimes(1);

            view.setControls(null);

            view.update();

            expect(controls.update).toHaveBeenCalledTimes(1);
        });

        it('should raise an event when the controls change', () => {
            const view = new View(DEFAULT_CRS, 0, 0);

            // @ts-expect-error incorrect type
            const controls: ExternalControls = new EventDispatcher();

            view.setControls(controls);

            let called = false;

            view.addEventListener('change', () => (called = true));

            controls.dispatchEvent({ type: 'change' });

            expect(called).toEqual(true);
        });
    });
});
