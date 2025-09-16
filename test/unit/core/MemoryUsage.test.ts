/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { BufferAttribute, BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';

import { format, getGeometryMemoryUsage, isMemoryUsage } from '@giro3d/giro3d/core/MemoryUsage';

describe('isMemoryUsage', () => {
    it('should return correct value', () => {
        expect(isMemoryUsage({ isMemoryUsage: true })).toEqual(true);
        expect(isMemoryUsage({})).toEqual(false);
    });
});

describe('format', () => {
    it('should return correct bytes formatting', () => {
        expect(format(123, 'en-US')).toEqual('123 B');
    });
    it('should return correct kilobytes formatting', () => {
        expect(format(123456, 'en-US')).toEqual('120.6 KB');
    });
    it('should return correct megabytes formatting', () => {
        expect(format(1234567, 'en-US')).toEqual('1.2 MB');
    });
    it('should return correct gigabytes formatting', () => {
        expect(format(5_123_456_789, 'en-US')).toEqual('4.8 GB');
    });
});

describe('getGeometryMemoryUsage', () => {
    it('should return the correct value', () => {
        const geom = new BufferGeometry();
        const pos = new Float32Array(12345);
        const index = new Uint16Array(123456);
        const foo = new Uint8ClampedArray(1234);

        geom.setAttribute('position', new BufferAttribute(pos, 3));
        geom.setIndex(new BufferAttribute(index, 1));
        geom.setAttribute('foo', new BufferAttribute(foo, 1));

        // @ts-expect-error incomplete renderer
        const context: GetMemoryUsageContext = { objects: new Map(), renderer: {} };

        getGeometryMemoryUsage(context, geom);

        const expectedBytes = pos.byteLength + index.byteLength + foo.byteLength;

        expect(context.objects.get(geom.id)?.cpuMemory).toEqual(expectedBytes);
        expect(context.objects.get(geom.id)?.gpuMemory).toEqual(expectedBytes);
    });
});
