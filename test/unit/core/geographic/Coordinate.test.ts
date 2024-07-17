import * as proj4 from 'proj4';
import { Vector2, Vector3 } from 'three';
import Coordinates from 'src/core/geographic/Coordinates';

// Define projection that we will use (taken from https://epsg.io/3946, Proj4js section)
proj4.defs(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

describe('Coordinates', () => {
    describe('constructor', () => {
        it('should throw on unrecognized CRS', () => {
            expect(() => new Coordinates('foo', 0, 1, 2)).toThrow();
        });

        it('should assign property crs', () => {
            const c = new Coordinates('EPSG:3857', 0, 1, 2);

            expect(c.crs).toEqual('EPSG:3857');
        });

        it('should support coordinates from a 2-number array', () => {
            const c = new Coordinates('EPSG:3857', 8, 9);

            expect(c.x).toEqual(8);
            expect(c.y).toEqual(9);
            expect(c.z).toEqual(0);
        });

        it('should support coordinates from a 3-number array', () => {
            const c = new Coordinates('EPSG:3857', 0, 1, 2);

            expect(c.x).toEqual(0);
            expect(c.y).toEqual(1);
            expect(c.z).toEqual(2);
        });

        it('should support coordinates from Vector3', () => {
            const c = new Coordinates('EPSG:3857', new Vector3(0, 1, 2));

            expect(c.x).toEqual(0);
            expect(c.y).toEqual(1);
            expect(c.z).toEqual(2);
        });
    });

    describe('copy()', () => {
        it('should copy the values', () => {
            const original = new Coordinates('EPSG:3857', 2, 3, 4);
            const copy = new Coordinates('EPSG:4326', 0, 0, 0);
            const returned = copy.copy(original);

            expect(copy.values).toStrictEqual(original.values);
            expect(copy.crs).toEqual(original.crs);
            expect(returned).toBe(copy);
        });
    });

    describe('set()', () => {
        it('should throw on unrecognized CRS', () => {
            const c = new Coordinates('EPSG:4326', 0, 1, 2);

            expect(() => c.set('foo', 0, 1, 2)).toThrow();
        });

        it('should assign property crs', () => {
            const c = new Coordinates('EPSG:4326', 0, 1, 2);

            c.set('EPSG:3857', 0, 0, 0);

            expect(c.crs).toEqual('EPSG:3857');
        });

        it('should support coordinates from a 2-number array', () => {
            const c = new Coordinates('EPSG:3857', 1, 1, 1);

            c.set('EPSG:3857', 9, 5);

            expect(c.x).toEqual(9);
            expect(c.y).toEqual(5);
            expect(c.z).toEqual(0);
        });

        it('should support coordinates from a 3-number array', () => {
            const c = new Coordinates('EPSG:3857', 0, 0, 0);

            c.set('EPSG:3857', 1, 2, 3);

            expect(c.x).toEqual(1);
            expect(c.y).toEqual(2);
            expect(c.z).toEqual(3);
        });

        it('should support coordinates from Vector3', () => {
            const c = new Coordinates('EPSG:3857', 0, 0, 0);

            c.set('EPSG:3857', new Vector3(1, 2, 3));
            expect(c.x).toEqual(1);
            expect(c.y).toEqual(2);
            expect(c.z).toEqual(3);
        });
    });

    describe('clone', () => {
        it('should return the correct value', () => {
            const c0 = new Coordinates('EPSG:3857', 1, 2, 3);
            const c1 = c0.clone();

            expect(c0.x).toEqual(c0.x);
            expect(c1.y).toEqual(c0.y);
            expect(c1.z).toEqual(c0.z);
        });
    });

    describe('x, y, z', () => {
        it('should return the correct values', () => {
            const c = new Coordinates('EPSG:3857', 1, 2, 3);

            expect(c.x).toEqual(1);
            expect(c.y).toEqual(2);
            expect(c.z).toEqual(3);
        });

        it('should throw if the CRS is geographic', () => {
            const c = new Coordinates('EPSG:4326', 1, 2, 3);

            expect(() => c.x).toThrow();
            expect(() => c.y).toThrow();
            expect(() => c.z).toThrow();
        });
    });

    describe('toVector3()', () => {
        it('should return the x, y, z values', () => {
            const c = new Coordinates('EPSG:3857', 1, 2, 3);
            expect(c.toVector3()).toEqual({ x: 1, y: 2, z: 3 });
        });

        it('should honor the passed target the x, y, z values', () => {
            const c = new Coordinates('EPSG:3857', 1, 2, 3);
            const target = new Vector3(-1, -1, -1);
            expect(c.toVector3(target)).toEqual({ x: 1, y: 2, z: 3 });
            expect(c.toVector3(target)).toBe(target);
        });
    });

    describe('toVector2()', () => {
        it('should return the x, y values', () => {
            const c = new Coordinates('EPSG:3857', 1, 2, 3);
            expect(c.toVector2()).toEqual({ x: 1, y: 2 });
        });

        it('should honor the passed target the x, y values', () => {
            const c = new Coordinates('EPSG:3857', 1, 2, 3);
            const target = new Vector2(-1, -1);
            expect(c.toVector2(target)).toEqual({ x: 1, y: 2 });
            expect(c.toVector2(target)).toBe(target);
        });
    });

    describe('isGeographic()', () => {
        it('should return true for EPSG:4326', () => {
            expect(new Coordinates('EPSG:4326', 0, 0, 0).isGeographic()).toBeTruthy();
        });

        it('should return true for EPSG:4979', () => {
            expect(new Coordinates('EPSG:4326', 0, 0, 0).isGeographic()).toBeTruthy();
        });

        it('should return false for EPSG:3857', () => {
            expect(new Coordinates('EPSG:3857', 0, 0, 0).isGeographic()).toBeFalsy();
        });
    });

    describe('as()', () => {
        // This case happend in Giro3D when we convert the tile extent (4326) to a target WFS server
        // (EPSG:3946 for example) to request Lyon bus line in WFS.
        it('should correctly convert from EPSG:4326 (tiles extent) to EPSG:3946 (Lyon WFS) and back to EPSG:4326 (degrees)', () => {
            // geographic example for EPSG 4326 in degrees
            const longIn = 4.82212;
            const latIn = 45.723722;
            // let's define an input coordinate EPSG:4326.
            const coord1 = new Coordinates('EPSG:4326', longIn, latIn);
            // convert coordinate in EPSG:3946
            const coord2 = coord1.as('EPSG:3946');
            // verify intermediate values
            expect(coord2.x).toBeCloseTo(1841825.45, 2);
            expect(coord2.y).toBeCloseTo(5170916.93, 2);
            // and convert back to EPSG:4626 standard in degree.
            const coord3 = coord2.as('EPSG:4326');
            // verify coordinates
            expect(coord3.longitude).toBeCloseTo(longIn, 5);
            expect(coord3.latitude).toBeCloseTo(latIn, 5);
        });
    });

    describe('geodesicNormal', () => {
        it('should correctly return the default up vector for planar mode ', () => {
            const coord0 = new Coordinates('EPSG:3946', 15.0, 12.0);

            const normal0 = coord0.geodesicNormal;

            expect(normal0.x).toEqual(0);
            expect(normal0.y).toEqual(0);
            expect(normal0.z).toEqual(1);
        });
    });
});
