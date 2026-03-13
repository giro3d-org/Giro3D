/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { MathUtils, Vector2, type Vector2Like, Vector3, type Vector3Like } from 'three';

import CoordinateSystem from './CoordinateSystem';
import { getConverter } from './ProjectionCache';

proj4.defs('EPSG:4978', '+proj=geocent +datum=WGS84 +units=m +no_defs +type=crs');
proj4.defs('EPSG:4979', '+proj=longlat +datum=WGS84 +no_defs +type=crs');
// Note this is exactly the same definition as EPSG:4326. However, for clarity
// in the context of panoramic images, we use a name that is not associated with
// georeferencing since the image itself is not georeferenced in the world in the
// same way as an orthoimage, but simply positioned in the environment of the panorama.
proj4.defs('equirectangular', '+proj=longlat +datum=WGS84 +no_defs +type=crs');
register(proj4);

/**
 * A geographic coordinate expressed in degrees, minutes, seconds.
 */
export interface DMS {
    degrees: number;
    minutes?: number;
    seconds?: number;
}

export function parseDMS(dms: DMS): number {
    const { degrees, minutes, seconds } = dms;

    const result = degrees + (minutes ?? 0) / 60 + (seconds ?? 0) / 3600;

    return result;
}

function assertIsGeographic(crs: CoordinateSystem): void {
    if (!crs.isGeographic()) {
        throw new Error('This operation is only permitted on geographic coordinates.');
    }
}

function assertIsNotGeographic(crs: CoordinateSystem): void {
    if (crs.isGeographic()) {
        throw new Error('This operation is only permitted on non-geographic coordinates.');
    }
}

/**
 * Represents coordinates associated with a {@link CoordinateSystem | coordinate reference system (CRS)}.
 * The exact semantics of the values in the coordinates depend on the kind of CRS used:
 * - for projected systems, X is the easting, Y is the northing and Z is the elevation above/below
 *   the map plane.
 * - for geocentric systems (such as ECEF), XYZ are cartesian coordinates in the 3D frame.
 * - for geographic systems (such as  EPSG:4326), X is the longitude, Y is the latitude and Z is the
 *   elevation above/below the reference ellipsoid.
 */
class Coordinates {
    public readonly isCoordinates = true as const;
    private readonly _values: Float64Array;
    public crs: CoordinateSystem;

    /**
     * Create coordinates from a pair of XY coordinates.
     * @param crs - The coordinate system to use.
     * @param x - The X coordinate.
     * @param y - The Y coordinate.
     * @example
     * const x = 124225;
     * const y = 10244.2;
     * const mercator = new Coordinates(CoordinateSystem.epsg3857, x, y);
     *
     * // If using geographic coordinates, X is the longitude and Y is the latitude.
     * const lon = 4.2123;
     * const lat = 43.256;
     * const geo = new Coordinates(CoordinateSystem.epsg4326, lon, lat);
     */
    public constructor(crs: CoordinateSystem, x: number, y: number);
    /**
     * Create coordinates from a XYZ triplet.
     * @param crs - The coordinate system to use.
     * @param x - The X coordinate.
     * @param y - The Y coordinate.
     * @param z - The Z coordinate.
     * @example
     * const x = 124225;
     * const y = 10244.2;
     * const z = 1000;
     * const mercator = new Coordinates(CoordinateSystem.epsg3857, x, y, z);
     *
     * // If using geographic coordinates, X is the longitude and Y is the latitude.
     * // Z is still the elevation in meters.
     * const lon = 4.2123;
     * const lat = 43.256;
     * const geo = new Coordinates(CoordinateSystem.epsg4326, lon, lat, z);
     */
    public constructor(crs: CoordinateSystem, x: number, y: number, z: number);
    /**
     * Create coordinates from a {@link Vector2Like}
     * @param crs - The coordinate system to use.
     * @param xy - The vector to initialize coordinates.
     * @example
     * const coord = new Coordinates(CoordinateSystem.epsg3857, new THREE.Vector2(1020, 20924));
     * // Alternatively, you don't have to use an actual Vector2 instance.
     * // Any object that matches the Vector2Like interface will do.
     * const coord = new Coordinates(CoordinateSystem.epsg3857, \{ x: 1020, y: 20924 \});
     */
    public constructor(crs: CoordinateSystem, xy: Vector2Like);
    /**
     * Create coordinates from a {@link Vector3Like}
     * @param crs - The coordinate system to use.
     * @param xyz - The vector to initialize coordinates.
     * @example
     * const coord = new Coordinates(CoordinateSystem.epsg3857, new THREE.Vector3(1020, 20924, 1000));
     * // Alternatively, you don't have to use an actual Vector3 instance.
     * // Any object that matches the Vector3Like interface will do.
     * const coord = new Coordinates(CoordinateSystem.epsg3857, \{ x: 1020, y: 20924, z: 1000 \});
     */
    public constructor(crs: CoordinateSystem, xyz: Vector3Like);

