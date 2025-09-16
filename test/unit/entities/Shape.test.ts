/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import Shape from '@giro3d/giro3d/entities/Shape';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

describe('constructor', () => {
    it('should assign id and object3d', () => {
        const shape = new Shape();
        expect(shape.object3d).toBeDefined();
        expect(shape.object3d.type).toEqual('Group');
    });
});

describe('setPoints', () => {
    it('should make a copy of the passed Vector3s', () => {
        const shape = new Shape();

        const points = [new Vector3(), new Vector3()];

        shape.setPoints(points);

        expect(shape.points[0]).not.toBe(points[0]);
        expect(shape.points[1]).not.toBe(points[1]);
    });
});

describe('updatePoint', () => {
    it('should make a copy of the passed Vector3', () => {
        const shape = new Shape();

        const points = [new Vector3(), new Vector3()];

        shape.setPoints(points);

        const newPoint = new Vector3(1, 1);
        shape.updatePoint(0, newPoint);

        expect(shape.points[0]).toEqual(newPoint);
        expect(shape.points[0]).not.toBe(newPoint);
    });
});

describe('getLength', () => {
    it('should return null when point count is less than 2', () => {
        const shape = new Shape();

        const length = shape.getLength();

        expect(length).toBeNull();
    });

    it('should return the correct length when point count is more than 1', () => {
        const shape = new Shape();

        const a = new Vector3(1, 2, 3);
        const b = new Vector3(4, 5, 6);
        const c = new Vector3(7, 8, 9);

        shape.setPoints([a, b, c]);

        const expected = a.distanceTo(b) + b.distanceTo(c);
        const actual = shape.getLength();

        expect(actual).toEqual(expected);
    });
});

describe('getArea', () => {
    it('should return null when point count is less than 3', () => {
        const shape = new Shape();

        const area = shape.getArea();

        expect(area).toBeNull();
    });

    it('should return null when shape is not closed', () => {
        const shape = new Shape();

        const a = new Vector3(1, 2, 3);
        const b = new Vector3(4, 5, 6);
        const c = new Vector3(7, 8, 9);

        shape.setPoints([a, b, c]);

        const area = shape.getArea();

        expect(area).toBeNull();
    });

    it('should return correct value when shape is closed', () => {
        const shape = new Shape();

        const a = new Vector3(1, 2, 3);
        const b = new Vector3(4, 5, 6);
        const c = new Vector3(7, 8, 9);
        const d = new Vector3(1, 8, 9);
        const e = new Vector3().copy(a);

        shape.setPoints([a, b, c, d, e]);

        const expected = 25.45;
        const actual = shape.getArea();

        expect(actual).toBeCloseTo(expected, 1);
    });
});
