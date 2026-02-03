/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MathUtils, Matrix4, Ray, Sphere, Vector2, Vector3 } from 'three';

import type Extent from './Extent';

import Coordinates from './Coordinates';
import CoordinateSystem from './CoordinateSystem';

const tmpCoord = new Coordinates(CoordinateSystem.epsg4326, 0, 0);
const tmpDims = new Vector2();
const tmpVec3 = new Vector3();
const tmpNormal = new Vector3();
const tmpSphere = new Sphere();
const tmpMatrix4 = new Matrix4();
const tmpRay = new Ray();
const tmpEast = new Vector3();
const tmpNorth = new Vector3();
const ZERO = new Vector3(0, 0, 0);
const tmpIntersection = new Vector3();

let wgs84: Ellipsoid | undefined;

const Z = new Vector3(0, 0, 1);

/**
 * A configurable spheroid that allows conversion from and to geodetic coordinates
 * and cartesian coordinates, as well as utility function to compute various geodetic values.
 */
export default class Ellipsoid {
    private readonly _semiMajor: number;
    private readonly _semiMinor: number;
    private readonly _sqEccentricity: number;
    private readonly _eccentricity: number;
    private readonly _equatorialCircumference;
    private readonly _invRadiiSquared: Vector3;
    private readonly _radii: Vector3;
    private readonly _flattening: number;

    public get semiMajorAxis(): number {
        return this._semiMajor;
    }

    public get semiMinorAxis(): number {
        return this._semiMinor;
    }

    /**
     * The [flattening](https://en.wikipedia.org/wiki/Flattening) of this ellipsoid.
     */
    public get flattening(): number {
        return this._flattening;
    }

    /**
     * The circumference at the equator.
     */
    public get equatorialCircumference(): number {
        return this._equatorialCircumference;
    }

    /**
     * The [eccentricity](https://en.wikipedia.org/wiki/Eccentricity_(mathematics)) of this ellipsoid.
     */
    public get eccentricity(): number {
        return this._eccentricity;
    }

    /**
     * The ratio between the semi-minor axis and the semi-major axis.
     */
    public get compressionFactor(): number {
        return this._semiMinor / this._semiMajor;
    }

    public constructor(params: { semiMajorAxis: number; semiMinorAxis: number }) {
        this._semiMajor = params.semiMajorAxis; // Semi-major axis
        this._semiMinor = params.semiMinorAxis; // Semi-minor axis
        const flattening = (this._semiMajor - this._semiMinor) / this._semiMajor; // Flattening
        this._sqEccentricity = Math.sqrt(1 - this._semiMinor ** 2 / this._semiMajor ** 2);
        this._eccentricity = Math.sqrt(2 * flattening - flattening * flattening);

        this._flattening = flattening;

        const a = this._semiMajor;
        const aa = (1 / a) ** 2;

        const b = this._semiMinor;
        const bb = (1 / b) ** 2;
        this._radii = new Vector3(a, a, b);
        this._invRadiiSquared = new Vector3(aa, aa, bb);

        this._equatorialCircumference = Math.PI * 2 * this._semiMajor;
    }

    /**
     * The [WGS 84](https://en.wikipedia.org/wiki/World_Geodetic_System#WGS84) ellipsoid.
     */
    public static get WGS84(): Ellipsoid {
        if (wgs84 == null) {
            wgs84 = new Ellipsoid({
                semiMajorAxis: 6_378_137.0,
                semiMinorAxis: 6_356_752.314245,
            });
        }
        return wgs84;
    }

    /**
     * A sphere.
     */
    public static sphere(radius: number): Ellipsoid {
        return new Ellipsoid({
            semiMinorAxis: radius,
            semiMajorAxis: radius,
        });
    }

    /**
     * Returns a new ellipsoid scaled by the specified factor.
     */
    public scale(factor: number): Ellipsoid {
        return new Ellipsoid({
            semiMajorAxis: this.semiMajorAxis * factor,
            semiMinorAxis: this.semiMinorAxis * factor,
        });
    }

    /**
     * Returns a new ellipsoid growed by the specified offset. The offset is added to the axes.
     */
    public grow(offset: number): Ellipsoid {
        return new Ellipsoid({
            semiMajorAxis: this.semiMajorAxis + offset,
            semiMinorAxis: this.semiMinorAxis + offset,
        });
    }

    /**
     * Converts the geodetic coordinates to cartesian coordinates in the ECEF coordinate system.
     * @param lat - The latitude, in degrees.
     * @param lon - The longitude, in degrees.
     * @param alt - The altitude, in meters, above or below the ellipsoid.
     * @param target - The target vector. If none, one will be created.
     * @returns The cartesian coordinates.
     */
    public toCartesian(lat: number, lon: number, alt: number, target?: Vector3): Vector3 {
        target = target ?? new Vector3();

        const clat = Math.cos(lat * MathUtils.DEG2RAD);
        const slat = Math.sin(lat * MathUtils.DEG2RAD);
        const clon = Math.cos(lon * MathUtils.DEG2RAD);
        const slon = Math.sin(lon * MathUtils.DEG2RAD);

        const N =
            this._semiMajor /
            Math.sqrt(1.0 - this._eccentricity * this._eccentricity * slat * slat);

        const x = (N + alt) * clat * clon;
        const y = (N + alt) * clat * slon;
        const z = (N * (1.0 - this._eccentricity * this._eccentricity) + alt) * slat;

        target.set(x, y, z);

        return target;
    }

