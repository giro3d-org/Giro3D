/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { Style } from 'ol/style.js';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import VectorSource from '@giro3d/giro3d/sources/VectorSource';

describe('setStyle', () => {
    let source: VectorSource;

    beforeEach(() => {
        source = new VectorSource({
            data: {
                url: 'http://example.com/geojson',
                format: new GeoJSON(),
            },
            style: new Style(),
        });
    });

    it('should trigger an update', () => {
        const listener = vitest.fn();
        source.addEventListener('updated', listener);

        source.setStyle(() => {
            /** empty */
        });

        expect(listener).toHaveBeenCalled();
    });

    it('should assign the style', () => {
        const style = new Style();
        source.setStyle(style);
        expect(source.style).toBe(style);
    });
});
