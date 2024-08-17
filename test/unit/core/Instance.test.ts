import Extent from '@giro3d/giro3d/core/geographic/Extent';
import Instance from '@giro3d/giro3d/core/Instance';
import MainLoop from '@giro3d/giro3d/core/MainLoop';
import Map from '@giro3d/giro3d/entities/Map';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D';
import type C3DEngine from '@giro3d/giro3d/renderer/c3DEngine.js';
import Tiles3DSource from '@giro3d/giro3d/sources/Tiles3DSource';
import Fetcher from '@giro3d/giro3d/utils/Fetcher';
import proj4 from 'proj4';
import { Group, Object3D, Vector2 } from 'three';
import { resizeObservers, setupGlobalMocks } from '../mocks';

describe('Instance', () => {
    let viewerDiv: HTMLDivElement;
    let instance: Instance;
    let mouseEvent: MouseEvent;
    let touchEvent: TouchEvent;

    beforeEach(() => {
        setupGlobalMocks();
        viewerDiv = document.createElement('div');
        const gfxEngine: C3DEngine = {
            getWindowSize: () => new Vector2(1200, 800),
            // @ts-expect-error missing properties
            renderer: {
                domElement: document.createElement('canvas'),
            },
        };
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
                    target: undefined,
                },
            ],
        });
        const options = { crs: 'EPSG:3857', mainLoop: new MainLoop(gfxEngine) };
        instance = new Instance(viewerDiv, options);
        Fetcher.json = jest.fn();
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
            if (window.TouchEvent) {
                const target = new Vector2();
                const result = instance.eventToNormalizedCoords(touchEvent, target);
                expect(result).toBe(target);
            }
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
            if (window.TouchEvent) {
                const target = new Vector2();
                const result = instance.eventToCanvasCoords(touchEvent, target);
                expect(result).toBe(target);
            }
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

        it('should add a map', () => {
            const map = new Map({
                extent: new Extent('EPSG:4326', {
                    west: 0,
                    east: 10,
                    south: 0,
                    north: 10,
                }),
                maxSubdivisionLevel: 15,
            });
            return instance.add(map).then(() => {
                expect(instance.getObjects()).toStrictEqual([map]);
            });
        });

        it('should add a Tiles3D', () => {
            const tileset = {
                root: {
                    refine: 'ADD',
                    boundingVolume: { box: [0, 0, 0, 7.0955, 0, 0, 0, 3.1405, 0, 0, 0, 5.0375] },
                },
                geometricError: 50,
            };
            // @ts-expect-error mockResolvedValue does not exist
            Fetcher.json.mockResolvedValue(tileset);
            const tiles3d = new Tiles3D(new Tiles3DSource('https://domain.tld/tileset.json'));
            return instance.add(tiles3d).then(() => {
                expect(instance.getObjects()).toStrictEqual([tiles3d]);
            });
        });

        it('should add a THREE.js Object3D', () => {
            const obj = new Group();
            return instance.add(obj).then(() => {
                expect(instance.getObjects()).toStrictEqual([obj]);
            });
        });

        it('should fire the entity-added event', () => {
            let eventFired = false;

            const map = new Map({
                extent: new Extent('EPSG:4326', {
                    west: 0,
                    east: 10,
                    south: 0,
                    north: 10,
                }),
                maxSubdivisionLevel: 15,
            });

            instance.addEventListener('entity-added', () => {
                eventFired = true;
            });

            expect(eventFired).toBeFalsy();

            return instance.add(map).then(() => {
                expect(eventFired).toBeTruthy();
            });
        });
    });

    describe('remove', () => {
        it('should remove the object from the list', () => {
            const extent = new Extent('EPSG:4326', 0, 0, 0, 0);
            const map1 = new Map({ extent });
            const map2 = new Map({ extent });
            const map3 = new Map({ extent });

            instance.add(map1);
            instance.add(map2);
            instance.add(map3);

            expect(instance.getObjects().includes(map1)).toBeTruthy();
            expect(instance.getObjects().includes(map2)).toBeTruthy();
            expect(instance.getObjects().includes(map3)).toBeTruthy();

            instance.remove(map1);

            expect(instance.getObjects().includes(map1)).toBeFalsy();
            expect(instance.getObjects().includes(map2)).toBeTruthy();
            expect(instance.getObjects().includes(map3)).toBeTruthy();

            instance.remove(map2);

            expect(instance.getObjects().includes(map1)).toBeFalsy();
            expect(instance.getObjects().includes(map2)).toBeFalsy();
            expect(instance.getObjects().includes(map3)).toBeTruthy();

            instance.remove(map3);

            expect(instance.getObjects().includes(map1)).toBeFalsy();
            expect(instance.getObjects().includes(map2)).toBeFalsy();
            expect(instance.getObjects().includes(map3)).toBeFalsy();
        });

        it('should remove the object from threeObjects if it is a native three.js object', () => {
            const o = new Object3D();
            instance.add(o);
            expect(instance.threeObjects.children).toContain(o);

            instance.remove(o);
            expect(instance.threeObjects.children).not.toContain(o);
        });

        it('should call the dispose() method if it exists', () => {
            const map = new Map({ extent: new Extent('EPSG:4326', 0, 0, 0, 0) });
            map.dispose = jest.fn();
            return instance.add(map).then(() => {
                instance.remove(map);
                expect(map.dispose).toHaveBeenCalled();
            });
        });

        it('should fire the entity-removed event', () => {
            let eventFired = false;

            const map = new Map({
                extent: new Extent('EPSG:4326', {
                    west: 0,
                    east: 10,
                    south: 0,
                    north: 10,
                }),
                maxSubdivisionLevel: 15,
            });

            instance.addEventListener('entity-removed', () => {
                eventFired = true;
            });

            expect(eventFired).toBeFalsy();

            instance.add(map).then(() => {
                instance.remove(map);
                expect(eventFired).toBeTruthy();
            });
        });
    });

    describe('loading', () => {
        it('should return false if no entity is present', () => {
            expect(instance.loading).toBeFalsy();
        });

        it('should return true if any entity is loading', () => {
            const extent = new Extent('EPSG:4326', 0, 0, 0, 0);
            const map1 = new Map({ extent });
            const map2 = new Map({ extent });

            let map1Loading = false;
            let map2Loading = false;

            Object.defineProperty(map1, 'loading', {
                get: jest.fn(() => map1Loading),
                set: jest.fn(),
            });

            Object.defineProperty(map2, 'loading', {
                get: jest.fn(() => map2Loading),
                set: jest.fn(),
            });

            instance.add(map1);
            instance.add(map2);

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
            const extent = new Extent('EPSG:4326', 0, 0, 0, 0);
            const map1 = new Map({ extent });
            const map2 = new Map({ extent });

            instance.add(map1);

            expect(instance.getEntities()).toEqual(expect.arrayContaining([map1]));

            instance.add(map2);

            expect(instance.getEntities()).toEqual(expect.arrayContaining([map1, map2]));

            instance.remove(map1);

            expect(instance.getEntities()).toEqual(expect.arrayContaining([map2]));

            instance.remove(map2);

            expect(instance.getEntities()).toEqual(expect.arrayContaining([]));
        });
    });

    describe('getObjects', () => {
        it('should return added objects and entities', () => {
            const extent = new Extent('EPSG:4326', 0, 0, 0, 0);
            const map1 = new Map({ extent });
            const map2 = new Map({ extent });
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
            const extent = new Extent('EPSG:4326', 0, 0, 0, 0);
            const map1 = new Map({ extent });
            const map2 = new Map({ extent });

            Object.defineProperty(map1, 'progress', {
                get: jest.fn(() => 0.7),
                set: jest.fn(),
            });

            Object.defineProperty(map2, 'progress', {
                get: jest.fn(() => 0.2),
                set: jest.fn(),
            });

            instance.add(map1);
            instance.add(map2);

            expect(instance.progress).toEqual((0.7 + 0.2) / 2);
        });
    });

    describe('registerCRS', () => {
        it('should throw if name or value is undefined', () => {
            expect(() => Instance.registerCRS(undefined, '')).toThrow(/missing CRS name/);
            expect(() => Instance.registerCRS('', '')).toThrow(/missing CRS name/);
            expect(() => Instance.registerCRS('EPSG:foo', '')).toThrow(/missing CRS PROJ string/);
            expect(() => Instance.registerCRS('EPSG:foo', undefined)).toThrow(
                /missing CRS PROJ string/,
            );
        });

        it('should remember previously registered CRSes', () => {
            Instance.registerCRS(
                'EPSG:3946',
                '+proj=lcc +lat_0=46 +lon_0=3 +lat_1=45.25 +lat_2=46.75 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
            );

            expect(Object.keys(proj4.defs).includes('EPSG:3946')).toBeTruthy();

            Instance.registerCRS(
                'EPSG:5011',
                '+proj=geocent +ellps=GRS80 +units=m +no_defs +type=crs',
            );

            expect(Object.keys(proj4.defs).includes('EPSG:3946')).toBeTruthy();
            expect(Object.keys(proj4.defs).includes('EPSG:5011')).toBeTruthy();
        });
    });
});
