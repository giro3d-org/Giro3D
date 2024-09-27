export const nameof = <T>(name: keyof T) => name;

/**
 * Extracts the property from the object, throwing an error if it is undefined.
 *
 * @throws if obj.prop is undefined.
 */
export function defined<T extends object, K extends keyof T & string>(obj: T, prop: K): T[K] {
    const val = obj[prop];

    if (val === undefined) {
        throw new Error(`missing '${prop}' parameter`);
    }

    return val;
}

/**
 * Returns the non-nullish value or throws an exception if the object is nullish.
 * @param obj - The object to evaluate for nullishness.
 * @param msg - The optional error message.
 * @returns The {@link NonNullable} equivalent of the input value.
 */
export function nonNull<T>(obj: T | undefined | null, msg?: string): NonNullable<T> {
    if (obj == null) {
        throw new Error(msg ?? 'non-null assertion failed');
    }

    return obj;
}

/**
 * Returns the non-nullish and non-empty value or throws an exception if the object is nullish or
 * an empty array.
 * @param obj - The object to evaluate for nullishness or emptyness.
 * @param msg - The optional error message.
 * @returns The {@link NonNullable} equivalent of the input value.
 */
export function nonEmpty<T>(obj: T[] | undefined | null, msg?: string): NonNullable<T[]> {
    if (obj == null) {
        throw new Error(msg ?? 'non-null assertion failed');
    }
    if (obj.length === 0) {
        throw new Error(msg ?? 'array is empty');
    }

    return obj;
}

export function isIterable<T = unknown>(obj: unknown): obj is Iterable<T> {
    if (obj == null) {
        return false;
    }
    // @ts-expect-error expression is of any type
    return typeof obj[Symbol.iterator] === 'function';
}

/**
 * Applies the callback to the input if it is a single object, or on its items if it is an iterator.
 */
export function map<T>(input: T | Iterable<T>, callback: (arg: T) => void): void {
    if (isIterable(input)) {
        for (const item of input) {
            callback(item);
        }
    } else {
        callback(input);
    }
}
