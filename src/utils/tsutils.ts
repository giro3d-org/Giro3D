export const nameof = <T>(name: keyof T) => name;

export function nonNull<T>(obj: T | undefined | null, msg?: string): NonNullable<T> {
    if (obj == null) {
        throw new Error(msg ?? 'non-null assertion failed');
    }

    return obj;
}
