import type ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import type { AtlasInfo } from '@giro3d/giro3d/renderer/AtlasBuilder';
import type { MaterialOptions } from '@giro3d/giro3d/renderer/LayeredMaterial';
import LayeredMaterial from '@giro3d/giro3d/renderer/LayeredMaterial';
import type { WebGLRenderer } from 'three';
import { Color, DoubleSide, FrontSide, UnsignedByteType } from 'three';

// @ts-expect-error invalid definition
const defaultAtlasInfo: AtlasInfo = { minX: 0, maxX: 1 };
// @ts-expect-error invalid definition
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
    hillshading: {
        enabled: false,
        intensity: 1,
        zFactor: 1,
        zenith: 0,
        azimuth: 0,
        elevationLayersOnly: false,
    },
    segments: 32,
    showColliderMeshes: false,
    showTileOutlines: false,
    tileOutlineColor: new Color('red'),
    terrain: {
        enabled: true,
        enableCPUTerrain: true,
        stitching: true,
    },
};

describe('LayeredMaterial', () => {
    describe('constructor', () => {
        it('should assign the correct side', () => {
            const normal = new LayeredMaterial({
                options: defaultOptions,
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });
            const ds = new LayeredMaterial({
                options: { ...defaultOptions, side: DoubleSide },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });

            expect(ds.side).toBe(DoubleSide);
            expect(normal.side).toBe(FrontSide);
        });

        it('should enable the ENABLE_ELEVATION_RANGE define if options has an elevation range', () => {
            const enabled = new LayeredMaterial({
                options: { ...defaultOptions, elevationRange: { min: 0, max: 100 } },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });

            expect(enabled.defines.ENABLE_ELEVATION_RANGE).toBeDefined();

            const disabled = new LayeredMaterial({
                options: defaultOptions,
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });

            expect(disabled.defines.ENABLE_ELEVATION_RANGE).not.toBeDefined();
        });

        it('should enable the STITCHING define if options has stitching enabled', () => {
            const enabled = new LayeredMaterial({
                options: {
                    ...defaultOptions,
                    terrain: {
                        enabled: true,
                        stitching: true,
                        enableCPUTerrain: true,
                    },
                },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });

            expect(enabled.defines.STITCHING).toBeDefined();

            const disabled = new LayeredMaterial({
                options: {
                    ...defaultOptions,
                    terrain: {
                        enabled: true,
                        stitching: false,
                        enableCPUTerrain: true,
                    },
                },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });

            expect(disabled.defines.STITCHING).not.toBeDefined();
        });

        it('should enable the TERRAIN_DEFORMATION define if options has it enabled', () => {
            const enabled = new LayeredMaterial({
                options: {
                    ...defaultOptions,
                    terrain: {
                        enabled: true,
                        enableCPUTerrain: true,
                        stitching: true,
                    },
                },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });

            expect(enabled.defines.TERRAIN_DEFORMATION).toBeDefined();

            const disabled = new LayeredMaterial({
                options: {
                    ...defaultOptions,
                    terrain: {
                        enabled: false,
                        enableCPUTerrain: false,
                        stitching: false,
                    },
                },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });

            expect(disabled.defines.TERRAIN_DEFORMATION).not.toBeDefined();
        });
    });

    describe('setLayerElevationRange', () => {
        it('should enable the ENABLE_ELEVATION_RANGE define', () => {
            const mat = new LayeredMaterial({
                options: { ...defaultOptions, elevationRange: null },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                getIndexFn,
                hasElevationLayer: false,
                maxTextureImageUnits: 15,
                textureDataType: UnsignedByteType,
            });
            expect(mat.defines.ENABLE_ELEVATION_RANGE).not.toBeDefined();

            // @ts-expect-error invalid
            const layer: ColorLayer = {
                getRenderTargetDataType: () => UnsignedByteType,
            };
            mat.pushColorLayer(layer);

            mat.setLayerElevationRange(layer, { min: 0, max: 100 });
            expect(mat.defines.ENABLE_ELEVATION_RANGE).toBeDefined();
        });
    });
});
