/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Color } from 'three';
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_LINE_COLOR,
    DEFAULT_LINE_WIDTH,
    DEFAULT_POINT_COLOR,
    DEFAULT_POINT_SIZE,
    getFullFillStyle,
    getFullPointStyle,
    getFullStrokeStyle,
    hashStyle,
    type FillStyle,
    type PointStyle,
    type StrokeStyle,
} from '@giro3d/giro3d/core/FeatureTypes';

describe('getFullStrokeStyle', () => {
    it('should return a completely defined style', () => {
        const partial = {};
        const full = getFullStrokeStyle(partial);
        const defaultStyle = getFullStrokeStyle();

        expect(full.depthTest).toEqual(true);
        expect(full.opacity).toEqual(1);
        expect(full.lineWidthUnits).toEqual('pixels');
        expect(full.lineWidth).toEqual(DEFAULT_LINE_WIDTH);
        expect(full.color).toEqual(DEFAULT_LINE_COLOR);
        expect(full.renderOrder).toEqual(0);

        expect(full).toEqual(defaultStyle);
    });
});

describe('getFullPointStyle', () => {
    it('should return a completely defined style', () => {
        const partial = {};
        const full = getFullPointStyle(partial);
        const defaultStyle = getFullPointStyle();

        expect(full.depthTest).toEqual(false);
        expect(full.opacity).toEqual(1);
        expect(full.color).toEqual(DEFAULT_POINT_COLOR);
        expect(full.pointSize).toEqual(DEFAULT_POINT_SIZE);
        expect(full.sizeAttenuation).toEqual(false);
        expect(full.image).toBeNull();
        expect(full.renderOrder).toEqual(0);

        expect(full).toEqual(defaultStyle);
    });
});

describe('getFullFillStyle', () => {
    it('should return a completely defined style', () => {
        const partial = {};
        const full = getFullFillStyle(partial);
        const defaultStyle = getFullFillStyle();

        expect(full.depthTest).toEqual(true);
        expect(full.opacity).toEqual(1);
        expect(full.color).toEqual('#87c6fa');
        expect(full.renderOrder).toEqual(0);

        expect(full).toEqual(defaultStyle);
    });
});

describe('hashStyle', () => {
    it('FillStyle', () => {
        const style1: Required<FillStyle> = {
            opacity: 0.12,
            color: new Color(1, 0, 0),
            renderOrder: 3,
            shading: false,
            depthTest: true,
        };

        const hashValue = hashStyle('prefix', style1);

        expect(hashValue).toEqual(
            'prefix::color=ff0000,depthTest=true,opacity=0.12,renderOrder=3,shading=false',
        );

        expect(hashStyle('prefix', style1)).toEqual(hashStyle('prefix', { ...style1 }));

        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, opacity: 0.2 }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, renderOrder: 1 }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, depthTest: false }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, color: 'blue' }),
        );
    });

    it('StrokeStyle', () => {
        const style1: Required<StrokeStyle> = {
            opacity: 0.12,
            color: new Color(1, 0, 0),
            lineWidth: 32,
            depthTest: true,
            renderOrder: 3,
            lineWidthUnits: 'world',
        };

        const hashValue = hashStyle('prefix', style1);

        expect(hashValue).toBe(
            'prefix::color=ff0000,depthTest=true,lineWidth=32,lineWidthUnits=world,opacity=0.12,renderOrder=3',
        );

        expect(hashStyle('prefix', style1)).toEqual(hashStyle('prefix', { ...style1 }));

        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, opacity: 0.2 }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, renderOrder: 1 }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, depthTest: false }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, color: 'blue' }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, lineWidth: 4 }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, lineWidthUnits: 'pixels' }),
        );
    });

    it('PointStyle', () => {
        const style1: Required<PointStyle> = {
            opacity: 0.12,
            color: new Color(1, 0, 0),
            pointSize: 110,
            sizeAttenuation: true,
            depthTest: true,
            renderOrder: 3,
            image: null,
        };

        const hashValue = hashStyle('prefix', style1);

        expect(hashValue).toBe(
            'prefix::color=ff0000,depthTest=true,image=undefined,opacity=0.12,pointSize=110,renderOrder=3,sizeAttenuation=true',
        );

        expect(hashStyle('prefix', style1)).toEqual(hashStyle('prefix', { ...style1 }));

        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, opacity: 0.2 }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, renderOrder: 1 }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, depthTest: false }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, color: 'blue' }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, pointSize: 4 }),
        );
        expect(hashStyle('prefix', style1)).not.toEqual(
            hashStyle('prefix', { ...style1, sizeAttenuation: false }),
        );
    });
});
