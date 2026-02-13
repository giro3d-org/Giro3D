/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import NestedMap from '@giro3d/giro3d/utils/NestedMap';

interface Value {
    payload: number;
}

describe('getOrDefault', () => {
    it('should returns the provided default value if the key tuple is not present', () => {
        const map = new NestedMap<string, number, Value>();

        const value0 = { payload: 123 };
        const actual0 = map.getOrCreate('foo', 4, () => value0);
        expect(actual0).toBe(value0);

        const value1 = { payload: 456 };
        const actual1 = map.getOrCreate('bar', 3, () => value1);
        expect(actual1).toBe(value1);
    });

    it('should returns the correct value if the key tuple is present', () => {
        const map = new NestedMap<string, number, Value>();

        const value0 = { payload: 123 };
        const actual0 = map.getOrCreate('foo', 4, () => value0);

        const actual1 = map.getOrCreate('foo', 4, () => {
            throw new Error('should not be called');
        });

        expect(actual0).toBe(value0);
        expect(actual1).toBe(value0);
    });
});

describe('forEach', () => {
    it('should visit all items and they are consistent', () => {
        interface V {
            k0: number;
            k1: number;
        }

        const map = new NestedMap<number, number, V>();

        const lookups = new Set<V>();

        for (let k0 = 0; k0 < 10; k0++) {
            for (let k1 = 0; k1 < 10; k1++) {
                const v: V = { k0, k1 };
                map.getOrCreate(k0, k1, () => v);
                lookups.add(v);
            }
        }

        expect(map.size).toEqual(100);

        let visited = 0;

        // Check that we actually visit _all_ items
        map.forEach((v, k0, k1, map0) => {
            expect(map0).toBe(map);

            expect(v.k0).toEqual(k0);
            expect(v.k1).toEqual(k1);

            lookups.delete(v);

            visited++;
        });

        expect(lookups.size).toEqual(0);
        expect(visited).toEqual(map.size);
    });
});
