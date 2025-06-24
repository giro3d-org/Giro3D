import type { Feature } from 'ol';
import { EventDispatcher } from 'three';
import type Extent from '../core/geographic/Extent';
import type CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';

export type GetFeatureResult = {
    features: Readonly<Feature[]>;
};

export type GetFeatureRequest = {
    extent: Extent;
    signal?: AbortSignal;
};

export interface FeatureSourceEventMap {
    updated: unknown;
}

export interface FeatureSource extends EventDispatcher<FeatureSourceEventMap> {
    initialize(options: { targetProjection: CoordinateSystem }): Promise<void>;
    getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult>;
}

export abstract class FeatureSourceBase
    extends EventDispatcher<FeatureSourceEventMap>
    implements FeatureSource
{
    abstract readonly type: string;

    protected _targetProjection: CoordinateSystem | null = null;
    protected _initialized = false;

    constructor() {
        super();
    }

    initialize(options: { targetProjection: CoordinateSystem }): Promise<void> {
        this._targetProjection = options.targetProjection;

        this._initialized = true;
        return Promise.resolve();
    }

    /**
     * Raises an event to reload the source.
     */
    update() {
        this.dispatchEvent({ type: 'updated' });
    }

    protected throwIfNotInitialized() {
        if (!this._initialized) {
            throw new Error('this source has not been initialized');
        }
    }

    abstract getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult>;
}
