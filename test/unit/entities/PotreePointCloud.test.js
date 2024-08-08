import assert from 'assert';
import { PerspectiveCamera } from 'three';
import PotreePointCloud from '../../../src/entities/PotreePointCloud';

const context = { view: { height: 1, camera: new PerspectiveCamera() } };

describe('PotreePointCloud', () => {
    describe('preUpdate', () => {
        /** @type {PotreePointCloud} */
        let entity;

        beforeEach(() => {
            entity = new PotreePointCloud('http://example.com', 'cloud.js');
            entity.root = {};
        });

        it('should return root if no change source', () => {
            const sources = new Set();
            expect(entity.preUpdate(context, sources)[0]).toEqual(entity.root);
        });

        it('should return root if no common ancestors', () => {
            const elt1 = { name: '12', obj: { layer: 'a', isPoints: true } };
            const elt2 = { name: '345', obj: { layer: 'a', isPoints: true } };
            const sources = new Set();
            sources.add(elt1);
            sources.add(elt2);
            expect(entity.preUpdate(context, sources)[0]).toBe(entity.root);
        });

        it('should return common ancestor', () => {
            const elt1 = { name: '123', obj: { layer: 'a', isPoints: true } };
            const elt2 = { name: '12567', obj: { layer: 'a', isPoints: true } };
            const elt3 = { name: '122', obj: { layer: 'a', isPoints: true } };
            const sources = new Set();
            sources.add(elt1);
            sources.add(elt2);
            sources.add(elt3);
            entity.root.findChildrenByName = name => {
                expect(name).toEqual('12');
            };
            entity.preUpdate(context, sources);
        });

        it('should not search ancestors if layer are different root if no common ancestors', () => {
            const elt1 = { name: '12', obj: { layer: 'a', isPoints: true } };
            const elt2 = { name: '13', obj: { layer: 'b', isPoints: true } };
            const sources = new Set();
            sources.add(elt1);
            sources.add(elt2);
            entity.root.findChildrenByName = name => {
                expect(name).toEqual('12');
            };
            entity.preUpdate(context, sources);
        });
    });

    describe('getObjectToUpdateForAttachedLayers', () => {
        /** @type {PotreePointCloud} */
        let entity;

        beforeEach(() => {
            entity = new PotreePointCloud('http://example.com', 'cloud.js');
        });

        it('should correctly no-parent for the root', () => {
            const meta = {
                obj: 'a',
            };
            const result = entity.getObjectToUpdateForAttachedLayers(meta);
            expect(result.element).toEqual('a');
        });
        it('should correctly return the element and its parent', () => {
            const meta = {
                obj: 'a',
                parent: {
                    obj: 'b',
                },
            };
            const result = entity.getObjectToUpdateForAttachedLayers(meta);
            expect(result.element).toEqual('a');
            expect(result.parent).toEqual('b');
        });
    });

    describe('parseMetadata', () => {
        it('should correctly parse normal information in metadata', () => {
            const entity = new PotreePointCloud('http://example.com', 'cloud.js');

            // no normals
            const metadata = {
                boundingBox: {
                    lx: 0,
                    ly: 1,
                    ux: 2,
                    uy: 3,
                },
                scale: 1.0,
                pointAttributes: ['POSITION', 'RGB'],
            };

            entity.parseMetadata(metadata);
            const normalDefined =
                entity.material.defines.NORMAL ||
                entity.material.defines.NORMAL_SPHEREMAPPED ||
                entity.material.defines.NORMAL_OCT16;
            assert.ok(!normalDefined);

            // normals as vector
            metadata.pointAttributes = ['POSITION', 'NORMAL', 'CLASSIFICATION'];
            entity.parseMetadata(metadata, entity);
            assert.ok(entity.material.defines.NORMAL);
            assert.ok(!entity.material.defines.NORMAL_SPHEREMAPPED);
            assert.ok(!entity.material.defines.NORMAL_OCT16);

            // spheremapped normals
            entity.material = { defines: {} };
            metadata.pointAttributes = ['POSITION', 'COLOR_PACKED', 'NORMAL_SPHEREMAPPED'];
            entity.parseMetadata(metadata, entity);
            assert.ok(!entity.material.defines.NORMAL);
            assert.ok(entity.material.defines.NORMAL_SPHEREMAPPED);
            assert.ok(!entity.material.defines.NORMAL_OCT16);

            // oct16 normals
            entity.material = { defines: {} };
            metadata.pointAttributes = [
                'POSITION',
                'COLOR_PACKED',
                'CLASSIFICATION',
                'NORMAL_OCT16',
            ];
            entity.parseMetadata(metadata, entity);
            assert.ok(!entity.material.defines.NORMAL);
            assert.ok(!entity.material.defines.NORMAL_SPHEREMAPPED);
            assert.ok(entity.material.defines.NORMAL_OCT16);
        });
    });
});
