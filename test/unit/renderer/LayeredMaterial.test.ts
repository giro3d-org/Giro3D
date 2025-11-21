/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { WebGLRenderer } from 'three';

import { Color, DoubleSide, FrontSide, Texture, UnsignedByteType, Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

import type { MaterialOptions } from '@giro3d/giro3d/renderer/LayeredMaterial';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import OffsetScale from '@giro3d/giro3d/core/OffsetScale';
import { MapLightingMode } from '@giro3d/giro3d/entities/MapLightingOptions';
import LayeredMaterial from '@giro3d/giro3d/renderer/LayeredMaterial';

const defaultTextureSize: Vector2 = new Vector2(128, 128);
const defaultTileDimensions: Vector2 = new Vector2(100, 100);
const defaultExtent = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
// @ts-expect-error incomplete type
const defaultRenderer: WebGLRenderer = {};
const getIndexFn = () => 0;

const defaultOptions: MaterialOptions = {
    depthTest: true,
    backgroundColor: new Color('white'),
    backgroundOpacity: 1,
    colorimetry: { brightness: 0, contrast: 0, saturation: 1 },
    colorMapAtlas: null,
    contourLines: {
        enabled: false,
        color: 'white',
        interval: 0,
        opacity: 1,
        secondaryInterval: 1,
        thickness: 1,
    },
    discardNoData: false,
    side: FrontSide,
    elevationRange: null,
    forceTextureAtlases: false,
    graticule: {
        enabled: false,
        color: 'white',
        opacity: 1,
        thickness: 1,
        xOffset: 0,
        yOffset: 0,
        xStep: 1,
        yStep: 1,
    },
    lighting: {
        enabled: false,
        mode: MapLightingMode.Hillshade,
        hillshadeIntensity: 1,
        zFactor: 1,
        hillshadeZenith: 0,
        hillshadeAzimuth: 0,
        elevationLayersOnly: false,
    },
    showColliderMeshes: false,
    showTileOutlines: false,
    tileOutlineColor: new Color('red'),
    terrain: {
        enabled: true,
        skirts: {
            enabled: false,
            depth: 0,
        },
        segments: 32,
        stitching: true,
    },
};

describe('LayeredMaterial', () => {
    describe('constructor', () => {
        it('should assign the correct side', () => {
            const normal = new LayeredMaterial({
                options: defaultOptions,
                renderer: defaultRenderer,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });
            const ds = new LayeredMaterial({
                options: { ...defaultOptions, side: DoubleSide },
                renderer: defaultRenderer,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });

            expect(ds.side).toBe(DoubleSide);
            expect(normal.side).toBe(FrontSide);
        });

        it('should enable the ENABLE_ELEVATION_RANGE define if options has an elevation range', () => {
            const enabled = new LayeredMaterial({
                options: { ...defaultOptions, elevationRange: { min: 0, max: 100 } },
                renderer: defaultRenderer,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });

            expect(enabled.defines.ENABLE_ELEVATION_RANGE).toBeDefined();

            const disabled = new LayeredMaterial({
                options: defaultOptions,
                renderer: defaultRenderer,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });

            expect(disabled.defines.ENABLE_ELEVATION_RANGE).not.toBeDefined();
        });

        it('should enable the STITCHING define if options has stitching enabled', () => {
            const enabled = new LayeredMaterial({
                options: {
                    ...defaultOptions,
                    terrain: {
                        enabled: true,
                        segments: 32,
                        stitching: true,
                    },
                },
                renderer: defaultRenderer,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });

            expect(enabled.defines.STITCHING).toBeDefined();

            const disabled = new LayeredMaterial({
                options: {
                    ...defaultOptions,
                    terrain: {
                        enabled: true,
                        segments: 32,
                        stitching: false,
                    },
                },
                renderer: defaultRenderer,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });

            expect(disabled.defines.STITCHING).not.toBeDefined();
        });

        it('should enable the TERRAIN_DEFORMATION define if options has it enabled', () => {
            const enabled = new LayeredMaterial({
                options: {
                    ...defaultOptions,
                    terrain: {
                        enabled: true,
                        segments: 32,
                        stitching: true,
                    },
                },
                renderer: defaultRenderer,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });

            expect(enabled.defines.TERRAIN_DEFORMATION).toBeDefined();

            const disabled = new LayeredMaterial({
                options: {
                    ...defaultOptions,
                    terrain: {
                        enabled: false,
                        segments: 32,
                        stitching: false,
                    },
                },
                renderer: defaultRenderer,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });

            expect(disabled.defines.TERRAIN_DEFORMATION).not.toBeDefined();
        });
    });

    describe('updateNeighbour', () => {
        it('should update the correct uniforms', () => {
            const mat = new LayeredMaterial({
                options: { ...defaultOptions, elevationRange: null },
                renderer: defaultRenderer,
                isGlobe: false,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });

            expect(mat.uniforms.neighbours.value).toHaveLength(8);
            expect(mat.uniforms.neighbourTextures.value).toHaveLength(8);
            expect(mat.uniforms.neighbourTextures.value).toEqual([
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
            ]);

            const texture = new Texture();
            mat.updateNeighbour(3, 3, new OffsetScale(1, 2, 3, 4), texture);

            expect(mat.uniforms.neighbours.value[3].diffLevel).toEqual(3);
            expect(mat.uniforms.neighbours.value[3].offsetScale).toEqual(
                new OffsetScale(1, 2, 3, 4),
            );
            expect(mat.uniforms.neighbourTextures.value[3]).toBe(texture);
        });
    });

    describe('setLayerElevationRange', () => {
        it('should enable the ENABLE_ELEVATION_RANGE define', () => {
            const mat = new LayeredMaterial({
                options: { ...defaultOptions, elevationRange: null },
                renderer: defaultRenderer,
                getIndexFn,
                extent: defaultExtent,
                textureSize: defaultTextureSize,
                tileDimensions: defaultTileDimensions,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
                isGlobe: false,
            });
            expect(mat.defines.ENABLE_ELEVATION_RANGE).not.toBeDefined();

            // @ts-expect-error incomplete
            const layer: ColorLayer = {
                getRenderTargetDataType: () => UnsignedByteType,
                resolutionFactor: 1,
            };
            mat.pushColorLayer(layer);

            mat.setLayerElevationRange(layer, { min: 0, max: 100 });
            expect(mat.defines.ENABLE_ELEVATION_RANGE).toBeDefined();
        });
    });
});
