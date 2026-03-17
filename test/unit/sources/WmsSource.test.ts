/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import { createGetMapTemplate } from '@giro3d/giro3d/sources/WmsSource';

describe('createGetMapTemplate', () => {
    it('should return the correct URL template for WMS 1.1.1', () => {
        const template = createGetMapTemplate({
            url: 'http://example.com/wms',
            layer: 'THE_LAYER',
            projection: 'EPSG:1234',
            version: '1.1.1',
        });

        expect(template).toEqual(
            'http://example.com/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=THE_LAYER&STYLES=&SRS=EPSG:1234&BBOX={minx},{miny},{maxx},{maxy}&WIDTH={width}&HEIGHT={height}&FORMAT=image/png&TRANSPARENT=true',
        );
    });

    it('should return the correct URL template for WMS 1.3.0', () => {
        const template = createGetMapTemplate({
            url: 'http://example.com/wms',
            layer: 'THE_LAYER',
            projection: 'EPSG:1234',
            version: '1.3.0',
        });

        expect(template).toEqual(
            'http://example.com/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=THE_LAYER&STYLES=&CRS=EPSG:1234&BBOX={minx},{miny},{maxx},{maxy}&WIDTH={width}&HEIGHT={height}&FORMAT=image/png&TRANSPARENT=true',
        );
    });

    it('should honor additional parameters', () => {
        const template = createGetMapTemplate({
            url: 'http://example.com/wms',
            layer: 'THE_LAYER',
            projection: 'EPSG:1234',
            version: '1.3.0',
            params: { THE_FOO: 'foo', THE_BAR: 'bar' },
        });

        expect(template).toEqual(
            'http://example.com/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=THE_LAYER&STYLES=&CRS=EPSG:1234&BBOX={minx},{miny},{maxx},{maxy}&WIDTH={width}&HEIGHT={height}&FORMAT=image/png&TRANSPARENT=true&THE_FOO=foo&THE_BAR=bar',
        );
    });

    it('should honor the image format', () => {
        const template = createGetMapTemplate({
            url: 'http://example.com/wms',
            layer: 'THE_LAYER',
            projection: 'EPSG:1234',
            imageFormat: 'image/foobar',
            version: '1.3.0',
        });

        expect(template).toEqual(
            'http://example.com/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=THE_LAYER&STYLES=&CRS=EPSG:1234&BBOX={minx},{miny},{maxx},{maxy}&WIDTH={width}&HEIGHT={height}&FORMAT=image/foobar&TRANSPARENT=true',
        );
    });

    it('should honor the transparency', () => {
        const template = createGetMapTemplate({
            url: 'http://example.com/wms',
            layer: 'THE_LAYER',
            projection: 'EPSG:1234',
            transparent: false,
            version: '1.3.0',
        });

        expect(template).toEqual(
            'http://example.com/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=THE_LAYER&STYLES=&CRS=EPSG:1234&BBOX={minx},{miny},{maxx},{maxy}&WIDTH={width}&HEIGHT={height}&FORMAT=image/png&TRANSPARENT=false',
        );
    });

    it('should honor styles parameters', () => {
        const template = createGetMapTemplate({
            url: 'http://example.com/wms',
            layer: 'THE_LAYER',
            projection: 'EPSG:1234',
            version: '1.3.0',
            styles: ['style0', 'style1'],
        });

        expect(template).toEqual(
            'http://example.com/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=THE_LAYER&STYLES=style0,style1&CRS=EPSG:1234&BBOX={minx},{miny},{maxx},{maxy}&WIDTH={width}&HEIGHT={height}&FORMAT=image/png&TRANSPARENT=true',
        );
    });
});