    public constructor(
        crs: CoordinateSystem,
        x: number | Vector2Like | Vector3Like,
        y?: number,
        z?: number,
    ) {
        this._values = new Float64Array(3);
        this.crs = crs;
        // @ts-expect-error type shenanigans
        this.set(crs, x, y, z);
    }

    public get values(): Float64Array {
        return this._values;
    }

    /**
     * Sets the values in this coordinate from a XY pair.
     * @param crs - The coordinate system to use.
     * @param x - The X coordinate.
     * @param y - The Y coordinate.
     */
    public set(crs: CoordinateSystem, x: number, y: number): this;
    /**
     * Sets the values in this coordinate from a XYZ triplet.
     * @param crs - The coordinate system to use.
     * @param x - The X coordinate.
     * @param y - The Y coordinate.
     * @param z - The Z coordinate.
     */
    public set(crs: CoordinateSystem, x: number, y: number, z: number): this;
    /**
     * Sets the values in this coordinate from a {@link Vector2Like}
     * @param crs - The coordinate system to use.
     * @param vector - The vector to initialize coordinates.
     */
    public set(crs: CoordinateSystem, xy: Vector2Like): this;
    /**
     * Sets the values in this coordinate from a {@link Vector3Like}
     * @param crs - The coordinate system to use.
     * @param vector - The vector to initialize coordinates.
     */
    public set(crs: CoordinateSystem, xyz: Vector3Like): this;
    public set(
        crs: CoordinateSystem,
        x: number | Vector2Like | Vector3Like,
        y?: number,
        z?: number,
    ): this {
        this.crs = crs;

        if (typeof x === 'object') {
            const c = x as Vector2Like | Vector3Like;
            this._values[0] = c.x;
            this._values[1] = c.y;
            this._values[2] = 'z' in c ? c.z : 0;
        } else {
            this._values[0] = x;
            this._values[1] = y ?? 0;
            this._values[2] = z ?? 0;
        }

        return this;
    }

    public clone(target?: Coordinates): Coordinates {
        let r;
        if (target) {
            target.set(this.crs, this.x, this.y, this.z);
            r = target;
        } else {
            r = new Coordinates(this.crs, this._values[0], this._values[1], this._values[2]);
        }
        return r;
    }

    public copy(src: Coordinates): this {
        const v = src._values;
        this.set(src.crs, v[0], v[1], v[2]);
        return this;
    }

    /**
     * Returns the longitude in geographic coordinates.
     * Coordinates must be in geographic system (can be
     * converted by using {@link as} ).
     *
     * ```js
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * const coordinates = new Coordinates(
     *   'EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic
     * coordinates.longitude; // Longitude in geographic system
     * // returns 2.33
     *
     * // or
     *
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * // Geocentric system
     * const coords = new Coordinates(CoordinateSystem.epsg4978, position.x, position.y, position.z);
     * const coordinates = coords.as(CoordinateSystem.epsg4326);  // Geographic system
     * coordinates.longitude; // Longitude in geographic system
     * // returns 2.330201911389028
     * ```
     * @returns The longitude of the position.
     */
    public get longitude(): number {
        assertIsGeographic(this.crs);
        return this._values[0];
    }

    /**
     * Returns the latitude in geographic coordinates.
     * Coordinates must be in geographic system (can be converted by using {@link as}).
     *
     * ```js
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * const coordinates = new Coordinates(
     *     'EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic
     * coordinates.latitude; // Latitude in geographic system
     * // returns : 48.24
     *
     * // or
     *
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * // Geocentric system
     * const coords = new Coordinates(CoordinateSystem.epsg4978, position.x, position.y, position.z);
     * const coordinates = coords.as(CoordinateSystem.epsg4326);  // Geographic system
     * coordinates.latitude; // Latitude in geographic system
     * // returns : 48.24830764643365
     * ```
     * @returns The latitude of the position.
     */
    public get latitude(): number {
        assertIsGeographic(this.crs);
        return this._values[1];
    }

