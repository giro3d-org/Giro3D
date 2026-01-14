/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MathUtils } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import TileMesh from '@giro3d/giro3d/entities/tiles/TileMesh';

// It is relatively long to create TileMesh on the go (in term of code), so we
// emulate a fake one with the necessary informations in it.
class FakeTileMesh {
    readonly id: string;
    readonly lod: number;
    readonly parent: unknown;
    readonly findCommonAncestor: (tile: TileMesh) => TileMesh | null;

    constructor(lod: number, parent: unknown = undefined) {
        this.id = MathUtils.generateUUID();
        this.lod = lod;
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
