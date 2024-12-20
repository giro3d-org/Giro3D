import { LRUCache } from 'lru-cache';
import type MemoryUsage from './MemoryUsage';
import { isMemoryUsage, type GetMemoryUsageContext } from './MemoryUsage';

/**
 * The options for a cache entry.
 */
interface CacheOptions {
    /**
     * The time to live of this entry, in milliseconds.
     */
    ttl?: number;
    /**
     * The entry size, in bytes. It does not have to be an exact value, but
     * it helps the cache determine when to remove entries to save memory.
     */
    size?: number;
    /**
     * A optional callback called when the entry is deleted from the cache.
     */
    onDelete?: (entry: unknown) => void;
}

/**
 * The default max number of entries.
 */
const DEFAULT_MAX_ENTRIES = 8192;

/**
 * The default TTL (time to live), in milliseconds.
 */
const DEFAULT_TTL: number = 240_000; // 240 seconds

/**
 * The default capacity, in bytes.
 */
const DEFAULT_CAPACITY: number = 536_870_912; // 512 MB

interface CacheConfiguration {
    /**
     * The default TTL (time to live) of entries, in milliseconds.
     * Can be overriden for each entry (see {@link CacheOptions}).
     * @defaultValue {@link DEFAULT_TTL}
     */
    ttl?: number;
    /**
     * The capacity, in bytes, of the cache.
     * @defaultValue {@link DEFAULT_CAPACITY}
     */
    byteCapacity?: number;
    /**
     * The capacity, in number of entries, of the cache.
     * @defaultValue {@link DEFAULT_MAX_ENTRIES}
     */
    maxNumberOfEntries?: number;
}

/**
 * The cache.
 *
 */
class Cache implements MemoryUsage {
    readonly isMemoryUsage = true as const;
    private readonly _deleteHandlers: Map<string, (entry: object) => void>;
    private _lru: LRUCache<string, object>;
    private _enabled: boolean;

    /**
     * Constructs a cache.
     *
     * @param opts - The options.
     */
    constructor(opts?: CacheConfiguration) {
        this._deleteHandlers = new Map();

        this._enabled = true;
        this._lru = this.createLRUCache(opts);
    }

    private createLRUCache(opts?: CacheConfiguration) {
        return new LRUCache<string, object>({
            ttl: opts?.ttl ?? DEFAULT_TTL,
            ttlResolution: 1000, // 1 second
            updateAgeOnGet: true,
            maxSize: opts?.byteCapacity ?? DEFAULT_CAPACITY,
            max: opts?.maxNumberOfEntries ?? DEFAULT_MAX_ENTRIES,
            allowStale: false,
            dispose: (value, key) => {
                this.onDisposed(key, value);
            },
        });
    }

    /**
     * Configure the cache with the specified configuration. The cache must be
     * empty otherwise this method will throw an error.
     */
    configure(config: CacheConfiguration) {
        if (this.count > 0) {
            throw new Error('cannot configure the cache as it is not empty.');
        }
        this._lru = this.createLRUCache(config);
    }

    getMemoryUsage(context: GetMemoryUsageContext) {
        this._lru.forEach(e => {
            if (isMemoryUsage(e)) {
                e.getMemoryUsage(context);
            }
        });
    }

    /**
     * Enables or disables the cache.
     */
    get enabled() {
        return this._enabled;
    }

    set enabled(v) {
        this._enabled = v;
    }

    /**
     * Gets or sets the default TTL (time to live) of the cache.
     */
    get defaultTtl() {
        return this._lru.ttl;
    }

    set defaultTtl(v) {
        this._lru.ttl = v;
    }

    /**
     * Gets the maximum size of the cache, in bytes.
     */
    get maxSize() {
        return this._lru.maxSize;
    }

    /**
     * Gets the maximum number of entries.
     */
    get capacity() {
        return this._lru.max;
    }

    /**
     * Gets the number of entries.
     */
    get count() {
        return this._lru.size;
    }

    /**
     * Gets the size of entries, in bytes
     */
    get size() {
        return this._lru.calculatedSize;
    }

    /**
     * Returns an array of entries.
     */
    entries(): Array<unknown> {
        return [...this._lru.entries()];
    }

    private onDisposed(key: string, value: object) {
        const handler = this._deleteHandlers.get(key);
        if (handler) {
            this._deleteHandlers.delete(key);
            handler(value);
        }
    }

    /**
     * Removes stale entries.
     */
    purge() {
        this._lru.purgeStale();
    }

    /**
     * Returns the entry with the specified key, or `undefined` if no entry matches this key.
     *
     * @param key - The entry key.
     * @returns The entry, or `undefined`.
     */
    get(key: string): unknown | undefined {
        if (!this.enabled) {
            return undefined;
        }

        return this._lru.get(key);
    }

    /**
     * Stores an entry in the cache, or replaces an existing entry with the same key.
     *
     * @param key - The key.
     * @param value - The value.
     * @param options - The options.
     */
    set<T extends object>(key: string, value: T, options: CacheOptions = {}): T {
        if (!this.enabled) {
            return value;
        }

        if (typeof key !== 'string') {
            throw new Error('the cache expects strings as keys.');
        }

        this._lru.set(key, value, {
            ttl: options.ttl ?? this.defaultTtl,
            size: options.size ?? 1024, // Use a default size if not provided
        });

        if (options.onDelete) {
            this._deleteHandlers.set(key, options.onDelete);
        }

        return value;
    }

    /**
     * Deletes an entry.
     *
     * @param key - The key.
     * @returns `true` if the entry was deleted, `false` otherwise.
     */
    delete(key: string): boolean {
        return this._lru.delete(key);
    }

    /**
     * Clears the cache.
     *
     */
    clear() {
        this._lru.clear();
    }
}

/**
 * A global singleton cache.
 */
const GlobalCache: Cache = new Cache();

export {
    Cache,
    CacheConfiguration,
    CacheOptions,
    DEFAULT_CAPACITY,
    DEFAULT_MAX_ENTRIES,
    DEFAULT_TTL,
    GlobalCache,
};
