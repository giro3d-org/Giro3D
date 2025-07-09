import type { Feature } from 'ol';
import type FeatureFormat from 'ol/format/Feature';
import type { Type } from 'ol/format/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';
import type Extent from '../core/geographic/Extent';
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

        url.searchParams.append('bbox', `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);

        const limit = opts?.limit ?? 1000;
        url.searchParams.append('limit', limit.toString());

        if (opts?.params) {
            for (const [key, value] of Object.entries(opts.params)) {
                url.searchParams.append(key, value);
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
    sourceCoordinateSystem?: CoordinateSystem;
}

/**
 * A feature source that supports streaming features (e.g OGC API Features, etc)
 */
export default class StreamableFeatureSource extends FeatureSourceBase {
    readonly isStreamableFeatureSource = true as const;
    readonly type = 'StreamableFeatureSource' as const;

    private readonly _queryBuilder: StreamableFeatureSourceQueryBuilder;
    private readonly _format: FeatureFormat;
    private readonly _getter: Getter;
    private readonly _sourceProjection: CoordinateSystem;

    constructor(params: StreamableFeatureSourceOptions) {
        super();
        this._queryBuilder = params.queryBuilder;
        this._format = params.format ?? new GeoJSON();
        this._getter = params.getter ?? defaultGetter;
        // TODO assume EPSG:4326 ?
        this._sourceProjection = params.sourceCoordinateSystem ?? CoordinateSystem.epsg4326;
    }

    async getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult> {
        this.throwIfNotInitialized();

        const url = this._queryBuilder({
            extent: request.extent,
            sourceCoordinateSystem: this._sourceProjection,
        });

        if (!url) {
            return {
                features: [],
            };
        }

        const data = await this._getter(url.toString(), this._format.getType());

        const features = this._format.readFeatures(data) as Feature[];

        const targetProjection = nonNull(
            this._targetCoordinateSystem,
            'this source is not initialized',
        );
        const sourceProjection = nonNull(this._sourceProjection);

        const getFeatureId = (feature: Feature) => {
            return (
                feature.getId() ?? feature.get('id') ?? feature.get('fid') ?? feature.get('ogc_fid')
            );
        };

        const actualFeatures = await processFeatures(features, sourceProjection, targetProjection, {
            getFeatureId,
        });

        return {
            features: actualFeatures,
        };
    }
}