    /**
     * Gets the ENU (east/north/up) matrix for the given location in geodetic coordinates.
     * @param lat - The latitude of the location.
     * @param lon - The longitude of the location.
     * @returns The ENU matrix.
     */
    public getEastNorthUpMatrix(lat: number, lon: number, target?: Matrix4): Matrix4 {
        const position = this.toCartesian(lat, lon, 0, tmpVec3);

        return this.getEastNorthUpMatrixFromCartesian(position, target);
    }

    /**
     * Gets the ENU (east/north/up) matrix for the given location.
     * @param point - The cartesian coordinate in the geocentric system of this ellipsoid.
     * @param target - The optional matrix to set with the ENU matrix.
     * @returns The ENU matrix.
     */
    public getEastNorthUpMatrixFromCartesian(point: Readonly<Vector3>, target?: Matrix4): Matrix4 {
        const normal = this.getNormalFromCartesian(point, tmpNormal);

        // Compute the ENU matrix from the normal and the Z axis.
        const u = normal;
        const e = tmpEast.crossVectors(Z, u).normalize();
        const n = tmpNorth.crossVectors(u, e).normalize();

        const result = target ?? new Matrix4();

        // prettier-ignore
        result.set(
            e.x, e.y, e.z, 0.0,
            n.x, n.y, n.z, 0.0,
            u.x, u.y, u.z, 0.0,
            0.0, 0.0, 0.0, 1.0
        ).transpose();

        return result;
    }

    /**
     * Returns the first intersection of the ray with the ellipsoid, or `null` if the ray does not intersect the ellipsoid.
     * @param ray - The ray to intersect.
     * @param target - The optional vector to store the result.
     * @returns The intersection or null if not intersection was found.
     */
    public intersectRay(ray: Ray, target?: Vector3): Vector3 | null {
        tmpMatrix4.makeScale(this._radii.x, this._radii.y, this._radii.z).invert();
        tmpSphere.center.set(0, 0, 0);
        tmpSphere.radius = 1;

        target = target ?? new Vector3();

        tmpRay.copy(ray).applyMatrix4(tmpMatrix4);

        if (tmpRay.intersectSphere(tmpSphere, target)) {
            tmpMatrix4.makeScale(this._radii.x, this._radii.y, this._radii.z);
            target.applyMatrix4(tmpMatrix4);
            return target;
        } else {
            return null;
        }
    }

    /**
     * Returns the normal of the spheroid for the given location.
     * @param lat - The latitude, in degrees.
     * @param lon - The longitude, in degrees.
     * @param target - The target vector to store the result. If none, one will be created.
     * @returns The normal vector.
     */
    public getNormal(lat: number, lon: number, target?: Vector3): Vector3 {
        const cartesian = this.toCartesian(lat, lon, 0, target);

        return cartesian.multiply(this._invRadiiSquared).normalize();
    }

    /**
     * Returns the normal of the spheroid for the given cartesian coordinate.
     * @param cartesian - The cartesian coordinates.
     * @param target - The target vector to store the result. If none, one will be created.
     * @returns The normal vector.
     */
    public getNormalFromCartesian(cartesian: Readonly<Vector3>, target?: Vector3): Vector3 {
        target = target ?? new Vector3();
        return target.copy(cartesian).multiply(this._invRadiiSquared).normalize();
    }

    /**
     * Converts the cartesian coordinates to geodetic coordinates.
     * @param x - The cartesian X coordinate.
     * @param y - The cartesian Y coordinate.
     * @param z - The cartesian Z coordinate.
     * @returns The geodetic coordinates.
     */
    public toGeodetic(x: number, y: number, z: number, target?: Coordinates): Coordinates {
        target = target ?? new Coordinates(CoordinateSystem.epsg4979, 0, 0, 0);
        const lon = Math.atan2(y, x);
        const p = Math.sqrt(x ** 2 + y ** 2);
        const theta = Math.atan2(z * this._semiMajor, p * this._semiMinor);
        const lat = Math.atan2(
            z + this._eccentricity ** 2 * this._semiMinor * Math.sin(theta) ** 3,
            p - this._sqEccentricity ** 2 * this._semiMajor * Math.cos(theta) ** 3,
        );

        // # Radius of curvature in the prime vertical
        const N = this._semiMajor / Math.sqrt(1 - this._sqEccentricity ** 2 * Math.sin(lat) ** 2);
        let height = p / Math.cos(lat) - N;

        const latitude = MathUtils.radToDeg(lat);
        const longitude = MathUtils.radToDeg(lon);

        // Special case : Math.cos(lat) would give zero for
        // coordinates on the poles, in turn giving wrong height values.
        if (Math.abs(Math.abs(latitude) - 90) < 0.0000001) {
            const radius = this._semiMinor;
            height = Math.abs(z) - radius;
        }

        target.set(CoordinateSystem.epsg4979, longitude, latitude, height);

        return target;
    }

