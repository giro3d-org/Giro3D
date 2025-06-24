import type { Feature } from 'ol';
import type FeatureFormat from 'ol/format/Feature';
import type { Type } from 'ol/format/Feature';
import type { Geometry } from 'ol/geom';
import CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';
import Fetcher from '../utils/Fetcher';
import { nonNull } from '../utils/tsutils';
import { FeatureSourceBase, type GetFeatureRequest, type GetFeatureResult } from './FeatureSource';
import { filterByExtent, processFeatures } from './features/processor';

export type Getter = (url: string, type: Type) => Promise<unknown>;

const defaultGetter: Getter = (url, type) => {
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

export default class FileFeatureSource extends FeatureSourceBase {
    readonly isFileFeatureSource = true as const;
    readonly type = 'FileFeatureSource' as const;

    private readonly _format: FeatureFormat;
    private _features: Feature<Geometry>[] | null = null;
    private _loadFeaturePromise: Promise<Feature<Geometry>[]> | null = null;
    private _getter: Getter;
    private _url: string;
    private _sourceProjection?: CoordinateSystem;
    private _abortController: AbortController | null = null;

    constructor(params: {
        format: FeatureFormat;
        url: string;
        getter?: Getter;
        sourceProjection?: CoordinateSystem;
    }) {
        super();
        this._format = params.format;
        this._url = params.url;
        this._sourceProjection = params.sourceProjection;
        this._getter = params.getter ?? defaultGetter;
    }

    private loadFeatures() {
        this.throwIfNotInitialized();

        this._abortController?.abort();
        this._abortController = new AbortController();

        if (this._features != null) {
            return this._features;
        }

        if (this._loadFeaturePromise != null) {
            return this._loadFeaturePromise;
        }

        this._loadFeaturePromise = this.loadFeaturesOnce(this._abortController.signal);

        return this._loadFeaturePromise;
    }

    private async loadFeaturesOnce(signal: AbortSignal): Promise<Feature<Geometry>[]> {
        signal.throwIfAborted();

        const data = await this._getter(this._url, this._format.getType());

        signal.throwIfAborted();

        if (!this._sourceProjection) {
            const dataProjection = this._format.readProjection(data);
            if (dataProjection) {
                this._sourceProjection = CoordinateSystem.fromSrid(dataProjection?.getCode());
            } else {
                this._sourceProjection = CoordinateSystem.epsg4326;
            }
        }

        const features = this._format.readFeatures(data) as Feature[];

        const targetProjection = nonNull(this._targetProjection, 'this source is not initialized');
        const sourceProjection = nonNull(this._sourceProjection);

        const actualFeatures = await processFeatures(features, sourceProjection, targetProjection);

        if (!signal.aborted) {
            this._features = actualFeatures;
        }

        return actualFeatures;
    }

    async getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult> {
        request.signal?.throwIfAborted();

        const features = await this.loadFeatures();

        request.signal?.throwIfAborted();

        const filtered = await filterByExtent(features, request.extent, { signal: request.signal });

        request.signal?.throwIfAborted();

        return { features: filtered };
    }

    reload() {
        this._features = null;
        this._loadFeaturePromise = null;
        this._abortController?.abort();

        this.dispatchEvent({ type: 'updated' });
    }
}
