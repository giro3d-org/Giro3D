import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid';
import EllipsoidTileGeometryBuilder from '@giro3d/giro3d/entities/tiles/EllipsoidTileGeometryBuilder';
import { Vector2 } from 'three';

describe('EllipsoidTileGeometryBuilder', () => {
    describe('rootTileMatrix', () => {
        it('should return 4x2', () => {
            const builder = new EllipsoidTileGeometryBuilder(Ellipsoid.WGS84, 32, null);
            expect(builder.rootTileMatrix).toEqual(new Vector2(4, 2));
        });
    });
});
