/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

import OffsetScale from '@giro3d/giro3d/core/OffsetScale';

describe('constructor', () => {
    it('should assign the properties', () => {
        const offsetX = 10;
        const offsetY = -3202;
        const scaleX = 1223.1;
        const scaleY = 23131.001;

        const offsetScale = new OffsetScale(offsetX, offsetY, scaleX, scaleY);

        expect(offsetScale.x).toEqual(offsetX);
        expect(offsetScale.offsetX).toEqual(offsetX);

        expect(offsetScale.y).toEqual(offsetY);
        expect(offsetScale.offsetY).toEqual(offsetY);

        expect(offsetScale.z).toEqual(scaleX);
        expect(offsetScale.scaleX).toEqual(scaleX);

        expect(offsetScale.w).toEqual(scaleY);
        expect(offsetScale.scaleY).toEqual(scaleY);
    });
});

describe('identity', () => {
    it('should return the identity transformation', () => {
        const identity = OffsetScale.identity();

        expect(identity.offsetX).toEqual(0);
        expect(identity.offsetY).toEqual(0);
        expect(identity.scaleX).toEqual(1);
        expect(identity.scaleY).toEqual(1);
    });
});

describe('transform', () => {
    it('should honor the provided target', () => {
        const offsetScale = new OffsetScale(0, 0, 100, 100);
        const target = new Vector2();

        const input = new Vector2(0, 0);

        const output = offsetScale.transform(input, target);

        expect(output).toBe(target);
    });

    it('should preserve the input if identity', () => {
        const identity = OffsetScale.identity();

        const input = new Vector2(12, 40);

        const output = identity.transform(input);

        expect(output).toEqual(input);
    });

    it('should apply correct offset', () => {
        const offsetScale = new OffsetScale(5, 4, 1, 1);

        const input = new Vector2(10, 20);

        const output = offsetScale.transform(input);

        expect(output.x).toEqual(15);
        expect(output.y).toEqual(24);
    });

    it('should apply correct scale when input is (0, 0)', () => {
        const offsetScale = new OffsetScale(0, 0, 100, 100);

        const input = new Vector2(0, 0);

        const output = offsetScale.transform(input);

        expect(output.x).toEqual(0);
        expect(output.y).toEqual(0);
    });

    it('should apply correct scale', () => {
        const offsetScale = new OffsetScale(0, 0, 32, 108);

        const input = new Vector2(5, 3);

        const output = offsetScale.transform(input);

        expect(output.x).toEqual(5 * 32);
        expect(output.y).toEqual(3 * 108);
    });

    it('should apply correct offset/scale', () => {
        const offsetScale = new OffsetScale(56, -2, 32, 108);

        const input = new Vector2(5, 3);

        const output = offsetScale.transform(input);

        expect(output.x).toEqual(56 + 5 * 32);
        expect(output.y).toEqual(-2 + 3 * 108);
    });
});
