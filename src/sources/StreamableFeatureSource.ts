/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Feature } from 'ol';
import type FeatureFormat from 'ol/format/Feature';
import type { Type } from 'ol/format/Feature';

import GeoJSON from 'ol/format/GeoJSON';

import type { Cache } from '../core/Cache';

import { GlobalCache } from '../core/Cache';
import CoordinateSystem from '../core/geographic/CoordinateSystem';
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

export type StreamableFeatureSourceGetter = (url: string, type: Type) => Promise<unknown>;

/**
 * Getter for JSON, text, XML and ArrayBuffer data.
 */
export const defaultGetter: StreamableFeatureSourceGetter = (url, type) => {
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
    /**
     * The function to download and process the data.
     * @defaultValue {@link defaultGetter}
     */
    getter?: StreamableFeatureSourceGetter;
    /**
     * Enable caching of downloaded features.
     * @defaultValue true
     */
    enableCaching?: boolean;
    /**
     * The cache to use.
     * @defaultValue {@link GlobalCache}
     */
    cache?: Cache;
    /**
     * The loading strategy.
     * @defaultValue {@link defaultLoadingStrategy}
     */
    loadingStrategy?: StreamableFeatureSourceLoadingStrategy;
    /**
     * The source coordinate system.
     * @defaultValue EPSG:4326
     */
    sourceCoordinateSystem?: CoordinateSystem;
    /**
     * Limits the extent in which features are queried. If a feature request is
     * outside this extent, no query happens.
     * @defaultValue `null`
     */
    extent?: Extent | null;
}

export type StreamableFeatureSourceLoadingStrategy = (request: GetFeatureRequest) => {
    requests: GetFeatureRequest[];
};

/**
 * A loading strategy that process the entire input request without any filtering or splitting.
 */
export const defaultLoadingStrategy: StreamableFeatureSourceLoadingStrategy = request => ({
    requests: [request],
});

/**
 * Splits the input request into a regular grid of requests to improves caching.
 */
export const tiledLoadingStrategy: (params?: {
    /**
     * The size of the tiles in the grid. Expressed in CRS units (typically meters).
     * @defaultValue 1000
     */
    tileSize?: number;
}) => StreamableFeatureSourceLoadingStrategy = params => {
    const tileSize = params?.tileSize ?? 1000;
    return request => {
        const extent = request.extent;
        const xmin = Math.floor(extent.west / tileSize);
        const xmax = Math.ceil(extent.east / tileSize);
        const ymin = Math.floor(extent.south / tileSize);
        const ymax = Math.ceil(extent.north / tileSize);

        const tileRequests: GetFeatureRequest[] = [];

        for (let x = xmin; x < xmax; ++x) {
            for (let y = ymin; y < ymax; ++y) {
                const tileExtent = new Extent(
                    extent.crs,
                    x * tileSize,
                    (x + 1) * tileSize,
                    y * tileSize,
                    (y + 1) * tileSize,
                );

                tileRequests.push({
                    extent: tileExtent,
                    signal: request.signal,
                });
            }
        }
        return { requests: tileRequests };
    };
};

/**
 * A feature source that supports streaming features from a
 * remote server (e.g OGC API Features, etc)
 */
export default class StreamableFeatureSource extends FeatureSourceBase {
    public readonly isStreamableFeatureSource = true as const;
    public readonly type = 'StreamableFeatureSource' as const;

    private readonly _options: Required<StreamableFeatureSourceOptions>;

    public constructor(params: StreamableFeatureSourceOptions) {
        super();
        this._options = {
            queryBuilder: params.queryBuilder,
            format: params.format ?? new GeoJSON(),
            getter: params.getter ?? defaultGetter,
            loadingStrategy: params.loadingStrategy ?? defaultLoadingStrategy,
            extent: params.extent ?? null,
            cache: params.cache ?? GlobalCache,
            enableCaching: params.enableCaching ?? true,
            sourceCoordinateSystem: params.sourceCoordinateSystem ?? CoordinateSystem.epsg4326,
        };
    }

    private async processRequest(request: GetFeatureRequest): Promise<GetFeatureResult> {
        const url = this._options.queryBuilder({
            extent: request.extent,
            sourceCoordinateSystem: this._options.sourceCoordinateSystem,
        });

        if (!url) {
            return { features: [] };
        }

        const urlString = url.toString();

        if (this._options.enableCaching) {
            const cached = this._options.cache.get(urlString);
            if (cached != null) {
                return cached as GetFeatureResult;
            }
        }

        const { getter, format, sourceCoordinateSystem } = this._options;
        const targetCoordinateSystem = nonNull(this._targetCoordinateSystem);

        const data = await getter(urlString, format.getType());

        const features = format.readFeatures(data) as Feature[];

        const getFeatureId = (feature: Feature): number | string => {
            return (
                feature.getId() ?? feature.get('id') ?? feature.get('fid') ?? feature.get('ogc_fid')
            );
        };

        const processedFeatures = await processFeatures(
            features,
            sourceCoordinateSystem,
            targetCoordinateSystem,
            {
                getFeatureId,
            },
        );

        const result: GetFeatureResult = { features: processedFeatures };

        if (this._options.enableCaching) {
            this._options.cache.set(urlString, result);
        }

        return result;
    }

    public async getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult> {
        this.throwIfNotInitialized();

        let west = request.extent.west;
        let east = request.extent.east;
        let south = request.extent.south;
        let north = request.extent.north;

        if (this._options.extent) {
            west = Math.max(west, this._options.extent.west);
            east = Math.min(east, this._options.extent.east);
            south = Math.max(south, this._options.extent.south);
            north = Math.min(north, this._options.extent.north);
        }

        if (west >= east || south >= north) {
            // Empty extent
            return { features: [] };
        }

        const adjustedExtent = new Extent(request.extent.crs, { east, north, south, west });

        const strategy = nonNull(this._options.loadingStrategy);

        const { requests } = strategy({
            extent: adjustedExtent,
            signal: request.signal,
        });

        if (requests.length === 0) {
            return { features: [] };
        }

        const promises: Promise<GetFeatureResult>[] = [];

        for (const subRequest of requests) {
            promises.push(this.processRequest(subRequest));
        }

        const results = await Promise.all(promises);

        return { features: results.flatMap(item => item.features) };
    }
}
