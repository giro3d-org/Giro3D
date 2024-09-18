import type GetElevationOptions from './GetElevationOptions';
import type GetElevationResult from './GetElevationResult';

/**
 * Represents an object that can provide elevations at given coordinates.
 *
 * Note: to combine multiple providers into one, you can use the {@link aggregateElevationProviders} function.
 */
export default interface ElevationProvider {
    /**
     * Sample the elevation at the specified coordinate.
     *
     * Note: sampling might return more than one sample for any given coordinate. You can sort them
     * by {@link core.ElevationSample.resolution | resolution} to select the best sample for your needs.
     * @param options - The options.
     * @param result - The result object to populate with the samples. If none is provided, a new
     * empty result is created. The existing samples in the array are not removed. Useful to
     * cumulate samples across different providers.
     * @returns The {@link GetElevationResult} containing the updated sample array.
     */
    getElevation(options: GetElevationOptions, result?: GetElevationResult): GetElevationResult;
}

/** @internal */
class AggregateProvider implements ElevationProvider {
    private readonly _providers: Readonly<ElevationProvider[]>;

    constructor(providers: Readonly<ElevationProvider[]>) {
        this._providers = providers;
    }

    getElevation(options: GetElevationOptions, result?: GetElevationResult): GetElevationResult {
        result = result ?? {
            coordinates: options.coordinates,
            samples: [],
        };

        // Accumulate elevation samples from all providers.
        for (let i = 0; i < this._providers.length; i++) {
            const provider = this._providers[i];
            provider.getElevation(options, result);
        }

        return result;
    }
}

/**
 * Returns an {@link ElevationProvider} that aggregates multiple providers into one.
 * The {@link ElevationProvider.getElevation | getElevation} method will then sample
 * all underlying providers and return a single {@link GetElevationResult} containing
 * samples from all providers.
 *
 * This can be useful if a scene contains multiple overlapping terrains for example.
 *
 * @param providers - The providers to aggregate.
 */
export function aggregateElevationProviders(...providers: ElevationProvider[]): ElevationProvider {
    if (providers == null || providers.length === 0) {
        throw new Error('expected at least one provider');
    }
    if (providers.length === 1) {
        return providers[0];
    }
    return new AggregateProvider(providers);
}
