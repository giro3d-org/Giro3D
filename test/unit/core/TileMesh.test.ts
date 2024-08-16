import Extent from 'src/core/geographic/Extent';
import TileMesh from 'src/core/TileMesh';
import type LayeredMaterial from 'src/renderer/LayeredMaterial';
import { MathUtils } from 'three';

const extent = new Extent('EPSG:3857', 0, 1, 0, 1);

describe('TileMesh', () => {
    describe('dispose', () => {
        it('should dispose the material but NOT the geometry', () => {
            // @ts-expect-error incomplete definition
            const material = {
                dispose: jest.fn(),
                setUuid: jest.fn(),
                uniforms: {
                    tileDimensions: { value: { set: jest.fn() } },
                },
            } as LayeredMaterial;

            // @ts-expect-error incomplete definition
            const mesh = new TileMesh({
                geometryPool: new Map(),
                material,
                extent,
                segments: 8,
                coord: { level: 0, x: 0, y: 0 },
            });
            const geometry = mesh.geometry;
            geometry.dispose = jest.fn();
            let eventDispatched = false;
            mesh.addEventListener('dispose', () => {
                eventDispatched = true;
            });

            mesh.dispose();
            expect(geometry.dispose).not.toHaveBeenCalled();
            expect(material.dispose).toHaveBeenCalledTimes(1);
            expect(eventDispatched).toBeTruthy();
        });
    });

    // It is relatively long to create TileMesh on the go (in term of code), so we
    // emulate a fake one with the necessary informations in it.
    class FakeTileMesh {
        readonly id: string;
        readonly level: number;
        readonly parent: unknown;
        readonly findCommonAncestor: (tile: TileMesh) => TileMesh;

        constructor(level: number, parent: unknown = undefined) {
            this.id = MathUtils.generateUUID();
            this.level = level;
            this.parent = parent;

            this.findCommonAncestor = TileMesh.prototype.findCommonAncestor;
        }
    }

    describe('findCommonAncestor', () => {
        const tree = [[new FakeTileMesh(0)]];

        beforeAll(() => {
            // root + three levels
            for (let i = 1; i < 4; i++) {
                tree[i] = [];
                // four child per parent
                for (let j = 0; j < 4 ** i; j++) {
                    const tile = new FakeTileMesh(i, tree[i - 1][~~(j / 4)]);
                    tree[i].push(tile);
                }
            }
        });

        it('should find the correct common ancestor between two tiles of same level', () => {
            // @ts-expect-error invalid
            const res = tree[2][0].findCommonAncestor(tree[2][1]);
            expect(res).toEqual(tree[1][0]);
        });

        it('should find the correct common ancestor between two tiles of different level', () => {
            // @ts-expect-error invalid
            const res = tree[2][0].findCommonAncestor(tree[3][4]);
            expect(res).toEqual(tree[1][0]);
        });

        it('should find the correct common ancestor between two tiles to be the first one', () => {
            // @ts-expect-error invalid
            const res = tree[2][0].findCommonAncestor(tree[3][0]);
            expect(res).toEqual(tree[2][0]);
        });

        it('should find the correct common ancestor between two tiles to be the root', () => {
            // @ts-expect-error invalid
            const res = tree[3][60].findCommonAncestor(tree[2][0]);
            expect(res).toEqual(tree[0][0]);
        });
    });
});
