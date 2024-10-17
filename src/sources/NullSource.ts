import Extent from '../core/geographic/Extent';
import type { ImageResponse } from './ImageSource';
import ImageSource from './ImageSource';

/**
 * An image source that produces nothing. Mainly for debugging/testing purposes.
 */
class NullSource extends ImageSource {
    readonly isNullSource = true as const;
    readonly type = 'NullSource' as const;
    private readonly _extent: Extent;

    constructor(options: { extent?: Extent } = {}) {
        super();

        this._extent = options?.extent ?? new Extent('EPSG:3857', 0, 10, 0, 10);
    }

    getCrs() {
        return this._extent.crs;
    }

    getImages(): ImageResponse[] {
        return [];
    }

    getExtent() {
        return this._extent;
    }
}

export default NullSource;
