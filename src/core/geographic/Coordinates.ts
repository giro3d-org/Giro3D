import { Vector3, MathUtils, Vector2 } from 'three';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

const projectionCache: Map<string, Map<string, proj4.Converter>> = new Map();

proj4.defs('EPSG:4978', '+proj=geocent +datum=WGS84 +units=m +no_defs +type=crs');
proj4.defs('EPSG:4979', '+proj=longlat +datum=WGS84 +no_defs +type=crs');
register(proj4);

export const UNIT = {
    DEGREE: 1,
    METER: 2,
};

/**
 * Returns the enum value of the specified unit of measure
 *
 * @param projunit - - the proj4 UoM string
 * @returns the unit of measure (see `UNIT`)
 */
function unitFromProj4Unit(projunit: string) {
    switch (projunit) {
        case 'deg':
        case 'degrees':
        case 'degree':
            return UNIT.DEGREE;
        case 'm':
        case 'meter':
        case 'meters':
            return UNIT.METER;
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
export function crsToUnit(crs: string) {
    switch (crs) {
        case 'EPSG:4326':
        case 'EPSG:4979':
            return UNIT.DEGREE;
        case 'EPSG:4978':
            return UNIT.METER;
        default: {
            const p = proj4.defs(crs);
            if (!p) {
                return undefined;
            }
            return unitFromProj4Unit(p.units);
        }
    }
}

function crsToUnitWithError(crs: string) {
    const u = crsToUnit(crs);
    if (crs === undefined || u === undefined) {
        throw new Error(`Invalid crs parameter value '${crs}'`);
    }
    return u;
}

export function assertCrsIsValid(crs: string) {
    if (!proj4.defs(crs)) {
        throw new Error(`Invalid crs parameter value '${crs}'. Did you define it with proj4?`);
    }
}

/**
 * Tests whether the CRS is in geographic coordinates.
 *
 * @param crs - the CRS to test
 * @returns `true` if the CRS is in geographic coordinates.
 */
export function crsIsGeographic(crs: string) {
    return crsToUnitWithError(crs) !== UNIT.METER;
}

/**
 * Tests whether the CRS is in geocentric coordinates.
 *
 * @param crs - the CRS to test
 * @returns `true` if the CRS is in geocentric coordinates.
 */
export function crsIsGeocentric(crs: string) {
    return crsToUnitWithError(crs) === UNIT.METER;
}

function assertIsGeographic(crs: string) {
    if (!crsIsGeographic(crs)) {
        throw new Error(`Can't query crs ${crs} long/lat`);
    }
}

function assertIsGeocentric(crs: string) {
    if (!crsIsGeocentric(crs)) {
        throw new Error(`Can't query crs ${crs} x/y/z`);
    }
}

function instanceProj4(crsIn: string, crsOut: string): proj4.Converter {
    if (projectionCache.has(crsIn)) {
        const p = projectionCache.get(crsIn);
        if (p.has(crsOut)) {
            return p.get(crsOut);
        }
    } else {
        projectionCache.set(crsIn, new Map());
    }
    const p = proj4(crsIn, crsOut);
    projectionCache.get(crsIn).set(crsOut, p);
    return p;
}

export function is4326(crs: string) {
    return crs.indexOf('EPSG:4326') === 0;
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
 * new Coordinates('EPSG:4978', 20885167, 849862, 23385912); //Geocentric coordinates
 * // or
 * new Coordinates('EPSG:4978', new Vector3(20885167, 849862, 23385912)) // Same with a vector.
 * // or
 * new Coordinates('EPSG:4326', 2.33, 48.24, 24999549); //Geographic coordinates
 */
export type CoordinateParameters = [number, number] | [number, number, number] | [Vector3];

/**
 * Represents coordinates associated with a coordinate reference system (CRS).
 */
class Coordinates {
    private readonly _values: Float64Array;
    private _normal: Vector3;
    crs: string;

    /**
     * Build a {@link Coordinates} object, given a [CRS](http://inspire.ec.europa.eu/theme/rs) and a number of coordinates value.
     * Coordinates can be geocentric, geographic, or an instance of [Vector3](https://threejs.org/docs/#api/math/Vector3).
     * - If `crs` is `'EPSG:4326'`, coordinates must be in [geographic system](https://en.wikipedia.org/wiki/Geographic_coordinate_system).
     * - If `crs` is `'EPSG:4978'`, coordinates must be in [geocentric system](https://en.wikipedia.org/wiki/Earth-centered,_Earth-fixed_coordinate_system).
     *
     * @param crs - Geographic or Geocentric coordinates system.
     * @param coordinates - The coordinates.
     */
    constructor(crs: string, ...coordinates: CoordinateParameters) {
        this._values = new Float64Array(3);
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
    // eslint-disable-next-line class-methods-use-this
    get geodesicNormal() {
        return planarNormal;
    }

    set(crs: string, ...coordinates: CoordinateParameters) {
        crsToUnitWithError(crs);
        this.crs = crs;

        if (coordinates.length === 1 && coordinates[0] instanceof Vector3) {
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
        this._normal = undefined;
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
        if (this._normal) {
            r._normal = this._normal.clone();
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
     * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);
     * const coordinates = coords.as('EPSG:4326');  // Geographic system
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
     * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);
     * const coordinates = coords.as('EPSG:4326');  // Geographic system
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
     *      new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude);
     * coordinates.altitude(); // Altitude in geographic system
     * // returns : 24999549
     *
     * // or
     *
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * // Geocentric system
     * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);
     * const coordinates = coords.as('EPSG:4326');  // Geographic system
     * coordinates.altitude(); // Altitude in geographic system
     * // returns : 24999548.046711832
     * ```
     * @returns The altitude of the position.
     */
    altitude() {
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

    /**
     * Returns the `x` component of this coordinate in geocentric coordinates.
     * Coordinates must be in geocentric system (can be
     * converted by using {@link as}).
     *
     * ```js
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);
     * coordinates.x;  // Geocentric system
     * // returns : 20885167
     *
     * // or
     *
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * // Geographic system
     * const coords =
     *     new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude);
     * const coordinates = coords.as('EPSG:4978'); // Geocentric system
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
     * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);
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
     * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);
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
     * Returns the equivalent `Vector3` of this coordinate. Coordinates must be in geocentric system
     * (can be converted by using {@link as}).
     *
     * ```js
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * // Geocentric system
     * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);
     * coordinates.toVector3();  // Geocentric system
     * // returns : Vector3
     * // x: 20885167
     * // y: 849862
     * // z: 23385912
     *
     * // or
     *
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * // Geographic system
     * const coords =
     *      new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude);
     * const coordinates = coords.as('EPSG:4978'); // Geocentric system
     * coordinates.toVector3(); // Geocentric system
     * // returns : Vector3
     * // x: 20885167
     * // y: 849862
     * // z: 23385912
     * ```
     * @param target - the geocentric coordinate
     * @returns target position
     */
    toVector3(target?: Vector3): Vector3 {
        assertIsGeocentric(this.crs);
        const v = target || new Vector3();
        v.fromArray(this._values);
        return v;
    }

    /**
     * Returns the equivalent `Vector2` of this coordinate. Coordinates must be in geocentric system
     * (can be converted by using {@link as}). Note that the Z component (elevation) is lost.
     *
     * ```js     *
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * // Geocentric system
     * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);
     * coordinates.toVector2();  // Geocentric system
     * // returns : Vector2
     * // x: 20885167
     * // y: 849862
     *
     * // or
     *
     * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
     * // Geographic system
     * const coords =
     *      new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude);
     * const coordinates = coords.as('EPSG:4978'); // Geocentric system
     * coordinates.toVector2(); // Geocentric system
     * // returns : Vector2
     * // x: 20885167
     * // y: 849862
     * ```
     * @param target - the geocentric coordinate
     * @returns target position
     */
    toVector2(target?: Vector2): Vector2 {
        assertIsGeocentric(this.crs);
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
     *     new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude);
     * const coordinates = coords.as('EPSG:4978'); // Geocentric system
     * ```
     * @param crs - the [CRS](http://inspire.ec.europa.eu/theme/rs) EPSG string
     * @param target - the object that is returned
     * @returns the converted coordinate
     */
    as(crs: string, target?: Coordinates) {
        if (crs === undefined || crsToUnit(crs) === undefined) {
            throw new Error(`Invalid crs paramater value '${crs}'`);
        }
        return this.convert(crs, target);
    }

    // Only support explicit conversions
    private convert(newCrs: string, target: Coordinates) {
        target = target || new Coordinates(newCrs, 0, 0, 0);
        if (newCrs === this.crs) {
            return target.copy(this);
        }
        if (this.crs in proj4.defs && newCrs in proj4.defs) {
            const val0 = this._values[0];
            let val1 = this._values[1];
            const crsIn = this.crs;

            // there is a bug for converting anything from and to 4978 with proj4
            // https://github.com/proj4js/proj4js/issues/195
            // the workaround is to use an intermediate projection, like EPSG:4326
            if (is4326(crsIn) && newCrs === 'EPSG:3857') {
                val1 = MathUtils.clamp(val1, -89.999999, 89.999999);
                const p = instanceProj4(crsIn, newCrs).forward([val0, val1]);
                return target.set(newCrs, p[0], p[1], this._values[2]);
            }
            // here is the normal case with proj4
            const p = instanceProj4(crsIn, newCrs).forward([val0, val1]);
            return target.set(newCrs, p[0], p[1], this._values[2]);
        }

        throw new Error(`Cannot convert from crs ${this.crs} to ${newCrs}`);
    }

    /**
     * Returns the boolean result of the check if this coordinate is geographic (true)
     * or geocentric (false).
     *
     * ```js
     * const position = { x: 20885167, y: 849862, z: 23385912 };
     * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);
     * coordinates.isGeographic();  // Geocentric system
     * // returns :  false
     * ```
     * @returns `true` if the coordinate is geographic.
     */
    isGeographic() {
        return crsIsGeographic(this.crs);
    }
}

export default Coordinates;
