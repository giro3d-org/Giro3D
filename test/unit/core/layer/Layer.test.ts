/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import type Instance from '@giro3d/giro3d/core/Instance';
import type {
    LayerEvents,
    LayerNode,
    LayerUserData,
    TextureAndPitch,
} from '@giro3d/giro3d/core/layer/Layer';
import Layer from '@giro3d/giro3d/core/layer/Layer';
import type RequestQueue from '@giro3d/giro3d/core/RequestQueue';
import NullSource from '@giro3d/giro3d/sources/NullSource';
import { RGBAFormat, UnsignedByteType } from 'three';
import { beforeEach, describe, expect, it, vitest } from 'vitest';
import { setupGlobalMocks } from '../../mocks';

// @ts-expect-error missing implementations of abstract superclass
class TestLayer<T, U> extends Layer<T, U> {
    registerNode(_node: LayerNode, _extent: Extent): void {
        /** empty */
    }

    // @ts-expect-error invalid
    protected applyTextureToNode(
        _texture: TextureAndPitch,
        _node: LayerNode,
        _isLastRender: boolean,
    ): void {
        /** empty */
    }

    // @ts-expect-error invalid
    protected applyEmptyTextureToNode(_node: LayerNode): void {
        /** empty */
    }

    getQueue(): RequestQueue {
        return this._queue;
    }
}

interface UserData extends LayerUserData {
    bar: number;
    foo: string;
}

beforeEach(() => {
    setupGlobalMocks();
});

describe('userData', () => {
    it('returns correct values', () => {
        const layer = new TestLayer<LayerEvents, UserData>({ source: new NullSource() });

        layer.userData.bar = 3;
        layer.userData.foo = 'hello';

        expect(layer.userData.bar).toEqual(3);
        expect(layer.userData.foo).toEqual('hello');
    });
});

describe('progress & loading', () => {
    it('should return the progress and loading of the underlying queue', () => {
        const layer = new TestLayer({ source: new NullSource() });

        expect(layer.progress).toBe(layer.getQueue().progress);
        expect(layer.loading).toBe(layer.getQueue().loading);
    });
});

describe('dispose', () => {
    it('should dispose the source', () => {
        const source = new NullSource();
        source.dispose = vitest.fn();
        const layer = new TestLayer({ source });

        expect(source.dispose).not.toHaveBeenCalled();

        layer.dispose();

        expect(source.dispose).toHaveBeenCalled();
    });

    it('should dispatch the dispose event', () => {
        const source = new NullSource();
        const layer = new TestLayer({ source });

        const listener = vitest.fn();

        layer.addEventListener('dispose', listener);

        expect(listener).not.toHaveBeenCalled();

        layer.dispose();

        expect(listener).toHaveBeenCalled();
    });
});

describe('constructor', () => {
    it('should assign the provided properties', () => {
        const id = 'foo';
        const extent = new Extent(CoordinateSystem.epsg4326, 0, 0, 0, 0);
        const layer = new TestLayer({
            name: id,
            extent,
            source: new NullSource(),
        });

        expect(layer.name).toEqual(id);
        expect(layer.extent).toEqual(extent);
    });

    it('should not accept all sources', () => {
        // @ts-expect-error null argument
        expect(() => new TestLayer({ source: null })).toThrowError(/missing or invalid source/);
    });
});

describe('initialize', () => {
    it('should initialize the source', async () => {
        const source = new NullSource();
        source.initialize = vitest.fn();
        const layer = new TestLayer({ source });
        layer.getRenderTargetDataType = () => UnsignedByteType;
        layer.getRenderTargetPixelFormat = () => RGBAFormat;

        const instance: Instance = {
            notifyChange: vitest.fn(),
        } as unknown as Instance;

        await layer.initialize({ composerProjection: CoordinateSystem.epsg3857, instance });

        expect(source.initialize).toHaveBeenCalledTimes(1);
    });
});

describe('visible', () => {
    it('should return the correct value', () => {
        const layer = new TestLayer({ source: new NullSource() });

        expect(layer.visible).toEqual(true);

        layer.visible = false;
        expect(layer.visible).toEqual(false);
    });

    it('should raise the visible-property-changed event', () => {
        const layer = new TestLayer({ source: new NullSource() });

        const listener = vitest.fn();
        layer.addEventListener('visible-property-changed', listener);

        expect(listener).not.toHaveBeenCalled();

        layer.visible = false;
        layer.visible = false;
        layer.visible = false;

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
