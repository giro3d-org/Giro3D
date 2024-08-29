import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid';
import EllipsoidHelper from '@giro3d/giro3d/helpers/EllipsoidHelper';
describe('EllipsoidHelper', () => {
    describe('constructor', () => {
        it('should default to WGS 84 ellipsoid', () => {
            const helper = new EllipsoidHelper();

            expect(helper.ellipsoid).toBe(Ellipsoid.WGS84);
        });
        it('should honor ellipsoid', () => {
            const ellipsoid = new Ellipsoid({ semiMajorAxis: 2, semiMinorAxis: 1 });
            const helper = new EllipsoidHelper({ ellipsoid });

            expect(helper.ellipsoid).toBe(ellipsoid);
        });
    });
});
