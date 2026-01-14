/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MathUtils } from 'three';
import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid';
import Extent from '@giro3d/giro3d/core/geographic/Extent';

const PRECISION = 8;

const wgs84 = Ellipsoid.WGS84;

describe('constructor', () => {
    it('should assign properties', () => {
        const a = 3;
        const b = 2;

        const ellipsoid = new Ellipsoid({ semiMajorAxis: a, semiMinorAxis: b });

        expect(ellipsoid.semiMajorAxis).toEqual(3);
        expect(ellipsoid.semiMinorAxis).toEqual(2);
        expect(ellipsoid.compressionFactor).toBeCloseTo(b / a, PRECISION);
        expect(ellipsoid.flattening).toBeCloseTo((a - b) / a, PRECISION);
        expect(ellipsoid.equatorialCircumference).toBeCloseTo(Math.PI * a * 2, PRECISION);
        const f = ellipsoid.flattening;
        expect(ellipsoid.eccentricity).toBeCloseTo(Math.sqrt(2 * f - f * f), PRECISION);
    });
});

describe('WGS84', () => {
    it('should return the correct semi-axes', () => {
        expect(wgs84.semiMajorAxis).toBeCloseTo(6_378_137, PRECISION);
        expect(wgs84.semiMinorAxis).toBeCloseTo(6_356_752.314245, PRECISION);
    });

    it('should always return the same instance', () => {
        const a = Ellipsoid.WGS84;
        const b = Ellipsoid.WGS84;

        expect(a).toBe(b);
    });
});

describe('scale', () => {
    it('scale both axes', () => {
        const sphere = new Ellipsoid({ semiMajorAxis: 3, semiMinorAxis: 2 }).scale(2);

        expect(sphere.semiMajorAxis).toEqual(6);
        expect(sphere.semiMinorAxis).toEqual(4);
    });
});

describe('grow', () => {
    it('offsets both axes', () => {
        const sphere = new Ellipsoid({ semiMajorAxis: 3, semiMinorAxis: 2 }).grow(10);

        expect(sphere.semiMajorAxis).toEqual(13);
        expect(sphere.semiMinorAxis).toEqual(12);
    });
});

describe('sphere', () => {
    it('should return identical semi-axes', () => {
        const sphere = Ellipsoid.sphere(2);

        expect(sphere.semiMajorAxis).toEqual(2);
        expect(sphere.semiMinorAxis).toEqual(2);
    });
});

describe('toGeodetic', () => {
    describe('trivial cases', () => {
        it('north pole', () => {
            const altitude = 2560;
            const n = wgs84.toGeodetic(0, 0, wgs84.semiMinorAxis + altitude);

            expect(n.crs.isEpsg(4979)).toEqual(true);

            expect(n.latitude).toBeCloseTo(90, PRECISION);
            expect(n.longitude).toBeCloseTo(0, PRECISION);
            expect(n.altitude).toBeCloseTo(altitude, PRECISION);
        });

        it('south pole', () => {
            const altitude = 2560;
            const n = wgs84.toGeodetic(0, 0, -(wgs84.semiMinorAxis + altitude));

            expect(n.crs.isEpsg(4979)).toEqual(true);

            expect(n.latitude).toBeCloseTo(-90, PRECISION);
            expect(n.longitude).toBeCloseTo(0, PRECISION);
            expect(n.altitude).toBeCloseTo(altitude, PRECISION);
        });

        it('lat=0, lon=0', () => {
            const altitude = 2560;
            const n = wgs84.toGeodetic(wgs84.semiMajorAxis + altitude, 0, 0);

            expect(n.crs.isEpsg(4979)).toEqual(true);

            expect(n.latitude).toBeCloseTo(0, PRECISION);
            expect(n.longitude).toBeCloseTo(0, PRECISION);
            expect(n.altitude).toBeCloseTo(altitude, PRECISION);
        });

        it('lat=0, lon=90', () => {
            const altitude = 2560;
            const n = wgs84.toGeodetic(0, wgs84.semiMajorAxis + altitude, 0);

            expect(n.crs.isEpsg(4979)).toEqual(true);

            expect(n.latitude).toBeCloseTo(0, PRECISION);
            expect(n.longitude).toBeCloseTo(90, PRECISION);
            expect(n.altitude).toBeCloseTo(altitude, PRECISION);
        });

        it('lat=0, lon=-90', () => {
            const altitude = 2560;
            const n = wgs84.toGeodetic(0, -(wgs84.semiMajorAxis + altitude), 0);

            expect(n.crs.isEpsg(4979)).toEqual(true);

            expect(n.latitude).toBeCloseTo(0, PRECISION);
            expect(n.longitude).toBeCloseTo(-90, PRECISION);
            expect(n.altitude).toBeCloseTo(altitude, PRECISION);
        });

        it('lat=0, lon=180', () => {
            const altitude = 2560;
            const n = wgs84.toGeodetic(-(wgs84.semiMajorAxis + altitude), 0, 0);

            expect(n.crs.isEpsg(4979)).toEqual(true);

            expect(n.latitude).toBeCloseTo(0, PRECISION);
            expect(n.longitude).toBeCloseTo(180, PRECISION);
            expect(n.altitude).toBeCloseTo(altitude, PRECISION);
        });
    });
});

