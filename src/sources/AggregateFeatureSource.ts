/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Feature } from 'ol';

import type CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';
import type { FeatureSource, GetFeatureRequest, GetFeatureResult } from './FeatureSource';

import { FeatureSourceBase } from './FeatureSource';

export interface AggregateFeatureSourceOptions {
    sources: FeatureSource[];
}

export default class AggregateFeatureSource extends FeatureSourceBase {
    public override readonly type = 'AggregateFeatureSource' as const;
    public readonly isAggregateFeatureSource = true as const;

    private readonly _sources: FeatureSource[];

    public constructor(params: AggregateFeatureSourceOptions) {
        super();

        this._sources = [...params.sources];
    }

    /**
     * The sources in this source.
     */
    public get sources(): Readonly<FeatureSource[]> {
        return [...this._sources];
    }

    public override async getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult> {
        const result: Feature[] = [];

        const promises: Promise<GetFeatureResult>[] = [];

        for (const source of this._sources) {
            const promise = source.getFeatures(request);
            promises.push(promise);
        }

        const promiseResults = await Promise.all(promises);

        promiseResults.forEach(r => result.push(...r.features));

        return { features: result } satisfies GetFeatureResult;
    }

    public override async initialize(options: {
        targetCoordinateSystem: CoordinateSystem;
    }): Promise<void> {
        await super.initialize(options);

        this.sources.forEach(source => source.initialize(options));
    }
}
