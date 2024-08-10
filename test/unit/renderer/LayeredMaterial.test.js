import { DoubleSide, FrontSide, UnsignedByteType } from 'three';
import LayeredMaterial from '../../../src/renderer/LayeredMaterial';

const defaultAtlasInfo = { minX: 0, maxX: 1 };
const defaultRenderer = {};

describe('LayeredMaterial', () => {
    describe('constructor', () => {
        it('should assign the correct side', () => {
            const normal = new LayeredMaterial({
                options: {},
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });
            const ds = new LayeredMaterial({
                options: { doubleSided: true },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(ds.side).toBe(DoubleSide);
            expect(normal.side).toBe(FrontSide);
        });

        it('should enable the ENABLE_ELEVATION_RANGE define if options has an elevation range', () => {
            const enabled = new LayeredMaterial({
                options: { elevationRange: { min: 0, max: 100 } },
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(enabled.defines.ENABLE_ELEVATION_RANGE).toBeDefined();

            const disabled = new LayeredMaterial({
                options: {},
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
            });

            expect(disabled.defines.ENABLE_ELEVATION_RANGE).not.toBeDefined();
        });

        it('should enable the STITCHING define if options has stitching enabled', () => {
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
            const mat = new LayeredMaterial({
                renderer: defaultRenderer,
                atlasInfo: defaultAtlasInfo,
                textureDataType: UnsignedByteType,
            });
            expect(mat.defines.ENABLE_ELEVATION_RANGE).not.toBeDefined();

            const layer = {
                getRenderTargetDataType: () => UnsignedByteType,
            };
            mat.pushColorLayer(layer);

            mat.setLayerElevationRange(layer, { min: 0, max: 100 });
            expect(mat.defines.ENABLE_ELEVATION_RANGE).toBeDefined();
        });
    });
});
