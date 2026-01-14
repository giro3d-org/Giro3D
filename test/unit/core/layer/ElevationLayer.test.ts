/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation';
import NullSource from '@giro3d/giro3d/sources/NullSource';

describe('constructor', () => {
    it('should auto-generate an id if no id is specified', () => {
        const layer = new ElevationLayer({ source: new NullSource() });

        expect(layer.id).toBeDefined();
    });

    it('should define layer properties', () => {
        const layer = new ElevationLayer({
            interpretation: Interpretation.Raw,
            source: new NullSource(),
            minmax: { min: 111, max: 333 },
            name: 'foo',
        });

        expect(layer.name).toEqual('foo');
        expect(layer.frozen).toStrictEqual(false);
        expect(layer.interpretation).toEqual(Interpretation.Raw);
        expect(layer.type).toEqual('ElevationLayer');
        expect(layer.minmax).toEqual({ min: 111, max: 333 });
    });
});
