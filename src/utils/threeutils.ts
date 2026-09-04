/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Object3D } from 'three';

import { nonNull } from './tsutils';

const traversalStack: Object3D[] = [];

export function nonRecursiveTraverse(object: Object3D, visitor: (obj: Object3D) => void): void {
    traversalStack.length = 0;

    traversalStack.push(object);

    while (traversalStack.length > 0) {
        const item = nonNull(traversalStack.pop());
        visitor(item);

        if (item.children?.length > 0) {
            traversalStack.push(...item.children);
        }
    }
}
