/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it, vitest } from 'vitest';

import type ElevationProvider from '@giro3d/giro3d/core/ElevationProvider';

import { aggregateElevationProviders } from '@giro3d/giro3d/core/ElevationProvider';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';

describe('aggregateProviders', () => {
    it('should throw if no provider is provided', () => {
        expect(() => aggregateElevationProviders()).toThrow(/expected at least one provider/);
    });

    it('should return the original provider if it is the only one provided', () => {
        const provider: ElevationProvider = {
            getElevation: vitest.fn(),
        };
        expect(aggregateElevationProviders(provider)).toBe(provider);
    });

    it('should call use each provider when getElevation() is called', () => {
        const provider1: ElevationProvider = {
            getElevation: vitest.fn(),
        };
        const provider2: ElevationProvider = {
            getElevation: vitest.fn(),
        };
        const provider3: ElevationProvider = {
            getElevation: vitest.fn(),
        };

        const aggregate = aggregateElevationProviders(provider1, provider2, provider3);

        const coordinates = new Coordinates(CoordinateSystem.epsg3857, 0, 0);
        aggregate.getElevation({ coordinates });

        expect(provider1.getElevation).toHaveBeenCalled();
        expect(provider2.getElevation).toHaveBeenCalled();
        expect(provider3.getElevation).toHaveBeenCalled();
    });
});