    /**
     * Returns the altitude in geographic coordinates.
     * Coordinates must be in geographic system (can be converted by using {@link as}).
     *
     * ```js
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * // Geographic system
     * const coordinates =
     *      new Coordinates(CoordinateSystem.epsg4326, position.longitude, position.latitude, position.altitude);
     * coordinates.altitude; // Altitude in geographic system
     * // returns : 24999549
     *
     * // or
     *
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * // Geocentric system
     * const coords = new Coordinates(CoordinateSystem.epsg4978, position.x, position.y, position.z);
     * const coordinates = coords.as(CoordinateSystem.epsg4326);  // Geographic system
     * coordinates.altitude; // Altitude in geographic system
     * // returns : 24999548.046711832
     * ```
     * @returns The altitude of the position.
     */
    public get altitude(): number {
        assertIsGeographic(this.crs);
        return this._values[2];
    }

    /**
     * Set the altitude.
     *
     * @param altitude - the new altitude.
     * ```js
     * coordinates.setAltitude(10000)
     * ```
     */
    public setAltitude(altitude: number): void {
        assertIsGeographic(this.crs);
        this._values[2] = altitude;
    }

    public withLongitude(longitude: number | DMS): this {
        assertIsGeographic(this.crs);

        if (typeof longitude === 'number') {
            this._values[0] = longitude;
        } else {
            this._values[0] = parseDMS(longitude);
        }

        return this;
    }

    public withLatitude(latitude: number | DMS): this {
        assertIsGeographic(this.crs);

        if (typeof latitude === 'number') {
            this._values[1] = latitude;
        } else {
            this._values[1] = parseDMS(latitude);
        }

        return this;
    }

    public withCRS(crs: CoordinateSystem): this {
        this.crs = crs;
        return this;
    }

    public withAltitude(altitude: number): this {
        assertIsGeographic(this.crs);

        this._values[2] = altitude;

        return this;
    }

    /**
     * Returns the `x` component of this coordinate in geocentric coordinates.
     * Coordinates must be in geocentric system (can be
     * converted by using {@link as}).
     *
     * ```js
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * const coordinates = new Coordinates(CoordinateSystem.epsg4978, position.x, position.y, position.z);
     * coordinates.x;  // Geocentric system
     * // returns : 20885167
     *
     * // or
     *
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * // Geographic system
     * const coords =
     *     new Coordinates(CoordinateSystem.epsg4326, position.longitude, position.latitude, position.altitude);
     * const coordinates = coords.as(CoordinateSystem.epsg4978); // Geocentric system
     * coordinates.x; // Geocentric system
     * // returns : 20888561.0301258
     * ```
     * @returns The `x` component of the position.
     */
    public get x(): number {
        assertIsNotGeographic(this.crs);
        return this._values[0];
    }

    /**
     * Returns the `y` component of this coordinate in geocentric coordinates.
     * Coordinates must be in geocentric system (can be
     * converted by using {@link as}).
     *
     * ```js
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * const coordinates = new Coordinates(CoordinateSystem.epsg4978, position.x, position.y, position.z);
     * coordinates.y;  // Geocentric system
     * // returns :  849862
     * ```
     * @returns The `y` component of the position.
     */
    public get y(): number {
        assertIsNotGeographic(this.crs);
        return this._values[1];
    }

    /**
     * Returns the `z` component of this coordinate in geocentric coordinates.
     * Coordinates must be in geocentric system (can be
     * converted by using {@link as}).
     *
     * ```js
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * const coordinates = new Coordinates(CoordinateSystem.epsg4978, position.x, position.y, position.z);
     * coordinates.z;  // Geocentric system
     * // returns :  23385912
     * ```
     * @returns The `z` component of the position.
     */
    public get z(): number {
        assertIsNotGeographic(this.crs);
        return this._values[2];
    }

