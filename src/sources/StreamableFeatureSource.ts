/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Feature } from 'ol';
import type FeatureFormat from 'ol/format/Feature';
import type { Type } from 'ol/format/Feature';

import GeoJSON from 'ol/format/GeoJSON';
import { MathUtils } from 'three';

import type { Cache } from '../core/Cache';

import { GlobalCache } from '../core/Cache';
import CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';
import Extent from '../core/geographic/Extent';
import Fetcher from '../utils/Fetcher';
import { nonNull } from '../utils/tsutils';
import { processFeatures } from './features/processor';
import { FeatureSourceBase, type GetFeatureRequest, type GetFeatureResult } from './FeatureSource';

/**
 * A function to build URLs used to query features from the remote source.
 * @returns The URL of the query, or `undefined`, if the query should not be made at all.
 */
export type StreamableFeatureSourceQueryBuilder = (params: {
    extent: Extent;
    sourceCoordinateSystem: CoordinateSystem;
}) => URL | undefined;

/**
 * A query builder to fetch data from an OGC API Features service.
 * @param serviceUrl - The base URL to the service.
 * @param collection - The name of the feature collection.
 * @param options - Optional parameters to customize the query.
 */
export const ogcApiFeaturesBuilder: (
    serverUrl: string,
    collection: string,
    options?: {
        /**
         * The limit of features to retrieve with each query.
         * @defaultValue 1000
         */
        limit?: number;
        /**
         * Additional parameters to pass to the query, such as CQL filter, etc,
         * with the exception of the `limit` (passed with the `limit` option)
         * and `bbox` parameters (dynamically computed for each query).
         */
        params?: Record<string, string>;
    },
) => StreamableFeatureSourceQueryBuilder = (serviceUrl, collection, opts) => {
    return params => {
        const url = new URL(`/collections/${collection}/items.json`, serviceUrl);

        const bbox = params.extent.as(params.sourceCoordinateSystem);

        url.searchParams.set('bbox', `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);

        const limit = opts?.limit ?? 1000;
        url.searchParams.set('limit', limit.toString());

        if (opts?.params) {
            for (const [key, value] of Object.entries(opts.params)) {
                url.searchParams.set(key, value);
            }
        }

        return url;
    };
};

/**
 * A query builder to fetch data from an WFS service.
 * @param serviceUrl - The base URL to the service.
 * @param typename - The name of the feature collection.
 * @param options - Optional parameters to customize the query.
 */
export const wfsBuilder: (
    serverUrl: string,
    typename: string,
    options?: {
        /**
         * Additional parameters to pass to the query, with the exception
         * of the `bbox` parameter (dynamically computed for each query).
         */
        params?: Record<string, string>;
    },
) => StreamableFeatureSourceQueryBuilder = (serviceUrl, typename, opts) => {
    return params => {
        const url = new URL(serviceUrl);

        url.searchParams.set('SERVICE', 'WFS');
        url.searchParams.set('VERSION', '2.0.0');
        url.searchParams.set('request', 'GetFeature');
        url.searchParams.set('typename', typename);
        url.searchParams.set('outputFormat', 'application/json');
        // url.searchParams.set('startIndex', '0');
        url.searchParams.set('SRSNAME', params.sourceCoordinateSystem.id);
        const bbox = params.extent.as(params.sourceCoordinateSystem);
        url.searchParams.set(
            'bbox',
            `${bbox.west},${bbox.south},${bbox.east},${bbox.north},${params.sourceCoordinateSystem.id}`,
        );

        if (opts?.params) {
            for (const [key, value] of Object.entries(opts.params)) {
                url.searchParams.set(key, value);
            }
        }

        return url;
    };
};

export type Getter = (url: string, type: Type) => Promise<unknown>;

export const defaultGetter: Getter = (url, type) => {
    switch (type) {
        case 'arraybuffer':
            return Fetcher.arrayBuffer(url);
        case 'json':
            return Fetcher.json(url);
        case 'text':
            return Fetcher.text(url);
        case 'xml':
            return Fetcher.xml(url);
    }
};

export interface StreamableFeatureSourceOptions {
    /**
     * The query builder.
     */
    queryBuilder: StreamableFeatureSourceQueryBuilder;
    /**
     * The format of the features.
     * @defaultValue {@link GeoJSON}
     */
    format?: FeatureFormat;
    getter?: Getter;
    featureGetter?: FeatureGetter;
    /**
     * The source coordinate system.
     * @defaultValue EPSG:4326
     */
    sourceCoordinateSystem?: CoordinateSystem;
    maxExtent?: Extent;
}

/**
 * Interface for StreamableFeatureSource feature getter.
 */
export interface FeatureGetter {
    getFeatures(
        extent: Extent,
        options: StreamableFeatureSourceOptions,
        targetCoordinateSystem: CoordinateSystem,
    ): Promise<Feature[]>;
}

export abstract class FeatureGetterBase implements FeatureGetter {
    public abstract getFeatures(
        extent: Extent,
        options: StreamableFeatureSourceOptions,
        targetCoordinateSystem: CoordinateSystem,
    ): Promise<Feature[]>;

    protected async _fetchFeatures(
        extent: Extent,
        options: StreamableFeatureSourceOptions,
        targetCoordinateSystem: CoordinateSystem,
    ): Promise<Feature[]> {
        const sourceCoordinateSystem = nonNull(options.sourceCoordinateSystem);
        const getter = nonNull(options.getter);
        const format = nonNull(options.format);

        const url = options.queryBuilder({
            extent: extent,
            sourceCoordinateSystem: sourceCoordinateSystem,
        });

        if (!url) {
            return [];
        }

        const data = await getter(url.toString(), format.getType());

        const features = format.readFeatures(data) as Feature[];

        const getFeatureId = (feature: Feature): number | string => {
            return (
                feature.getId() ?? feature.get('id') ?? feature.get('fid') ?? feature.get('ogc_fid')
            );
        };

        return await processFeatures(features, sourceCoordinateSystem, targetCoordinateSystem, {
            getFeatureId,
        });
    }
}

/**
 * The default StreamableFeatureSource feature getter.
 * Directly queries the features from the datasource.
 */
export class DefaultFeatureGetter extends FeatureGetterBase {
    public async getFeatures(
        extent: Extent,
        options: StreamableFeatureSourceOptions,
        targetCoordinateSystem: CoordinateSystem,
    ): Promise<Feature[]> {
        return await this._fetchFeatures(extent, options, targetCoordinateSystem);
    }
}

/**
 * Cached/tiled StreamableFeatureSource feature getter.
 * Queries the features from the datasource in tiles and caches the tiles.
 */
export class CachedTiledFeatureGetter extends FeatureGetterBase {
    private readonly _tileSize: number;
    private readonly _cacheKey = MathUtils.generateUUID();
    private readonly _cache: Cache;

    public constructor(params?: { tileSize?: number; cache?: Cache }) {
        super();
        this._tileSize = params?.tileSize ?? 1000;
        this._cache = params?.cache ?? GlobalCache;
    }
    public async getFeatures(
        extent: Extent,
        options: StreamableFeatureSourceOptions,
        targetCoordinateSystem: CoordinateSystem,
    ): Promise<Feature[]> {
        const xmin = Math.floor(extent.west / this._tileSize);
        const xmax = Math.ceil((extent.east + 1) / this._tileSize);
        const ymin = Math.floor(extent.south / this._tileSize);
        const ymax = Math.ceil((extent.north + 1) / this._tileSize);

        const features = [];

        for (let x = xmin; x < xmax; ++x) {
            for (let y = ymin; y < ymax; ++y) {
                const key = `${this._cacheKey}-${x}/${y}`;

                let tileFeatures = this._cache.get(key) as Feature[];
                if (tileFeatures === undefined) {
                    const tileExtent = new Extent(
                        extent.crs,
                        x * this._tileSize,
                        (x + 1) * this._tileSize,
                        y * this._tileSize,
                        (y + 1) * this._tileSize,
                    );

                    tileFeatures = await super._fetchFeatures(
                        tileExtent,
                        options,
                        targetCoordinateSystem,
                    );

                    this._cache.set(key, features);
                }
                features.push(...tileFeatures);
            }
        }
        return features;
    }
}

/**
 * A feature source that supports streaming features (e.g OGC API Features, etc)
 */
export default class StreamableFeatureSource extends FeatureSourceBase {
    public readonly isStreamableFeatureSource = true as const;
    public readonly type = 'StreamableFeatureSource' as const;

    private readonly _options: StreamableFeatureSourceOptions;

    public constructor(params: StreamableFeatureSourceOptions) {
        super();
        this._options = {
            queryBuilder: params.queryBuilder,
            format: params.format ?? new GeoJSON(),
            getter: params.getter ?? defaultGetter,
            featureGetter: params.featureGetter ?? new DefaultFeatureGetter(),
            maxExtent: params.maxExtent,
            sourceCoordinateSystem: params.sourceCoordinateSystem ?? CoordinateSystem.epsg4326,
        };
    }

    public async getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult> {
        this.throwIfNotInitialized();

        let west = request.extent.west;
        let east = request.extent.east;
        let south = request.extent.south;
        let north = request.extent.north;
        if (this._options.maxExtent) {
            west = Math.max(west, this._options.maxExtent.west);
            east = Math.min(east, this._options.maxExtent.east);
            south = Math.max(south, this._options.maxExtent.south);
            north = Math.min(north, this._options.maxExtent.north);
        }
        if (west >= east || south >= north) {
            // Empty extent
            return { features: [] };
        }

        const features = await nonNull(this._options.featureGetter).getFeatures(
            new Extent(request.extent.crs, { east, north, south, west }),
            this._options,
            nonNull(this._targetCoordinateSystem),
        );

        return { features: features };
    }
}
