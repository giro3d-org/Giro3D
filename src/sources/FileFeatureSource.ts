import type { Feature } from 'ol';
import type FeatureFormat from 'ol/format/Feature';
import type { Type } from 'ol/format/Feature';
import GeoJSON from 'ol/format/GeoJSON';
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

export interface FileFeatureSourceOptions {
    /**
     * The URL to the remote file.
     */
    url: string;
    /**
     * The format to parse the file.
     * @defaultValue {@link GeoJSON}
     */
    format?: FeatureFormat;
    /**
     * A function to retrieve the file remotely.
     * If not specified, will use standard fetch functions to download the file.
     * Mostly useful for unit testing.
     */
    getter?: Getter;
    /**
     * The coordinate system of the features in this source.
     * 1. If not provided, will attempt to read it from the file.
     * 2. If the file does not contain coordinate system information, will assume EPSG:4326.
     */
    sourceCoordinateSystem?: CoordinateSystem;
}

/**
 * Loads features from a remote file (such as GeoJSON, GPX, etc.)
 */
export default class FileFeatureSource extends FeatureSourceBase {
    readonly isFileFeatureSource = true as const;
    readonly type = 'FileFeatureSource' as const;

    private readonly _format: FeatureFormat;
    private _features: Feature<Geometry>[] | null = null;
    private _loadFeaturePromise: Promise<Feature<Geometry>[]> | null = null;
    private _getter: Getter;
    private _url: string;
    private _sourceCoordinateSystem?: CoordinateSystem;

    constructor(params: FileFeatureSourceOptions) {
        super();

        this._format = params.format ?? new GeoJSON();
        this._url = params.url;
        this._sourceCoordinateSystem = params.sourceCoordinateSystem;
        this._getter = params.getter ?? defaultGetter;
    }

    private loadFeatures() {
        this.throwIfNotInitialized();

        if (this._features != null) {
            return this._features;
        }

        if (this._loadFeaturePromise != null) {
            return this._loadFeaturePromise;
        }

        this._loadFeaturePromise = this.loadFeaturesOnce();

        return this._loadFeaturePromise;
    }

    private async loadFeaturesOnce(): Promise<Feature<Geometry>[]> {
        const data = await this._getter(this._url, this._format.getType());

        if (!this._sourceCoordinateSystem) {
            const dataProjection = this._format.readProjection(data);
            if (dataProjection) {
                this._sourceCoordinateSystem = CoordinateSystem.fromSrid(dataProjection?.getCode());
            } else {
                this._sourceCoordinateSystem = CoordinateSystem.epsg4326;
            }
        }

        const features = this._format.readFeatures(data) as Feature[];

        const targetProjection = nonNull(
            this._targetCoordinateSystem,
            'this source is not initialized',
        );
        const sourceProjection = nonNull(this._sourceCoordinateSystem);

        const actualFeatures = await processFeatures(features, sourceProjection, targetProjection);

        this._features = actualFeatures;

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

    /**
     * Deletes the already loaded features, and dispatch an event to reload the features.
     */
    reload() {
        this._features = null;
        this._loadFeaturePromise = null;

        this.dispatchEvent({ type: 'updated' });
    }
}
