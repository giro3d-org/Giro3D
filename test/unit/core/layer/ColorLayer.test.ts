/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it, vitest } from 'vitest';

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import NullSource from '@giro3d/giro3d/sources/NullSource';

describe('constructor', () => {
    it('should auto-generate an id if no id is specified', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        expect(layer.id).toBeDefined();
    });

    it('should define layer properties', () => {
        const layer = new ColorLayer({ source: new NullSource(), name: 'foo' });

        expect(layer.frozen).toEqual(false);
        expect(layer.visible).toEqual(true);
        expect(layer.opacity).toEqual(1.0);
        expect(layer.name).toEqual('foo');
    });

    it('should disable no-data filling by default', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        expect(layer.noDataOptions).toEqual({ replaceNoData: false });
    });
});

describe('opacity', () => {
    it('should return the correct value', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        expect(layer.opacity).toEqual(1);

        layer.opacity = 0.1;
        expect(layer.opacity).toEqual(0.1);
    });

    it('should raise the opacity-property-changed event', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        const listener = vitest.fn();
        layer.addEventListener('opacity-property-changed', listener);

        expect(listener).not.toHaveBeenCalled();

        layer.opacity = 0.5;
        layer.opacity = 0.5;
        layer.opacity = 0.5;

        // The event should be called only when the value actually changes
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('brightness', () => {
    it('should return the correct value', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        expect(layer.brightness).toEqual(0);

        layer.brightness = 0.1;
        expect(layer.brightness).toEqual(0.1);
    });

    it('should raise the brightness-property-changed event', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        const listener = vitest.fn();
        layer.addEventListener('brightness-property-changed', listener);

        expect(listener).not.toHaveBeenCalled();

        layer.brightness = 0.5;
        layer.brightness = 0.5;
        layer.brightness = 0.5;

        // The event should be called only when the value actually changes
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('contrast', () => {
    it('should return the correct value', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        expect(layer.contrast).toEqual(1);

        layer.contrast = 0.1;
        expect(layer.contrast).toEqual(0.1);
    });

    it('should raise the contrast-property-changed event', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        const listener = vitest.fn();
        layer.addEventListener('contrast-property-changed', listener);

        expect(listener).not.toHaveBeenCalled();

        layer.contrast = 0.5;
        layer.contrast = 0.5;
        layer.contrast = 0.5;

        // The event should be called only when the value actually changes
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('saturation', () => {
    it('should return the correct value', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        expect(layer.saturation).toEqual(1);

        layer.saturation = 0.1;
        expect(layer.saturation).toEqual(0.1);
    });

    it('should raise the saturation-property-changed event', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        const listener = vitest.fn();
        layer.addEventListener('saturation-property-changed', listener);

        expect(listener).not.toHaveBeenCalled();

        layer.saturation = 0.5;
        layer.saturation = 0.5;
        layer.saturation = 0.5;

        // The event should be called only when the value actually changes
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('elevationRange', () => {
    it('should return the correct value', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        expect(layer.elevationRange).toBeNull();

        layer.elevationRange = { min: 1, max: 2 };

        expect(layer.elevationRange).toEqual({ min: 1, max: 2 });
    });

    it('should raise the elevationRange-property-changed event', () => {
        const layer = new ColorLayer({ source: new NullSource() });

        const listener = vitest.fn();
        layer.addEventListener('elevationRange-property-changed', listener);

        expect(listener).not.toHaveBeenCalled();

        layer.elevationRange = { min: 1, max: 2 };

        expect(listener).toHaveBeenCalledTimes(1);

        layer.elevationRange = null;

        expect(listener).toHaveBeenCalledTimes(2);
    });
});