    /**
     * Returns the length of the parallel arc of the given angle, in meters.
     * @param latitude - The latitude of the parallel.
     * @param angle - The angle of the arc in degrees.
     */
    public getParallelArcLength(latitude: number, angle: number): number {
        // Let's compute the radius of the parallel at this latitude
        const parallelRadius = this._semiMajor * Math.cos(latitude * MathUtils.DEG2RAD);
        const paralellCircumference = 2 * Math.PI * parallelRadius;

        return (angle / 360) * paralellCircumference;
    }

    /**
     * Returns an approximated length of the meridian arc of the given angle, in meters.
     *
     * Note: this function uses a very simplified method, as the actual method involves
     * intrgrals. For very oblate spheroids, the results will be wrong.
     *
     * @param latitude0 - The latitude of the start of the meridian arc
     * @param latitude1 - The latitude of the end of the meridian arc
     */
    public getMeridianArcLength(latitude0: number, latitude1: number): number {
        const angle = Math.abs(latitude0 - latitude1);
        return (angle / 360) * this._equatorialCircumference;
    }

    /**
     * Gets the dimensions (width and height) across the center of of the extent, in **meters**.
     *
     * Note: this is distinct to {@link Extent.dimensions} which returns the dimensions
     * in the extent's own CRS (meters or degrees).
     * @param extent - The extent.
     * @param target - The object to store the result. If none, one will be created.
     * @returns The extent dimensions.
     * @throws if the extent is not in the EPSG:4326 CRS.
     */
    public getExtentDimensions(extent: Extent, target?: Vector2): Vector2 {
        if (!extent.crs.isEpsg(4326)) {
            throw new Error('not a WGS 84 extent (EPSG:4326)');
        }

        const center = extent.center(tmpCoord);
        const dims = extent.dimensions(tmpDims);

        const width = this.getParallelArcLength(center.latitude, dims.width);
        const height = this.getMeridianArcLength(extent.north, extent.south);

        target = target ?? new Vector2();

        target.set(width, height);

        return target;
    }

    /**
     * Gets the distance to the horizon given a camera position.
     * @param cameraPosition - The camera position.
     * @param center - The center of the ellipsoid (by default (0, 0, 0)).
     * @returns The distance, in meters, from the camera to the horizon.
     */
    public getOpticalHorizon(cameraPosition: Vector3, center?: Vector3): number | null {
        center = center ?? ZERO;
        const ray = tmpRay.set(cameraPosition, center.clone().sub(cameraPosition));
        const intersection = this.intersectRay(ray, tmpIntersection);

        if (intersection == null) {
            return null;
        }

        const height = cameraPosition.distanceTo(intersection);
        const horizonDistance = Math.sqrt(height * (2 * this.semiMajorAxis + height));

        return horizonDistance;
    }

    /**
     * Determine whether the given point is visible from the camera or occluded by the horizon
     * of this ellipsoid.
     * @param cameraPosition - The camera position, in world space coordinates.
     * @param point - The point to test, in world space coordinates.
     * @param radiusFactor - An optional factor to apply to ellipsoid radii to add a margin of error.
     * @returns `true` if the given point is above the horizon, `false` otherwise.
     */
    public isHorizonVisible(cameraPosition: Vector3, point: Vector3, radiusFactor = 1): boolean {
        // We use a slightly smaller ellipsoid because we want to avoid false negatives
        // for negative elevations (think very deep seafloors).

        // https://cesium.com/blog/2013/04/25/horizon-culling/
        // Ellipsoid radii - WGS84 shown here
        const rX = this._semiMajor * radiusFactor;
        const rY = this._semiMajor * radiusFactor;
        const rZ = this._semiMinor * radiusFactor;

        // Vector CV
        const cvX = cameraPosition.x / rX;
        const cvY = cameraPosition.y / rY;
        const cvZ = cameraPosition.z / rZ;

        const vhMagnitudeSquared = cvX * cvX + cvY * cvY + cvZ * cvZ - 1.0;

        // Target position, transformed to scaled space
        const tX = point.x / rX;
        const tY = point.y / rY;
        const tZ = point.z / rZ;

        // Vector VT
        const vtX = tX - cvX;
        const vtY = tY - cvY;
        const vtZ = tZ - cvZ;
        const vtMagnitudeSquared = vtX * vtX + vtY * vtY + vtZ * vtZ;

        // VT dot VC is the inverse of VT dot CV
        const vtDotVc = -(vtX * cvX + vtY * cvY + vtZ * cvZ);

        const isOccluded =
            vtDotVc > vhMagnitudeSquared &&
            (vtDotVc * vtDotVc) / vtMagnitudeSquared > vhMagnitudeSquared;

        return !isOccluded;
    }
}
