import type { View } from 'copc';
import type { DimensionName } from './dimension';

// A dimension filter wrapped into an index accessor.
/** @internal */
export type FilterByIndex = (index: number) => boolean;

export type FilterOperator = 'equal' | 'less' | 'lessequal' | 'greater' | 'greaterequal' | 'not';

/**
 * A filter that can be applied to dimensions to filter out unwanted points during processing.
 */
export type DimensionFilter = {
    /**
     * The dimension this filter applies to.
     * If this dimension is not present in the source, the filter is ignored.
     */
    dimension: DimensionName;
    /**
     * The operator of the predicate to apply to a specific dimension value.
     */
    operator: FilterOperator;
    /**
     * The value to apply the predicate to.
     */
    value: number;
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

export function createPredicateFromFilter(
    operator: FilterOperator,
    value: number,
): (value: number) => boolean {
    switch (operator) {
        case 'equal':
            return x => x === value;
        case 'less':
            return x => x < value;
        case 'lessequal':
            return x => x <= value;
        case 'greater':
            return x => x > value;
        case 'greaterequal':
            return x => x >= value;
        case 'not':
            return x => x !== value;
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
        const predicate = createPredicateFromFilter(filter.operator, filter.value);
        if (view.dimensions[filter.dimension] != null) {
            const getter = view.getter(filter.dimension);
            const filterFn = (i: number) => predicate(getter(i));
            result.push(filterFn);
        }
    }
    if (result.length > 0) {
        return result;
    }

    return null;
}
