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

export type QueryBuilder = (params: {
    extent: Extent;
    sourceProjection: CoordinateSystem;
}) => URL | undefined;

export const ogcApiFeaturesBuilder: (serverUrl: string, collection: string) => QueryBuilder = (
    serverUrl,
    collection,
) => {
    return params => {
        const url = new URL(`/collections/${collection}/items.json`, serverUrl);

        const bbox = params.extent.as(params.sourceProjection);

        url.searchParams.append('bbox', `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
        url.searchParams.append('limit', '1000');

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

export default class StreamableFeatureSource extends FeatureSourceBase {
    readonly isStreamableFeatureSource = true as const;
    readonly type = 'StreamableFeatureSource' as const;

    private readonly _queryBuilder: QueryBuilder;
    private readonly _format: FeatureFormat;
    private readonly _getter: Getter;
    private readonly _sourceProjection: CoordinateSystem;

    constructor(params: {
        /**
         * The query builder.
         */
        queryBuilder: QueryBuilder;
        /**
         * The format of the features.
         * @defaultValue {@link GeoJSON}
         */
        format?: FeatureFormat;
        getter?: Getter;
        sourceProjection?: CoordinateSystem;
    }) {
        super();
        this._queryBuilder = params.queryBuilder;
        this._format = params.format ?? new GeoJSON();
        this._getter = params.getter ?? defaultGetter;
        // TODO assume EPSG:4326 ?
        this._sourceProjection = params.sourceProjection ?? CoordinateSystem.epsg4326;
    }

    async getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult> {
        this.throwIfNotInitialized();

        const url = this._queryBuilder({
            extent: request.extent,
            sourceProjection: this._sourceProjection,
        });

        if (!url) {
            return {
                features: [],
            };
        }

        const data = await this._getter(url.toString(), this._format.getType());

        const features = this._format.readFeatures(data) as Feature[];

        const targetProjection = nonNull(this._targetProjection, 'this source is not initialized');
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
