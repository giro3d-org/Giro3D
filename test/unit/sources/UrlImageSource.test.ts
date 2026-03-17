/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { UnsignedByteType } from 'three';
import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import UrlImageSource from '@giro3d/giro3d/sources/UrlImageSource';

describe('constructor', () => {
    it('should assign the correct properties and fields', () => {
        const source = new UrlImageSource({
            urlTemplate: 'http://example.com',
            transparent: true,
        });

        expect(source.isImageSource).toEqual(true);
        expect(source.isUrlImageSource).toEqual(true);
        expect(source.type).toEqual('UrlImageSource');
        expect(source.datatype).toEqual(UnsignedByteType);
        expect(source.colorSpace).toEqual('srgb');
        expect(source.flipY).toEqual(false);
        expect(source.transparent).toEqual(true);
    });
});

describe('getExtent', () => {
    it('should return null by default', () => {
        const source = new UrlImageSource({
            urlTemplate: 'http://example.com',
        });

        expect(source.getExtent()).toBeNull();
    });

    it('should return the extent passed in the constructor', () => {
        const extent = new Extent(CoordinateSystem.epsg3857, 0, 1, 2, 3);

        const source = new UrlImageSource({
            urlTemplate: 'http://example.com',
            extent,
        });

        expect(source.getExtent()).toBe(extent);
    });
});

describe('initialize', () => {
    it('should assign the CRS to the CRS passed in the constructor', async () => {
        const source = new UrlImageSource({
            urlTemplate: 'http://example.com',
            transparent: true,
            crs: CoordinateSystem.epsg4326,
        });

        await source.initialize({ targetProjection: CoordinateSystem.epsg3857 });

        expect(source.getCrs()).toEqual(CoordinateSystem.epsg4326);
    });

    it('should assign the CRS to the target projection if no CRS was passed in the constructor', async () => {
        const source = new UrlImageSource({
            urlTemplate: 'http://example.com',
            transparent: true,
        });

        await source.initialize({ targetProjection: CoordinateSystem.epsg3857 });

        expect(source.getCrs()).toEqual(CoordinateSystem.epsg3857);
    });
});

describe('generateUrl', () => {
    it('should replace the {minx},{maxx},{miny},{maxy} tokens with values of the extent', async () => {
        const crs = CoordinateSystem.epsg3857;

        const source = new UrlImageSource({
            urlTemplate: 'http://example.com/foo?minx={minx},maxx={maxx},miny={miny},maxy={maxy}',
            crs,
        });

        await source.initialize({ targetProjection: crs });

        const url = source.generateUrl({
            extent: new Extent(crs, 1.04, 10.56, -2.0002229, 20.33),
            createReadableTextures: false,
            height: 100,
            width: 100,
            id: 'foo',
        });

        expect(url).toEqual(
            'http://example.com/foo?minx=1.04,maxx=10.56,miny=-2.0002229,maxy=20.33',
        );
    });

    it('should replace the {epsgCode} token with the SRID of the target projection', async () => {
        const source = new UrlImageSource({
            urlTemplate: 'http://example.com/foo?crs=EPSG:{epsgCode}',
        });

        await source.initialize({ targetProjection: CoordinateSystem.epsg3857 });

        const url = source.generateUrl({
            extent: new Extent(CoordinateSystem.epsg3857, 1.04, 10.56, -2.0002229, 20.33),
            createReadableTextures: false,
            height: 100,
            width: 100,
            id: 'foo',
        });

        expect(url).toEqual('http://example.com/foo?crs=EPSG:3857');
    });

    it('should replace the {epsgCode} token with the SRID of the CRS passed in the constructor', async () => {
        const source = new UrlImageSource({
            urlTemplate: 'http://example.com/foo?crs=EPSG:{epsgCode}',
            crs: CoordinateSystem.epsg4326,
        });

        // Here the target projection will be different, meaning that the image will be reprojected by Giro3D
        await source.initialize({ targetProjection: CoordinateSystem.epsg3857 });

        const url = source.generateUrl({
            extent: new Extent(CoordinateSystem.epsg3857, 1.04, 10.56, -2.0002229, 20.33),
            createReadableTextures: false,
            height: 100,
            width: 100,
            id: 'foo',
        });

        expect(url).toEqual('http://example.com/foo?crs=EPSG:4326');
    });

    it('should replace the {width} and {height} token with the requested image dimensions', async () => {
        const source = new UrlImageSource({
            urlTemplate: 'http://example.com/foo?width={width}&height={height}',
            crs: CoordinateSystem.epsg4326,
        });

        // Here the target projection will be different, meaning that the image will be reprojected by Giro3D
        await source.initialize({ targetProjection: CoordinateSystem.epsg3857 });

        const url = source.generateUrl({
            extent: new Extent(CoordinateSystem.epsg3857, 1.04, 10.56, -2.0002229, 20.33),
            createReadableTextures: false,
            height: 240,
            width: 133,
            id: 'foo',
        });

        expect(url).toEqual('http://example.com/foo?width=133&height=240');
    });
});
