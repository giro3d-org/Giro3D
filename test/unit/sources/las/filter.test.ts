/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { expect, it } from 'vitest';

import { createPredicateFromFilter } from '@giro3d/giro3d/sources/las/filter';

it('filter equal', () => {
    const predicate = createPredicateFromFilter({
        dimension: 'X',
        operator: 'equal',
        value: 10,
    });

    expect(predicate(10)).toEqual(true);
    expect(predicate(9)).toEqual(false);
    expect(predicate(11)).toEqual(false);
});

it('filter less', () => {
    const predicate = createPredicateFromFilter({
        dimension: 'X',
        operator: 'less',
        value: 10,
    });

    expect(predicate(9)).toEqual(true);
    expect(predicate(10)).toEqual(false);
    expect(predicate(11)).toEqual(false);
});

it('filter lessequal', () => {
    const predicate = createPredicateFromFilter({
        dimension: 'X',
        operator: 'lessequal',
        value: 10,
    });

    expect(predicate(9)).toEqual(true);
    expect(predicate(10)).toEqual(true);
    expect(predicate(11)).toEqual(false);
});

it('filter greater', () => {
    const predicate = createPredicateFromFilter({
        dimension: 'X',
        operator: 'greater',
        value: 10,
    });

    expect(predicate(9)).toEqual(false);
    expect(predicate(10)).toEqual(false);
    expect(predicate(11)).toEqual(true);
});

it('filter greaterequal', () => {
    const predicate = createPredicateFromFilter({
        dimension: 'X',
        operator: 'greaterequal',
        value: 10,
    });

    expect(predicate(9)).toEqual(false);
    expect(predicate(10)).toEqual(true);
    expect(predicate(11)).toEqual(true);
});

it('filter not', () => {
    const predicate = createPredicateFromFilter({
        dimension: 'X',
        operator: 'not',
        value: 10,
    });

    expect(predicate(9)).toEqual(true);
    expect(predicate(10)).toEqual(false);
    expect(predicate(11)).toEqual(true);
});

it('filter in', () => {
    const predicate = createPredicateFromFilter({
        dimension: 'X',
        operator: 'in',
        values: new Set([10, 20, 30]),
    });

    expect(predicate(9)).toEqual(false);
    expect(predicate(10)).toEqual(true);
    expect(predicate(11)).toEqual(false);
    expect(predicate(20)).toEqual(true);
    expect(predicate(21)).toEqual(false);
    expect(predicate(30)).toEqual(true);
    expect(predicate(31)).toEqual(false);
});

it('filter not_in', () => {
    const predicate = createPredicateFromFilter({
        dimension: 'X',
        operator: 'not_in',
        values: new Set([10, 20, 30]),
    });

    expect(predicate(9)).toEqual(true);
    expect(predicate(10)).toEqual(false);
    expect(predicate(11)).toEqual(true);
    expect(predicate(20)).toEqual(false);
    expect(predicate(21)).toEqual(true);
    expect(predicate(30)).toEqual(false);
    expect(predicate(31)).toEqual(true);
});

it('should throw on unknown operator', () => {
    expect(() =>
        createPredicateFromFilter({
            // @ts-expect-error we want to test an invalid operator
            operator: 'foo',
            dimension: 'X',
            value: 10,
        }),
    ).toThrow("invalid filter operator: 'foo'");
});