    /**
     * Returns the equivalent `Vector3` of this coordinate.
     *
     * ```js
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * // Geocentric system
     * const coordinates = new Coordinates(CoordinateSystem.epsg4978, position.x, position.y, position.z);
     * coordinates.toVector3();
     * // returns : Vector3
     * // x: 20885167
     * // y: 849862
     * // z: 23385912
     *
     * // or
     *
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * // Geographic system
     * const coordinates =
     *      new Coordinates(CoordinateSystem.epsg4326, position.longitude, position.latitude, position.altitude);
     * coordinates.toVector3();
     * // returns : Vector3
     * // x: 2.33
     * // y: 48.24
     * // z: 24999549
     * ```
     * @param target - the geocentric coordinate
     * @returns target position
     */
    public toVector3(target?: Vector3): Vector3 {
        const v = target || new Vector3();
        v.fromArray(this._values);
        return v;
    }

    /**
     * Returns the equivalent `Vector2` of this coordinate. Note that the Z component (elevation) is
     * lost.
     *
     * ```js     *
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * // Metric system
     * const coordinates = new Coordinates(CoordinateSystem.epsg3857, position.x, position.y, position.z);
     * coordinates.toVector2();
     * // returns : Vector2
     * // x: 20885167
     * // y: 849862
     *
     * // or
     *
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * // Geographic system
     * const coordinates =
     *      new Coordinates(CoordinateSystem.epsg4326, position.longitude, position.latitude, position.altitude);
     * coordinates.toVector2();
     * // returns : Vector2
     * // x: 2.33
     * // y: 48.24
     * ```
     * @param target - the geocentric coordinate
     * @returns target position
     */
    public toVector2(target?: Vector2): Vector2 {
        const v = target || new Vector2();
        v.fromArray(this._values);
        return v;
    }

    /**
     * Converts coordinates in another [CRS](http://inspire.ec.europa.eu/theme/rs).
     *
     * If target is not specified, creates a new instance.
     * The original instance is never modified (except if you passed it as `target`).
     *
     * ```js
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * // Geographic system
     * const coords =
     *     new Coordinates(CoordinateSystem.epsg4326, position.longitude, position.latitude, position.altitude);
     * const coordinates = coords.as(CoordinateSystem.epsg4978); // Geocentric system
     * ```
     * @param crs - the [CRS](http://inspire.ec.europa.eu/theme/rs) EPSG string
     * @param target - the object that is returned
     * @returns the converted coordinate
     */
    public as(crs: CoordinateSystem, target?: Coordinates): Coordinates {
        return this.convert(crs, target);
    }

    // Only support explicit conversions
    private convert(newCrs: CoordinateSystem, target?: Coordinates): Coordinates {
        target = target || new Coordinates(newCrs, 0, 0, 0);
        if (newCrs.id === this.crs.id) {
            return target.copy(this);
        }
        if (this.crs.id in proj4.defs && newCrs.id in proj4.defs) {
            const val0 = this._values[0];
            let val1 = this._values[1];
            const crsIn = this.crs;

            // there is a bug for converting anything from and to 4978 with proj4
            // https://github.com/proj4js/proj4js/issues/195
            // the workaround is to use an intermediate projection, like EPSG:4326
            if (crsIn.isEpsg(4326) && newCrs.isEpsg(3857)) {
                val1 = MathUtils.clamp(val1, -89.999999, 89.999999);
                const p = getConverter(crsIn, newCrs).forward([val0, val1]);
                return target.set(newCrs, p[0], p[1], this._values[2]);
            }
            // here is the normal case with proj4
            const p = getConverter(crsIn, newCrs).forward([val0, val1]);
            return target.set(newCrs, p[0], p[1], this._values[2]);
        }

        throw new Error(`Cannot convert from crs ${this.crs.id} to ${newCrs.id}`);
    }

    /**
     * Returns the boolean result of the check if this coordinate is geographic (true)
     * or geocentric (false).
     *
     * ```js
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * const coordinates = new Coordinates(CoordinateSystem.epsg4978, position.x, position.y, position.z);
     * coordinates.isGeographic();  // Geocentric system
     * // returns :  false
     * ```
     * @returns `true` if the coordinate is geographic.
     */
    public isGeographic(): boolean {
        return this.crs.isGeographic();
    }

    /**
     * Creates a geographic coordinate in EPSG:4326
     */
    public static WGS84(
        latitude: number | DMS,
        longitude: number | DMS,
        altitude?: number,
    ): Coordinates {
        return new Coordinates(CoordinateSystem.epsg4326, 0, 0)
            .withLatitude(latitude)
            .withLongitude(longitude)
            .withAltitude(altitude ?? 0);
    }
}

export function isCoordinates(obj: unknown): obj is Coordinates {
    return (obj as Coordinates).isCoordinates === true;
}

export default Coordinates;
