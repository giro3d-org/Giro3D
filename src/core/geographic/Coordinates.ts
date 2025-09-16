/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { MathUtils, Vector2, Vector3 } from 'three';
import { isVector3 } from '../../utils/predicates';
import { getConverter } from './ProjectionCache';
import CoordinateSystem from './coordinate-system/CoordinateSystem';

proj4.defs('EPSG:4978', '+proj=geocent +datum=WGS84 +units=m +no_defs +type=crs');
proj4.defs('EPSG:4979', '+proj=longlat +datum=WGS84 +no_defs +type=crs');
// Note this is exactly the same definition as EPSG:4326. However, for clarity
// in the context of panoramic images, we use a name that is not associated with
// georeferencing since the image itself is not georeferenced in the world in the
// same way as an orthoimage, but simply positioned in the environment of the panorama.
proj4.defs('equirectangular', '+proj=longlat +datum=WGS84 +no_defs +type=crs');
register(proj4);

export const UNIT = {
    DEGREE: 1,
    METER: 2,
    FOOT: 3,
};

/**
 * A geographic coordinate expressed in degrees, minutes, seconds.
 */
export type DMS = {
    degrees: number;
    minutes?: number;
    seconds?: number;
};

export function parseDMS(dms: DMS): number {
    const { degrees, minutes, seconds } = dms;

    const result = degrees + (minutes ?? 0) / 60 + (seconds ?? 0) / 3600;

    return result;
}

/**
 * Returns the enum value of the specified unit of measure
 *
 * @param projunit - - the proj4 UoM string
 * @returns the unit of measure (see `UNIT`)
 */
function unitFromProj4Unit(projunit: string | undefined) {
    switch (projunit) {
        case 'deg':
        case 'degrees':
        case 'degree':
            return UNIT.DEGREE;
        case 'm':
        case 'meter':
        case 'meters':
            return UNIT.METER;
        case 'ft':
        case 'foot':
        case 'feet':
            return UNIT.FOOT;
        default:
            return undefined;
    }
}

/**
 * Returns the horizontal unit of measure (UoM) of the specified CRS
 *
 * @param crs - the CRS to test
 * @returns the unit of measure (see `UNIT`)
 */
export function crsToUnit(crs: CoordinateSystem) {
    if (crs.isEpsg(4326) || crs.isEpsg(4979) || crs.isEquirectangular()) {
        return UNIT.DEGREE;
    }

    if (crs.isEpsg(4978)) {
        return UNIT.METER;
    }

    const p = proj4.defs(crs.id);
    if (p == null) {
        return undefined;
    }
    return unitFromProj4Unit(p.units);
}

function crsToUnitWithError(crs: CoordinateSystem) {
    const u = crsToUnit(crs);
    if (crs === undefined || u === undefined) {
        throw new Error(`Invalid crs parameter value '${crs.id}'`);
    }
    return u;
}

export function assertCrsIsValid(crs: CoordinateSystem) {
    if (proj4.defs(crs.id) == null) {
        throw new Error(`Invalid crs parameter value '${crs.id}'. Did you define it with proj4?`);
    }
}

/**
 * Tests whether the CRS is in geographic coordinates.
 *
 * @param crs - the CRS to test
 * @returns `true` if the CRS is in geographic coordinates.
 */
export function crsIsGeographic(crs: CoordinateSystem) {
    return crsToUnitWithError(crs) !== UNIT.METER;
}

/**
 * Tests whether the CRS is in geocentric coordinates.
 *
 * @param crs - the CRS to test
 * @returns `true` if the CRS is in geocentric coordinates.
 */
export function crsIsGeocentric(crs: CoordinateSystem) {
    return crsToUnitWithError(crs) === UNIT.METER;
}

function assertIsGeographic(crs: CoordinateSystem) {
    if (!crsIsGeographic(crs)) {
        throw new Error(`Can't query crs ${crs.id} long/lat`);
    }
}

function assertIsGeocentric(crs: CoordinateSystem) {
    if (!crsIsGeocentric(crs)) {
        throw new Error(`Can't query crs ${crs.id} x/y/z`);
    }
}

const planarNormal = new Vector3(0, 0, 1);

