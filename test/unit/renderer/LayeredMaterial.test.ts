import type { ColorLayer } from 'src/core/layer';
import type { AtlasInfo } from 'src/renderer/AtlasBuilder';
import LayeredMaterial from 'src/renderer/LayeredMaterial';
import type { WebGLRenderer } from 'three';
import { DoubleSide, FrontSide, UnsignedByteType } from 'three';

// @ts-expect-error invalid definition
const defaultAtlasInfo: AtlasInfo = { minX: 0, maxX: 1 };
// @ts-expect-error invalid definition
const defaultRenderer: WebGLRenderer = {};

describe('LayeredMaterial', () => {
    describe('constructor', () => {
        it('should assign the correct side', () => {
            // @ts-expect-error invalid
            const normal = new LayeredMaterial({
                options: {},
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });
            // @ts-expect-error invalid
            const ds = new LayeredMaterial({
                options: { doubleSided: true },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(ds.side).toBe(DoubleSide);
            expect(normal.side).toBe(FrontSide);
        });

        it('should enable the ENABLE_ELEVATION_RANGE define if options has an elevation range', () => {
            // @ts-expect-error invalid
            const enabled = new LayeredMaterial({
                options: { elevationRange: { min: 0, max: 100 } },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(enabled.defines.ENABLE_ELEVATION_RANGE).toBeDefined();

            // @ts-expect-error invalid
            const disabled = new LayeredMaterial({
                options: {},
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(disabled.defines.ENABLE_ELEVATION_RANGE).not.toBeDefined();
        });

        it('should enable the STITCHING define if options has stitching enabled', () => {
            // @ts-expect-error invalid
            const enabled = new LayeredMaterial({
                options: {
                    terrain: {
                        enabled: true,
                        stitching: true,
                    },
                },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(enabled.defines.STITCHING).toBeDefined();

            // @ts-expect-error invalid
            const disabled = new LayeredMaterial({
                options: {
                    terrain: {
                        enabled: true,
                        stitching: false,
                    },
                },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(disabled.defines.STITCHING).not.toBeDefined();
        });

        it('should enable the TERRAIN_DEFORMATION define if options has it enabled', () => {
            // @ts-expect-error invalid
            const enabled = new LayeredMaterial({
                options: {
                    terrain: {
                        enabled: true,
                    },
                },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(enabled.defines.TERRAIN_DEFORMATION).toBeDefined();

            // @ts-expect-error invalid
            const disabled = new LayeredMaterial({
                options: {
                    terrain: {
                        enabled: false,
                    },
                },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(disabled.defines.TERRAIN_DEFORMATION).not.toBeDefined();
        });
    });

    describe('setLayerElevationRange', () => {
        it('should enable the ENABLE_ELEVATION_RANGE define', () => {
            // @ts-expect-error invalid
            const mat = new LayeredMaterial({
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
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
