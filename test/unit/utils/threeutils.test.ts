/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { nonRecursiveTraverse } from '@giro3d/giro3d/utils/threeutils';

describe('nonRecursiveTraverse', () => {
    it('should work with a single item without children', () => {
        const visited: Object3D[] = [];
        const visitor = (obj: Object3D) => visited.push(obj);

        const obj = new Object3D();

        nonRecursiveTraverse(obj, visitor);

        expect(visited).toEqual([obj]);
    });

    it('should work with items with children', () => {
        const visited: Object3D[] = [];
        const visitor = (obj: Object3D) => visited.push(obj);

        const root = new Object3D();
        const A = new Object3D();
        const B = new Object3D();
        const C = new Object3D();

        root.children.push(A, B);
        A.children.push(C);

        nonRecursiveTraverse(root, visitor);

        expect(visited).toEqual([root, B, A, C]);
    });
});
