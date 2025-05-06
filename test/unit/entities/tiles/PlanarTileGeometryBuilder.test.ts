import Extent from '@giro3d/giro3d/core/geographic/Extent';
import PlanarTileGeometryBuilder from '@giro3d/giro3d/entities/tiles/PlanarTileGeometryBuilder';

describe('PlanarTileGeometryBuilder', () => {
    describe('rootTileMatrix', () => {
        it('should produce multiple horizontal root tiles if needed', async () => {
            const horizontalExtent = new Extent('EPSG:3857', -250, 250, -100, 100);
            const builder = new PlanarTileGeometryBuilder({
                extent: horizontalExtent,
                maxAspectRatio: 10,
                segments: 32,
                skirtDepth: undefined,
            });

            expect(builder.rootTileMatrix).toEqual({ x: 3, y: 1 });
        });

        it('should produce multiple vertical root tiles if needed', async () => {
            const verticalExtent = new Extent('EPSG:3857', -100, 100, -250, 250);
            const builder = new PlanarTileGeometryBuilder({
                extent: verticalExtent,
                maxAspectRatio: 10,
                segments: 32,
                skirtDepth: undefined,
            });
            expect(builder.rootTileMatrix).toEqual({ x: 1, y: 3 });
        });
    });
});
