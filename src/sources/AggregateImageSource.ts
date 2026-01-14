/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MathUtils } from 'three';

import type CoordinateSystem from '../core/geographic/CoordinateSystem';
import type { GetMemoryUsageContext } from '../core/MemoryUsage';
import type { GetImageOptions, ImageResponse, ImageResult } from './ImageSource';

import Extent from '../core/geographic/Extent';
import { nonEmpty, nonNull } from '../utils/tsutils';
import ImageSource from './ImageSource';

interface SourceProperties {
    zIndex: number;
    id: string;
    visible: boolean;
}

/**
 * An image source that aggregates several sub-sources.
 * The extent of this source is the union of the extent of all sub-sources.
 *
 * Overlapping sources are stacked vertically with the sources toward the end of the array
 * being drawn on top of sources at the beginning of the array.
 *
 * Constraints:
 * - all sub-sources must have the same CRS.
 * - all sub-sources must have the same color space
 * - all sub-sources must have the same flip-Y parameter
 * - all sub-sources must produce textures that have the same datatype (e.g either 8-bit or 32-bit textures, but not both)
 */
export default class AggregateImageSource extends ImageSource {
    public readonly isAggregateImageSource = true as const;
    public override readonly type = 'AggregateImageSource' as const;

    private readonly _sources: Readonly<ImageSource[]>;
    private readonly _sourceProperties: Map<ImageSource, SourceProperties> = new Map();

    private _cachedExtent: Extent | null = null;

    public constructor(options: {
        /**
         * The sub-sources. The order in which they appear in the array will set their z-index
         * (i.e sources at the end of the array will be displayed on top).
         */
        sources: ImageSource[];
    }) {
        super({
            // Since we are stacking images, they must support transparency
            transparent: true,
            flipY: options.sources[0].flipY,
            colorSpace: options.sources[0].colorSpace,
            synchronous: options.sources.every(s => s.synchronous),
        });

        this._sources = Object.freeze(nonEmpty(options.sources, 'at least one source is expected'));

        let zIndex = 0;
        for (const source of this._sources) {
            // Ensure that we bubble the events from the sub-sources
            source.addEventListener('updated', e => this.update(e.extent));

            this._sourceProperties.set(source, {
                zIndex,
                // We must assign a unique ID to each sub-source to avoid duplicate images,
                id: MathUtils.generateUUID(),
                visible: true,
            });

            zIndex++;
        }
    }

    /**
     * The sources in this source.
     */
    public get sources(): Readonly<ImageSource[]> {
        return this._sources;
    }

    public override async initialize(options: {
        targetProjection: CoordinateSystem;
    }): Promise<void> {
        const promises = this._sources.map(source => source.initialize(options));

        await Promise.allSettled(promises);
    }

    public override getCrs(): CoordinateSystem {
        return this._sources[0].getCrs();
    }

    /**
     * Sets the visibility of a sub-source. This will trigger a repaint of the source.
     * @param source - The source to update.
     * @param visible - The new visibility.
     * @throws if the sub-source is not present in this source.
     */
    public setSourceVisibility(source: ImageSource, visible: boolean): void {
        const props = nonNull(this._sourceProperties.get(source), 'this source is not present');

        if (props.visible !== visible) {
            props.visible = visible;

            this.update(this.getExtent());
        }
    }

    /**
     * Returns the union of the extent of all the sub-sources.
     */
    public override getExtent(): Extent {
        if (this._cachedExtent == null) {
            const extents = [...this._sourceProperties.keys()].map(source => source.getExtent());
            const extent = Extent.unionMany(...extents);
            this._cachedExtent = extent;
        }

        return nonNull(this._cachedExtent);
    }

    public override getMemoryUsage(context: GetMemoryUsageContext): void {
        this._sources.forEach(source => source.getMemoryUsage(context));
    }

    private patchRequest(
        source: ImageSource,
        request: ImageResponse['request'],
    ): ImageResponse['request'] {
        const { zIndex, id } = nonNull(this._sourceProperties.get(source));

        const patched = (): Promise<ImageResult> | ImageResult => {
            const result = request();

            if (result instanceof Promise) {
                return result.then(img => {
                    img.zIndex = zIndex;
                    img.id = `${img.id}-${id}`;
                    return img;
                });
            } else {
                result.zIndex = zIndex;
                result.id = `${result.id}-${id}`;

                return result;
            }
        };

        // @ts-expect-error slightly different typing but it should be ok
        return patched;
    }

    /**
     * Returns true if the extent intersects with any sub-source's extent.
     */
    public override contains(extent: Extent): boolean {
        const convertedExtent = extent.clone().as(this.getCrs());

        return this._sources.some(source => source.contains(convertedExtent));
    }

    /**
     * Disposes all sub-sources.
     */
    public override dispose(): void {
        this._sources.forEach(source => source.dispose());
    }

    /**
     * Patches the response provided by the sub-source with specific per-source properties.
     */
    private patchResponse(source: ImageSource, response: ImageResponse): ImageResponse {
        const { id } = nonNull(this._sourceProperties.get(source));

        const result: ImageResponse = {
            // Since each sub-source will possibly return the same ID, we have to deduplicate
            // it so that the layer does not think that those are duplicate responses that should be eliminated.
            id: `${response.id}-${id}`,
            request: this.patchRequest(source, response.request),
        };

        return result;
    }

    public override getImages(options: GetImageOptions): ImageResponse[] {
        const result: ImageResponse[] = [];

        for (const source of this._sources) {
            const { visible } = nonNull(this._sourceProperties.get(source));

            if (!visible) {
                continue;
            }

            if (source.getExtent().intersectsExtent(options.extent) === true) {
                const images = source
                    .getImages(options)
                    .map(response => this.patchResponse(source, response));

                result.push(...images);
            }
        }

        return result;
    }
}
