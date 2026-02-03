/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { View } from 'copc';

import type { DimensionName } from './dimension';

// A dimension filter wrapped into an index accessor.
/** @internal */
export type FilterByIndex = (index: number) => boolean;

export type FilterOperator =
    | 'equal'
    | 'less'
    | 'lessequal'
    | 'greater'
    | 'greaterequal'
    | 'not'
    | 'in'
    | 'not_in';

/**
 * A filter that can be applied to dimensions to filter out unwanted points during processing.
 */
export type DimensionFilter =
    | {
          /**
           * The dimension this filter applies to.
           * If this dimension is not present in the source, the filter is ignored.
           */
          dimension: DimensionName;
          /**
           * The operator of the predicate to apply to a specific dimension value.
           */
          operator: Exclude<FilterOperator, 'in' | 'not_in'>;
          /**
           * The value to apply the predicate to.
           */
          value: number;
      }
    | {
          /**
           * The dimension this filter applies to.
           * If this dimension is not present in the source, the filter is ignored.
           */
          dimension: DimensionName;
          /**
           * The operator of the predicate to apply to a specific dimension value.
           */
          operator: Extract<FilterOperator, 'in' | 'not_in'>;
          /**
           * The values to apply the predicate to.
           */
          values: Set<number>;
      };

/**
 * For a given point index, evaluate all filters in series. Returns `true` if all filters return
 * `true`, otherwise returns `false`.
 */
export function evaluateFilters(filters: FilterByIndex[] | null, pointIndex: number): boolean {
    if (filters == null || filters.length === 0) {
        return true;
    }

    return filters.every(f => f(pointIndex));
}

export function createPredicateFromFilter(filter: DimensionFilter): (value: number) => boolean {
    const operator = filter.operator;

    switch (operator) {
        case 'equal':
            return x => x === filter.value;
        case 'less':
            return x => x < filter.value;
        case 'lessequal':
            return x => x <= filter.value;
        case 'greater':
            return x => x > filter.value;
        case 'greaterequal':
            return x => x >= filter.value;
        case 'not':
            return x => x !== filter.value;
        case 'in':
            return x => filter.values.has(x);
        case 'not_in':
            return x => !filter.values.has(x);
        default:
            throw new Error(`invalid filter operator: '${operator}'`);
    }
}

/**
 * For a given set of dimension filters, return an array of ready-to-use functions to apply to each
 * point being read.
 */
export function getPerPointFilters(filters: DimensionFilter[], view: View): FilterByIndex[] | null {
    if (filters.length === 0) {
        return null;
    }

    const result: FilterByIndex[] = [];
    for (const filter of filters) {
        const predicate = createPredicateFromFilter(filter);
        if (view.dimensions[filter.dimension] != null) {
            const getter = view.getter(filter.dimension);
            const filterFn = (i: number): boolean => predicate(getter(i));
            result.push(filterFn);
        }
    }
    if (result.length > 0) {
        return result;
    }

    return null;
}
