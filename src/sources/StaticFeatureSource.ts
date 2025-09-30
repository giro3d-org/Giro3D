/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Feature } from 'ol';

import { MathUtils } from 'three';

import type { GetFeatureRequest, GetFeatureResult } from './FeatureSource';

import CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';
import { nonNull } from '../utils/tsutils';
import { filterByExtent } from './features/processor';
import { FeatureSourceBase } from './FeatureSource';

function preprocess(feature: Feature, src: CoordinateSystem, dst: CoordinateSystem): Feature {
    if (feature.getId() == null) {
        feature.setId(MathUtils.generateUUID());
    }

    if (src.id !== dst.id) {
        feature.getGeometry()?.transform(src.id, dst.id);
    }

    return feature;
}

export interface StaticFeaturesSourceOptions {
    /**
     * The initial features in this source.
     */
    features?: Feature[];
    /**
     * The coordinate system of features contained in this source.
     * @defaultValue {@link CoordinateSystem.epsg4326}
     */
    coordinateSystem?: CoordinateSystem;
}

/**
 * A feature source that does not read from any remote source, but
 * instead acts as a container for features added by the user.
 *
 * Note: when features are added to this source, they might be transformed to match the target
 * coordinate system, as well as assigning them unique IDs.
 */
export default class StaticFeatureSource extends FeatureSourceBase {
    public readonly isStaticFeatureSource = true as const;
    public override readonly type = 'StaticFeatureSource' as const;

    private readonly _initialFeatures: Feature[] | undefined = undefined;
    private readonly _features: Set<Feature> = new Set();
    private readonly _coordinateSystem: CoordinateSystem;

    /**
     * Returns a copy of the features contained in this source.
     *
     * Note: this property returns an empty array if the source is not yet initialized.
     */
    public get features(): Readonly<Feature[]> {
        return [...this._features];
    }

    public constructor(options?: StaticFeaturesSourceOptions) {
        super();

        this._coordinateSystem = options?.coordinateSystem ?? CoordinateSystem.epsg4326;

        if (options?.features) {
            this._initialFeatures = [...options.features];
        }
    }

    /**
     * Adds a single feature.
     *
     * Note: if you want to add multiple features at once, use {@link addFeatures} for better performance.
     */
    public addFeature(feature: Feature): void {
        this.throwIfNotInitialized();

        this.doAddFeatures(feature);

        this.update();
    }

    /**
     * Removes a single feature.
     *
     * Note: if you want to remove multiple features at once, use {@link removeFeatures} for better performance.
     *
     * @returns `true` if the feature feature was actually removed, `false` otherwise.
     */
    public removeFeature(feature: Feature): boolean {
        if (this._features.delete(feature)) {
            this.update();
            return true;
        }

        return false;
    }

    /**
     * Adds multiple features.
     */
    public addFeatures(features: Iterable<Feature>): void {
        this.throwIfNotInitialized();

        this.doAddFeatures([...features]);

        this.update();
    }

    /**
     * Removes multiple features.
     *
     * @returns `true` if at least one feature was actually removed, `false` otherwise.
     */
    public removeFeatures(features: Iterable<Feature>): boolean {
        let actuallyRemoved = false;

        for (const feature of features) {
            if (this._features.delete(feature)) {
                actuallyRemoved = true;
            }
        }

        if (actuallyRemoved) {
            this.update();
            return true;
        }

        return false;
    }

    /**
     * Removes all features.
     */
    public clear(): void {
        if (this._features.size > 0) {
            this._features.clear();
            this.update();
        }
    }

    private doAddFeatures(features: Feature | Feature[]): void {
        if (Array.isArray(features)) {
            features.forEach(f => {
                preprocess(f, this._coordinateSystem, nonNull(this._targetCoordinateSystem));
                this._features.add(f);
            });
        } else {
            preprocess(features, this._coordinateSystem, nonNull(this._targetCoordinateSystem));
            this._features.add(features);
        }
    }

    public override async initialize(options: {
        targetCoordinateSystem: CoordinateSystem;
    }): Promise<void> {
        await super.initialize(options);

        // Let's prepare the features that were added during construction.
        // We couldn't do that before since the target coordinate system was not known.
        if (this._initialFeatures) {
            this.doAddFeatures(this._initialFeatures);
            this._initialFeatures.length = 0;
        }
    }

    public override async getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult> {
        const filtered = await filterByExtent([...this._features], request.extent, {
            signal: request.signal,
        });

        const result: GetFeatureResult = {
            features: filtered,
        };

        return result;
    }
}
