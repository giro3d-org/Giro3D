/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { ImageResponse } from './ImageSource';

import CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';
import Extent from '../core/geographic/Extent';
import ImageSource from './ImageSource';

/**
 * An image source that produces nothing. Mainly for debugging/testing purposes.
 */
class NullSource extends ImageSource {
    public readonly isNullSource = true as const;
    public override readonly type = 'NullSource' as const;
    private readonly _extent: Extent;

    public constructor(options: { extent?: Extent } = {}) {
        super();

        this._extent = options?.extent ?? new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
    }

    public getCrs(): CoordinateSystem {
        return this._extent.crs;
    }

    public getImages(): ImageResponse[] {
        return [];
    }

    public getExtent(): Extent {
        return this._extent;
    }
}

export default NullSource;
