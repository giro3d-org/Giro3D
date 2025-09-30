/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Feature } from 'ol';
import type { Extent as OLExtent } from 'ol/extent';
import type { Geometry } from 'ol/geom';

import type CoordinateSystem from '../../core/geographic/coordinate-system/CoordinateSystem';
import type Extent from '../../core/geographic/Extent';

import OpenLayersUtils from '../../utils/OpenLayersUtils';
import PromiseUtils from '../../utils/PromiseUtils';

export async function processFeatures(
    features: Feature<Geometry>[],
    sourceProjection: CoordinateSystem,
    targetProjection: CoordinateSystem,
    optionalProcessings?: {
        getFeatureId?: (feature: Feature) => number | string;
        transformer?: (feature: Feature, geometry: Geometry) => void;
    },
): Promise<Feature<Geometry>[]> {
    // Since everything happens in the main frame, we split the computation
    // into several slices that are executed over time.
    await PromiseUtils.nextFrame();

    const shouldReproject = sourceProjection.id !== targetProjection.id;

    const tmpExtent = [0, 0, 0, 0];

    const transformer = (feature: Feature, index: number): Feature | null => {
        const id =
            optionalProcessings?.getFeatureId != null
                ? optionalProcessings.getFeatureId(feature)
                : index;

        feature.setId(id);

        const geometry = feature.getGeometry();

        // We ignore features without geometry as they cannot be represented.
        if (geometry) {
            if (shouldReproject) {
                // Reproject geometry
                geometry.transform(sourceProjection.id, targetProjection.id);
            }

            // Pre-compute extent to speedup ulterior computations
            geometry.getExtent(tmpExtent);

            if (optionalProcessings?.transformer) {
                optionalProcessings.transformer(feature, geometry);
            }

            return feature;
        }

        return null;
    };

    // Process the features in batched slices
    const actualFeatures = await PromiseUtils.batch(features, transformer);

    return actualFeatures;
}

export function intersects(feature: Feature, olExtent: OLExtent): boolean {
    const geom = feature.getGeometry();

    if (!geom) {
        return false;
    }

    if (geom.intersectsExtent(olExtent)) {
        return true;
    }

    return false;
}

export async function filterByExtent(
    features: Feature[],
    extent: Extent,
    options?: { signal?: AbortSignal },
): Promise<Feature[]> {
    const olExtent = OpenLayersUtils.toOLExtent(extent);

    const filter = (feature: Feature): Feature | null => {
        if (intersects(feature, olExtent)) {
            return feature;
        }

        return null;
    };

    const filtered = await PromiseUtils.batch(features, filter, { signal: options?.signal });

    return filtered;
}