/**
 * Possible values to set a `Coordinates` object.
 *
 * It can be:
 * - A pair of numbers for 2D coordinates [X, Y]
 * - A triplet of numbers for 3D coordinates [X, Y, Z]
 * - A THREE `Vector3`
 *
 * @example
 * new Coordinates(CoordinateSystem.epsg4978, 20885167, 849862, 23385912); //Geocentric coordinates
 * // or
 * new Coordinates(CoordinateSystem.epsg4978, new Vector3(20885167, 849862, 23385912)) // Same with a vector.
 * // or
 * new Coordinates(CoordinateSystem.epsg4326, 2.33, 48.24, 24999549); //Geographic coordinates
 */
export type CoordinateParameters = [number, number] | [number, number, number] | [Vector3];

/**
 * Represents coordinates associated with a coordinate reference system (CRS).
 */
class Coordinates {
    readonly isCoordinates = true as const;
    private readonly _values: Float64Array;
    crs: CoordinateSystem;

    /**
     * Build a {@link Coordinates} object, given a [CRS](http://inspire.ec.europa.eu/theme/rs) and a number of coordinates value.
     * Coordinates can be geocentric, geographic, or an instance of [Vector3](https://threejs.org/docs/#api/math/Vector3).
     * - If `crs` is `'EPSG:4326'`, coordinates must be in [geographic system](https://en.wikipedia.org/wiki/Geographic_coordinate_system).
     * - If `crs` is `'EPSG:4978'`, coordinates must be in [geocentric system](https://en.wikipedia.org/wiki/Earth-centered,_Earth-fixed_coordinate_system).
     *
     * @param crs - Geographic or Geocentric coordinates system.
     * @param coordinates - The coordinates.
     */
    constructor(crs: CoordinateSystem, ...coordinates: CoordinateParameters) {
        this._values = new Float64Array(3);
        this.crs = crs;
        this.set(crs, ...coordinates);
    }

    get values() {
        return this._values;
    }

    /**
     * Returns the normal vector associated with this coordinate.
     *
     * @returns The normal vector.
     */

    get geodesicNormal() {
        return planarNormal;
    }

    set(crs: CoordinateSystem, ...coordinates: CoordinateParameters) {
        crsToUnitWithError(crs);
        this.crs = crs;

        if (coordinates.length === 1 && isVector3(coordinates[0])) {
            this._values[0] = coordinates[0].x;
            this._values[1] = coordinates[0].y;
            this._values[2] = coordinates[0].z;
        } else {
            for (let i = 0; i < coordinates.length && i < 3; i++) {
                this._values[i] = coordinates[i] as number;
            }
            for (let i = coordinates.length; i < 3; i++) {
                this._values[i] = 0;
            }
        }
        return this;
    }

    clone(target?: Coordinates) {
        let r;
        if (target) {
            Coordinates.call(target, this.crs, this._values[0], this._values[1], this._values[2]);
            r = target;
        } else {
            r = new Coordinates(this.crs, this._values[0], this._values[1], this._values[2]);
        }
        return r;
    }

    copy(src: Coordinates) {
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
    get longitude() {
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
    get latitude() {
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
    get altitude() {
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
    setAltitude(altitude: number) {
        assertIsGeographic(this.crs);
        this._values[2] = altitude;
    }

    withLongitude(longitude: number | DMS): this {
        assertIsGeographic(this.crs);

        if (typeof longitude === 'number') {
            this._values[0] = longitude;
        } else {
            this._values[0] = parseDMS(longitude);
        }

        return this;
    }

    withLatitude(latitude: number | DMS): this {
        assertIsGeographic(this.crs);

        if (typeof latitude === 'number') {
            this._values[1] = latitude;
        } else {
            this._values[1] = parseDMS(latitude);
        }

        return this;
    }

    withCRS(crs: CoordinateSystem): this {
        this.crs = crs;
        return this;
    }

    withAltitude(altitude: number): this {
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
    get x() {
        assertIsGeocentric(this.crs);
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
    get y() {
        assertIsGeocentric(this.crs);
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
    get z() {
        assertIsGeocentric(this.crs);
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
    toVector3(target?: Vector3): Vector3 {
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
    toVector2(target?: Vector2): Vector2 {
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
    as(crs: CoordinateSystem, target?: Coordinates) {
        if (crsToUnit(crs) === undefined) {
            throw new Error(`Invalid crs paramater value '${crs.id}'`);
        }
        return this.convert(crs, target);
    }

    // Only support explicit conversions
    private convert(newCrs: CoordinateSystem, target?: Coordinates) {
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
    isGeographic() {
        return crsIsGeographic(this.crs);
    }

    /**
     * Creates a geographic coordinate in EPSG:4326
     */
    static WGS84(latitude: number | DMS, longitude: number | DMS, altitude?: number): Coordinates {
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
