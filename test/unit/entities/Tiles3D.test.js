import '../setup.js';
import assert from 'assert';
import proj4 from 'proj4';
import { Group, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import Tiles3D from '../../../src/entities/Tiles3D';
import $3dTilesIndex from '../../../src/entities/3dtiles/3dTilesIndex';
import Tile from '../../../src/entities/3dtiles/Tile';
import View from '../../../src/renderer/View';
import Coordinates from '../../../src/core/geographic/Coordinates';
import Tiles3DSource from '../../../src/sources/Tiles3DSource';

describe('Tiles3D', () => {
    const defaultSource = new Tiles3DSource('http://example.com/tileset');

    describe('constructor', () => {
        it('should assign the source', () => {
            const sut = new Tiles3D(new Tiles3DSource('http://example.com/tileset'));
            expect(sut._url).toBe('http://example.com/tileset');
        });

        it('should assign default values if options do not provide them', () => {
            const sut = new Tiles3D(defaultSource);
            expect(sut.sseThreshold).toBe(16);
            expect(sut.cleanupDelay).toBe(1000);
        });
    });

    function tilesetWithBox(transformMatrix) {
        const tileset = {
            root: {
                boundingVolume: {
                    box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
                },
            },
        };
        if (transformMatrix) {
            tileset.root.transform = transformMatrix.elements;
        }
        return tileset;
    }

    function tilesetWithSphere(transformMatrix) {
        const tileset = {
            root: {
                boundingVolume: {
                    sphere: [0, 0, 0, 1],
                },
            },
        };
        if (transformMatrix) {
            tileset.root.transform = transformMatrix.elements;
        }
        return tileset;
    }

    describe('calculateCameraDistance with box volumes', () => {
        proj4.defs(
            'EPSG:3946',
            '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
        );

        const view = new View('EPSG:3946', 100, 100);
        view.camera.position.copy(new Coordinates('EPSG:3946', 0, 0, 100).toVector3());
        view.camera.updateMatrixWorld(true);

        it('should compute distance correctly', () => {
            const tileset = tilesetWithBox();
            const tileIndex = new $3dTilesIndex(tileset, '');

            const tile = new Tile(tileIndex.index['1']);

            tile.calculateCameraDistance(view.camera);

            expect(tile.distance).toEqual({ min: 99, max: 102.46410161513775 });
        });

        it('should affected by transform', () => {
            const m = new Matrix4()
                .makeTranslation(0, 0, 10)
                .multiply(new Matrix4().makeScale(0.01, 0.01, 0.01));
            const tileset = tilesetWithBox(m);

            const tileIndex = new $3dTilesIndex(tileset, '');

            const tile = new Tile(tileIndex.index['1']);

            tile.calculateCameraDistance(view.camera);

            expect(tile.distance).toEqual({ max: 90.02464101615138, min: 89.99 });
        });
    });

    describe('calculateCameraDistance sphere volumes', () => {
        proj4.defs(
            'EPSG:3946',
            '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
        );

        const view = new View('EPSG:3946', 100, 100);
        view.camera.position.copy(new Coordinates('EPSG:3946', 0, 0, 100).toVector3());
        view.camera.updateMatrixWorld(true);

        it('should compute distance correctly', () => {
            const tileset = tilesetWithSphere();
            const tileIndex = new $3dTilesIndex(tileset, '');

            const tile = new Tile(tileIndex.index['1']);

            tile.calculateCameraDistance(view.camera);

            expect(tile.distance).toEqual({ max: 101, min: 99 });
        });

        it('should affected by transform', () => {
            const m = new Matrix4()
                .makeTranslation(0, 0, 10)
                .multiply(new Matrix4().makeScale(0.01, 0.01, 0.01));
            const tileset = tilesetWithSphere(m);

            const tileIndex = new $3dTilesIndex(tileset, '');

            const tile = new Tile(tileIndex.index['1']);

            tile.calculateCameraDistance(view.camera);

            tile.calculateCameraDistance(view.camera);

            // floats...
            expect(tile.distance.min).toBeCloseTo(89.99, 12);
            expect(tile.distance.max).toBeCloseTo(90.01, 12);
        });
    });

    describe('getObjectToUpdateForAttachedLayers', () => {
        it('should correctly return all children', () => {
            const parentEntity = {};
            const tile = {
                content: new Group(),
                userData: { parentEntity },
            };

            for (let i = 0; i < 3; i++) {
                const mesh = new Mesh();
                mesh.userData.parentEntity = parentEntity;
                tile.content.add(mesh);
            }

            const tiles3D = new Tiles3D(defaultSource);

            const result = tiles3D.getObjectToUpdateForAttachedLayers(tile);
            assert.ok(Array.isArray(result.elements));
            assert.ok(result.elements.length, 3);
        });
    });

    describe('updateOpacity', () => {
        it('should use this.opacity if set', () => {
            const material = new MeshBasicMaterial();
            const entity = new Tiles3D(defaultSource, { material });

            const o = new Group();
            o.add(new Mesh());
            o.add(new Mesh());
            o.add(new Mesh());
            entity.object3d.add(o);

            for (const mesh of o.children) {
                expect(mesh.material.opacity).toBe(1);
                expect(mesh.material.transparent).toBe(false);
            }
            entity.opacity = 0.7;
            expect(entity.material.opacity).toBe(0.7);
            for (const mesh of o.children) {
                expect(mesh.material.opacity).toBe(0.7);
                expect(mesh.material.transparent).toBe(true);
            }
        });

        it("should honor object's original opacity if set when there is no material at the entity level", () => {
            const entity = new Tiles3D(defaultSource);

            const o = new Group();
            const o1 = new Mesh();
            o1.material.opacity = 1;
            o.add(o1);
            const o2 = new Mesh();
            o2.material.opacity = 0.1;
            o.add(o2);
            const o3 = new Mesh();
            o3.material.opacity = 0.9;
            o.add(o3);
            entity.object3d.add(o);
            entity.onObjectCreated(o);

            entity.opacity = 0.7;
            expect(o1.material.opacity).toBeCloseTo(0.7, 5);
            expect(o1.material.transparent).toBe(true);
            expect(o2.material.opacity).toBeCloseTo(0.07, 5);
            expect(o2.material.transparent).toBe(true);
            expect(o3.material.opacity).toBeCloseTo(0.63, 5);
            expect(o3.material.transparent).toBe(true);
        });
    });

    describe('onObjectCreated', () => {
        it('should set the opacity of the created object and its descendants to the current opacity value when they have no original opacity', () => {
            const entity = new Tiles3D(defaultSource);

            const o = new Group();
            o.add(new Mesh());
            o.add(new Mesh());
            o.add(new Mesh());
            entity.onObjectCreated(o);
            for (const mesh of o.children) {
                expect(mesh.material.opacity).toBe(1);
                expect(mesh.material.transparent).toBe(false);
            }

            entity.opacity = 0.7;
            entity.onObjectCreated(o);
            for (const mesh of o.children) {
                expect(mesh.material.opacity).toBe(0.7);
                expect(mesh.material.transparent).toBe(true);
            }
        });

        it('should correctly set the opacity of the created object and its descendants when they come with their own opacity', () => {
            const entity = new Tiles3D(defaultSource);

            const o = new Group();
            const o1 = new Mesh();
            o.add(o1);
            const o2 = new Mesh();
            o2.material.opacity = 0.1;
            o.add(o2);
            const o3 = new Mesh();
            o3.material.opacity = 0.9;
            o.add(o3);

            entity.onObjectCreated(o);

            expect(o1.material.opacity).toBe(1);
            expect(o1.material.transparent).toBe(false);
            expect(o2.material.opacity).toBe(0.1);
            expect(o2.material.transparent).toBe(true);
            expect(o3.material.opacity).toBe(0.9);
            expect(o3.material.transparent).toBe(true);
        });

        it('should correctly set the opacity of the created object and its descendants when they come with their own opacity and there is an opacity setup at the entity level', () => {
            const entity = new Tiles3D(defaultSource);

            const o = new Group();
            const o1 = new Mesh();
            o.add(o1);
            const o2 = new Mesh();
            o2.material.opacity = 0.1;
            o.add(o2);
            const o3 = new Mesh();
            o3.material.opacity = 0.9;
            o.add(o3);

            entity.opacity = 0.5;
            entity.onObjectCreated(o);
            expect(o1.material.opacity).toBe(0.5);
            expect(o1.material.transparent).toBe(true);
            expect(o2.material.opacity).toBe(0.05);
            expect(o2.material.transparent).toBe(true);
            expect(o3.material.opacity).toBe(0.45);
            expect(o3.material.transparent).toBe(true);
        });
    });
});
