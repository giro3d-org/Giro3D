/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import TypedArrayVector from '@giro3d/giro3d/core/TypedArrayVector';

describe('constructor', () => {
    it('should honor capacity and have a default length of zero', () => {
        const vector = new TypedArrayVector(10, cap => new Float32Array(cap));

        expect(vector.capacity).toEqual(10);
        expect(vector).toHaveLength(0);
    });
});

describe('push', () => {
    it('should increment the length', () => {
        const vector = new TypedArrayVector(10, cap => new Float32Array(cap));
        vector.push(1);
        vector.push(2);
        vector.push(3);

        expect(vector).toHaveLength(3);
    });

    it('should add values in the correct order', () => {
        const vector = new TypedArrayVector(10, cap => new Float32Array(cap));
        vector.push(1);
        vector.push(2);
        vector.push(3);

        const array = vector.getArray();

        expect(array).toHaveLength(3);
        expect(array[0]).toEqual(1);
        expect(array[1]).toEqual(2);
        expect(array[2]).toEqual(3);
    });

    it('should cause a reallocation of the underlying array if full', () => {
        const vector = new TypedArrayVector(2, cap => new Uint16Array(cap));
        vector.push(0);
        vector.push(1);

        expect(vector.capacity).toEqual(2);
        expect(vector).toHaveLength(2);

        vector.push(2);

        expect(vector.capacity).toBeGreaterThan(2);
        expect(vector).toHaveLength(3);

        const array = vector.getArray();

        expect(array).toHaveLength(3);
        expect(array[0]).toEqual(0);
        expect(array[1]).toEqual(1);
        expect(array[2]).toEqual(2);
    });
});