describe('toCartesian', () => {
    describe('trivial cases', () => {
        it('north pole', () => {
            const n = wgs84.toCartesian(+90, 0, 0);

            expect(n.x).toBeCloseTo(0, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(wgs84.semiMinorAxis, PRECISION);
        });

        it('south pole', () => {
            const n = wgs84.toCartesian(-90, 0, 0);

            expect(n.x).toBeCloseTo(0, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(-wgs84.semiMinorAxis, PRECISION);
        });

        it('lat=0, lon=0', () => {
            const n = wgs84.toCartesian(0, 0, 0);

            expect(n.x).toBeCloseTo(wgs84.semiMajorAxis, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=90', () => {
            const n = wgs84.toCartesian(0, +90, 0);

            expect(n.x).toBeCloseTo(0, PRECISION);
            expect(n.y).toBeCloseTo(wgs84.semiMajorAxis, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=-90', () => {
            const n = wgs84.toCartesian(0, -90, 0);

            expect(n.x).toBeCloseTo(0, PRECISION);
            expect(n.y).toBeCloseTo(-wgs84.semiMajorAxis, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=180', () => {
            const n = wgs84.toCartesian(0, 180, 0);

            expect(n.x).toBeCloseTo(-wgs84.semiMajorAxis, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=-180', () => {
            const n = wgs84.toCartesian(0, -180, 0);

            expect(n.x).toBeCloseTo(-wgs84.semiMajorAxis, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=360', () => {
            const n = wgs84.toCartesian(0, 360, 0);

            expect(n.x).toBeCloseTo(wgs84.semiMajorAxis, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });
    });
});

describe('getNormal', () => {
    describe('trivial cases', () => {
        it('north pole', () => {
            const n = Ellipsoid.sphere(1).getNormal(+90, 0);

            expect(n.x).toBeCloseTo(0, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(1, PRECISION);
        });

        it('south pole', () => {
            const n = Ellipsoid.sphere(1).getNormal(-90, 0);

            expect(n.x).toBeCloseTo(0, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(-1, PRECISION);
        });

        it('lat=0, lon=0', () => {
            const n = Ellipsoid.sphere(1).getNormal(0, 0);

            expect(n.x).toBeCloseTo(1, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=90', () => {
            const n = Ellipsoid.sphere(1).getNormal(0, +90);

            expect(n.x).toBeCloseTo(0, PRECISION);
            expect(n.y).toBeCloseTo(1, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=-90', () => {
            const n = Ellipsoid.sphere(1).getNormal(0, -90);

            expect(n.x).toBeCloseTo(0, PRECISION);
            expect(n.y).toBeCloseTo(-1, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=180', () => {
            const n = Ellipsoid.sphere(1).getNormal(0, 180);

            expect(n.x).toBeCloseTo(-1, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=-180', () => {
            const n = Ellipsoid.sphere(1).getNormal(0, -180);

            expect(n.x).toBeCloseTo(-1, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });

        it('lat=0, lon=360', () => {
            const n = Ellipsoid.sphere(1).getNormal(0, 360);

            expect(n.x).toBeCloseTo(1, PRECISION);
            expect(n.y).toBeCloseTo(0, PRECISION);
            expect(n.z).toBeCloseTo(0, PRECISION);
        });
    });
});

describe('getExtentDimensions', () => {
    it('should throw if extent is not in WGS 84', () => {
        expect(() =>
            wgs84.getExtentDimensions(new Extent(CoordinateSystem.epsg3857, 0, 1, 0, 1)),
        ).toThrow(/not a WGS 84 extent/);
    });

    describe('trivial cases', () => {
        it('[-5°, 5°, -5°, 5°]', () => {
            const extent = new Extent(CoordinateSystem.epsg4326, -5, +5, -5, +5);
            const dims = wgs84.getExtentDimensions(extent);

            expect(dims.width).toEqual(wgs84.equatorialCircumference / 36);
            expect(dims.height).toEqual(wgs84.equatorialCircumference / 36);
        });

        it('[-1°, 1°, -1°, 1°]', () => {
            const extent = new Extent(CoordinateSystem.epsg4326, -1, +1, -1, +1);
            const dims = wgs84.getExtentDimensions(extent);

            expect(dims.width).toEqual(wgs84.equatorialCircumference / 180);
            expect(dims.height).toEqual(wgs84.equatorialCircumference / 180);
        });
    });
});

describe('isHorizonVisible', () => {
    describe('trivial cases', () => {
        it('point behind earth', () => {
            const cam = wgs84.toCartesian(0, 0, 100_000_000);
            const point = wgs84.toCartesian(0, 180, 100_000_000);

            expect(wgs84.isHorizonVisible(cam, point)).toEqual(false);
        });

        it('point on earth in front of camera', () => {
            const cam = wgs84.toCartesian(0, 0, 100_000_000);
            const point = wgs84.toCartesian(0, 0, 0);

            expect(wgs84.isHorizonVisible(cam, point)).toEqual(true);
        });

        it('point on earth anywhere on the visible side of the earth', () => {
            const cam = wgs84.toCartesian(0, 0, 100_000_000);

            for (let i = 0; i < 10000; i++) {
                const lat = MathUtils.randFloat(-75, +75);
                const lon = MathUtils.randFloat(-75, +75);

                const point = wgs84.toCartesian(lat, lon, 0);

                expect(wgs84.isHorizonVisible(cam, point)).toEqual(true);
            }
        });

        it('point on earth anywhere on the hidden side of the earth', () => {
            const cam = wgs84.toCartesian(0, 0, 100_000_000);

            for (let i = 0; i < 10000; i++) {
                const lat = MathUtils.randFloat(-89.9, +89.9);
                const lon = MathUtils.randFloat(90.01, 180) * Math.sign(Math.random() - 0.5);

                const point = wgs84.toCartesian(lat, lon, 0);

                expect(wgs84.isHorizonVisible(cam, point)).toEqual(false);
            }
        });
    });
});

describe('getMeridianArcLength', () => {
    describe('trivial cases', () => {
        it('0° - 90°', () => {
            const arc = wgs84.getMeridianArcLength(0, 90);
            expect(arc).toEqual(wgs84.equatorialCircumference / 4);
        });

        it('0° - 1', () => {
            const arc = wgs84.getMeridianArcLength(0, 1);
            expect(arc).toEqual(wgs84.equatorialCircumference / 360);
        });
    });
});

describe('getParallelArcLength', () => {
    describe('trivial cases', () => {
        it('equator, 180°', () => {
            const arc = wgs84.getParallelArcLength(0, 180);
            expect(arc).toEqual(wgs84.equatorialCircumference / 2);
        });

        it('equator, 90°', () => {
            const arc = wgs84.getParallelArcLength(0, 90);
            expect(arc).toEqual(wgs84.equatorialCircumference / 4);
        });

        it('equator, 1°', () => {
            const arc = wgs84.getParallelArcLength(0, 1);
            expect(arc).toEqual(wgs84.equatorialCircumference / 360);
        });

        it('north pole, 180°', () => {
            const arc = wgs84.getParallelArcLength(+90, 180);
            expect(arc).toBeCloseTo(0, PRECISION);
        });

        it('south pole, 180°', () => {
            const arc = wgs84.getParallelArcLength(-90, 180);
            expect(arc).toBeCloseTo(0, PRECISION);
        });
    });
});
