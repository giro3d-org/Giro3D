import type { Feature } from 'ol';
import type { GetFeatureRequest, GetFeatureResult } from './FeatureSource';
import { FeatureSourceBase } from './FeatureSource';
import { filterByExtent } from './features/processor';

export default class StaticFeatureSource extends FeatureSourceBase {
    readonly isStaticFeatureSource = true as const;
    override readonly type = 'StaticFeatureSource' as const;

    private readonly _features: Set<Feature> = new Set();

    /**
     * Returns a copy of the features contained in this source.
     */
    get features(): Readonly<Feature[]> {
        return [...this._features];
    }

    constructor() {
        super();
    }

    /**
     * Adds a single feature.
     *
     * Note: if you want to add multiple features at once, use {@link addFeatures} for better performance.
     */
    addFeature(feature: Feature) {
        this._features.add(feature);

        this.update();
    }

    /**
     * Removes a single feature.
     *
     * Note: if you want to remove multiple features at once, use {@link removeFeatures} for better performance.
     *
     * @returns `true` if the feature feature was actually removed, `false` otherwise.
     */
    removeFeature(feature: Feature): boolean {
        if (this._features.delete(feature)) {
            this.update();
            return true;
        }

        return false;
    }

    /**
     * Adds multiple features.
     */
    addFeatures(features: Iterable<Feature>) {
        for (const feature of features) {
            this._features.add(feature);
        }

        this.update();
    }

    /**
     * Removes multiple features.
     *
     * @returns `true` if at least one feature was actually removed, `false` otherwise.
     */
    removeFeatures(features: Iterable<Feature>): boolean {
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
    clear() {
        if (this._features.size > 0) {
            this._features.clear();
            this.update();
        }
    }

    override async getFeatures(request: GetFeatureRequest): Promise<GetFeatureResult> {
        const filtered = await filterByExtent([...this._features], request.extent, {
            signal: request.signal,
        });

        const result: GetFeatureResult = {
            features: filtered,
        };

        return result;
    }
}
