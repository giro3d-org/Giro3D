/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { Cache, DEFAULT_CAPACITY, DEFAULT_TTL } from '@giro3d/giro3d/core/Cache';

let now = 0;
let cache: Cache;

function value(v: number): { value: number } {
    return { value: v };
}

beforeEach(() => {
    performance.now = () => now;
    cache = new Cache();
});

describe('configure', () => {
    it('should throw if cache is not empty', () => {
        cache.set('foo', { bar: 123 });

        expect(() => cache.configure({})).toThrow(/cannot configure the cache as it is not empty/);
    });

    it('should not throw if cache has been cleared', () => {
        cache.set('foo', { bar: 123 });

        cache.clear();

        expect(() => cache.configure({})).not.toThrow();
    });

    it('should honor passed configuration', () => {
        cache.configure({ maxNumberOfEntries: 123 });

        expect(cache.capacity).toEqual(123);
        expect(cache.defaultTtl).toEqual(DEFAULT_TTL);
        expect(cache.maxSize).toEqual(DEFAULT_CAPACITY);

        cache.configure({ maxNumberOfEntries: 245, ttl: 202, byteCapacity: 998 });

        expect(cache.capacity).toEqual(245);
        expect(cache.defaultTtl).toEqual(202);
        expect(cache.maxSize).toEqual(998);
    });
});

describe('clear()', () => {
    it('should remove all entries', () => {
        cache.set('foo', value(1));
        cache.set('bar', value(2));

        cache.clear();

        expect(cache.get('foo')).toBeUndefined();
        expect(cache.get('bar')).toBeUndefined();
    });

    it('should call the onDelete callback on compatible entries', () => {
        const onDelete1 = vitest.fn();
        const onDelete2 = vitest.fn();

        cache.set('foo', value(1), { ttl: 0, onDelete: onDelete1 });
        cache.set('bar', value(2));
        cache.set('baz', value(3), { ttl: 0, onDelete: onDelete2 });

        cache.clear();

        expect(cache.get('foo')).toBeUndefined();
        expect(cache.get('bar')).toBeUndefined();
        expect(cache.get('baz')).toBeUndefined();

        expect(onDelete1).toHaveBeenCalledTimes(1);
        expect(onDelete2).toHaveBeenCalledTimes(1);
    });
});

describe('delete', () => {
    it('should do nothing if the key is not present', () => {
        expect(() => cache.delete('nope')).not.toThrow();
    });

    it('should remove the entry if the key is present', () => {
        cache.set('foo', value(1));
        cache.delete('foo');
        expect(cache.get('foo')).toBeUndefined();
    });

    it('should call the onDelete callback if present', () => {
        const onDelete = vitest.fn();
        cache.set('foo', value(1), { onDelete });
        cache.delete('foo');
        expect(cache.get('foo')).toBeUndefined();
        expect(onDelete).toHaveBeenCalledTimes(1);
    });
});

describe('enable', () => {
    it('should enable/disable getting/setting entries', () => {
        cache.set('foo', value(1));
        cache.enabled = false;
        expect(cache.get('foo')).toBeUndefined();

        cache.set('bar', value(4));
        cache.enabled = true;
        expect(cache.get('bar')).toBeUndefined();
    });
});

describe('set', () => {
    it('should add the entry if not present', () => {
        cache.set('foo', value(1));
        expect(cache.get('foo')).toEqual(value(1));
    });

    it('should replace an existing entry with the same key', () => {
        cache.set('foo', value(1));
        cache.set('foo', value(2));

        expect(cache.get('foo')).toEqual(value(2));
    });

    it('should call onDelete on the replaced entry', () => {
        const onDelete1 = vitest.fn();
        const onDelete2 = vitest.fn();

        cache.set('foo', value(1), { ttl: 0, onDelete: onDelete1 });
        cache.set('foo', value(2), { ttl: 0, onDelete: onDelete2 });

        expect(cache.get('foo')).toEqual(value(2));
        expect(onDelete1).toHaveBeenCalledTimes(1);
        expect(onDelete2).not.toHaveBeenCalled();
    });

    it('should honor the specified lifetime', () => {
        now = 12;
        cache.set('foo', value(1), { ttl: 150 });

        now = 200;
        expect(cache.get('foo')).toBeUndefined();
    });

    it('should call onDelete on expired entries', () => {
        now = 12;
        const onDelete = vitest.fn();
        cache.set('foo', value(1), { ttl: 150, onDelete });

        now = 200;
        expect(cache.get('foo')).toBeUndefined();
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('should return the entry, even if cache is disabled', () => {
        const obj = { foo: 3 };
        expect(cache.set('whatever', obj)).toBe(obj);

        cache.enabled = false;
        expect(cache.set('whatever2', obj)).toBe(obj);
    });
});
