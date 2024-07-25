import Sun from '@giro3d/giro3d/core/geographic/Sun';

describe('Sun', () => {
    describe('getGeographicPosition', () => {
        it('should return the correct geodetic coordinates for 2025 northern summer solstice UTC', () => {
            const date = new Date(Date.UTC(2025, 5, 21, 12));

            const sunPos = Sun.getGeographicPosition(date);

            const CANCER_TROPIC = 23.4361;

            expect(sunPos.latitude).toBeLessThan(CANCER_TROPIC + 0.5);
            expect(sunPos.latitude).toBeGreaterThan(CANCER_TROPIC - 0.5);

            expect(sunPos.longitude).toBeLessThan(0.5);
            expect(sunPos.longitude).toBeGreaterThan(-0.5);
        });

        it('should return the correct geodetic coordinates for 2025 northern winter solstice UTC', () => {
            const date = new Date(Date.UTC(2025, 11, 21, 12));

            const sunPos = Sun.getGeographicPosition(date);

            const CAPRICORN_TROPIC = -23.4361;

            expect(sunPos.latitude).toBeLessThan(CAPRICORN_TROPIC + 0.5);
            expect(sunPos.latitude).toBeGreaterThan(CAPRICORN_TROPIC - 0.5);

            expect(sunPos.longitude).toBeLessThan(0.5);
            expect(sunPos.longitude).toBeGreaterThan(-0.5);
        });
    });
});
