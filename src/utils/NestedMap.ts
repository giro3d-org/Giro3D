export type CreateValueFn<K0, K1, V> = (k0: K0, k1: K1) => V;

/**
 * A Map-like data structure that provides two levels of indirection.
 */
export default class NestedMap<K0, K1, V> {
    private readonly _rootMap: Map<K0, Map<K1, V>> = new Map();

    /**
     * @returns the number of elements in the NestedMap.
     */
    get size(): number {
        if (this._rootMap.size === 0) {
            return 0;
        }

        let sum = 0;
        this._rootMap.forEach(m => (sum += m.size));
        return sum;
    }

    /**
     * Executes a provided function once per each key tuple/value pair in the Map.
     */
    forEach(callbackfn: (value: V, key0: K0, key1: K1, map: NestedMap<K0, K1, V>) => void): void {
        if (this._rootMap.size === 0) {
            return;
        }

        this._rootMap.forEach((m, k0, _) => {
            m.forEach((v, k1, _) => callbackfn(v, k0, k1, this));
        });
    }

    /**
     * @returns boolean indicating whether an element with the specified key tuple exists or not.
     */
    has(k0: K0, k1: K1): boolean {
        return this._rootMap.get(k0)?.has(k1) ?? false;
    }

    clear(): void {
        this._rootMap.clear();
    }

    /**
     * Gets an element with the specified key tuple, if any.
     * Otherwise, construct it on the spot with the provided function,
     * and insert the created value in the map.
     */
    getOrCreate(k0: K0, k1: K1, createValueFn: CreateValueFn<K0, K1, V>): V {
        let root = this._rootMap.get(k0);

        if (root == null) {
            root = new Map();
            this._rootMap.set(k0, root);
        }

        let value = root.get(k1);

        if (value == null) {
            value = createValueFn(k0, k1);
            root.set(k1, value);
        }

        return value;
    }
}
