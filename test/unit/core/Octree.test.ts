/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';

import type { ChildrenList, Octree } from '@giro3d/giro3d/core/Octree';

import { create, populate, traverse } from '@giro3d/giro3d/core/Octree';

interface Payload {
    value?: number;
}

describe('create', () => {
    it('should honor passed properties', () => {
        const parent: Octree<Payload> = create({ value: 66 }, new Box3());
        const volume = new Box3();

        const octree: Octree<Payload> = create({ value: 111 }, volume, parent);

        expect(octree.parent).toBe(parent);
        expect(octree.value).toEqual(111);
        expect(octree.volume).toBe(volume);
        expect(octree.children).toBeUndefined();
    });
});

describe('traverse', () => {
    it('should skip undefined children', () => {
        const root = create<Payload>({ value: 0 }, new Box3());

        const c1 = create<Payload>({ value: 1 }, new Box3());
        const c2 = create<Payload>({ value: 2 }, new Box3());
        // Hole at child 3
        const c4 = create<Payload>({ value: 4 }, new Box3());
        const c5 = create<Payload>({ value: 5 }, new Box3());
        // Holes at children 6 & 7
        const c8 = create<Payload>({ value: 8 }, new Box3());

        root.children = [c1, c2, undefined, c4, c5, undefined, undefined, c8];

        const visited: Octree<Payload>[] = [];

        traverse(root, node => {
            visited.push(node);
            return true;
        });

        expect(visited).toEqual([root, c1, c2, c4, c5, c8]);
    });

    it('should honor return value of visitor and stop traversal', () => {
        const root = create<Payload>({ value: 0 }, new Box3());

        const c1 = create<Payload>({ value: 1 }, new Box3());
        const c2 = create<Payload>({ value: 2 }, new Box3());
        // Hole at child 3
        const c4 = create<Payload>({ value: 4 }, new Box3());
        const c5 = create<Payload>({ value: 5 }, new Box3());
        // Holes at children 6 & 7
        const c8 = create<Payload>({ value: 8 }, new Box3());

        root.children = [c1, c2, undefined, c4, c5, undefined, undefined, c8];

        const visited: Octree<Payload>[] = [];

        traverse(root, node => {
            visited.push(node);
            return false;
        });

        expect(visited).toEqual([root]);
    });
});

describe('populate', () => {
    it('should honor callback return values', () => {
        const root = create<Payload>({ value: 0 }, new Box3());

        const c0 = create<Payload>({}, new Box3());
        const c6 = create<Payload>({}, new Box3());
        const c7 = create<Payload>({}, new Box3());

        const rootList: ChildrenList<Octree<Payload>> = [
            c0,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            c6,
            c7,
        ];

        const c05 = create<Payload>({}, new Box3());
        const c0List: ChildrenList<Octree<Payload>> = [
            undefined,
            undefined,
            undefined,
            undefined,
            c05,
            undefined,
            undefined,
            undefined,
        ];

        populate(root, node => {
            if (node === root) {
                return rootList;
            }

            if (node === c0) {
                return c0List;
            }

            return undefined;
        });

        expect(root.children).toBe(rootList);
        expect(root.children![0]).toBe(c0);
        expect(root.children![1]).toBeUndefined();
        expect(root.children![2]).toBeUndefined();
        expect(root.children![3]).toBeUndefined();
        expect(root.children![4]).toBeUndefined();
        expect(root.children![5]).toBeUndefined();
        expect(root.children![6]).toBe(c6);
        expect(root.children![7]).toBe(c7);

        expect(c0.parent).toBe(root);
        expect(c6.parent).toBe(root);
        expect(c7.parent).toBe(root);

        expect(c0.children).toBe(c0List);
        expect(c05.parent).toBe(c0);
    });
});
