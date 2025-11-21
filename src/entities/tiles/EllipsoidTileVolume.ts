/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, MathUtils, Matrix3, Matrix4, Plane, type Sphere, Vector2, Vector3 } from 'three';
import { OBB } from 'three/examples/jsm/Addons.js';

import type ElevationRange from '../../core/ElevationRange';
import type Ellipsoid from '../../core/geographic/Ellipsoid';
import type Extent from '../../core/geographic/Extent';

import Coordinates from '../../core/geographic/Coordinates';
import CoordinateSystem from '../../core/geographic/CoordinateSystem';
import TileVolume from './TileVolume';

const vec3 = new Vector3();
const vec2 = new Vector2();
const coord = new Coordinates(CoordinateSystem.epsg4326, 0, 0);
const matrix4 = new Matrix4();

export default class EllipsoidTileVolume extends TileVolume {
    private readonly _ellipsoid: Ellipsoid;
    private readonly _extent: Extent;
    private _range: ElevationRange = { min: -1, max: +1 };

    private _obb: OBB | null = null;
    private _corners: Vector3[] | null = null;
    private _max = 0;
    private _min = 0;
    private _origin: Vector3 | undefined = undefined;

    public get extent(): Readonly<Extent> {
        return this._extent;
    }

    public get ellipsoid(): Readonly<Ellipsoid> {
        return this._ellipsoid;
    }

    public get origin(): Vector3 {
        if (this._origin == null) {
            const { x, y } = this.extent.centerAsVector2();
            this._origin = this.ellipsoid.toCartesian(x, y, 0, this._origin);
        }

        return this._origin;
    }

    public constructor(options: { extent: Extent; range: ElevationRange; ellipsoid: Ellipsoid }) {
        super();
        this._extent = options.extent;
        this._range = options.range;
        this._ellipsoid = options.ellipsoid;
    }

    public getWorldSpaceCorners(matrix?: Matrix4): Vector3[] {
        if (this._corners == null) {
            const dims = this._extent.dimensions(vec2);

            const xCount = MathUtils.clamp(Math.round(dims.width / 5) + 1, 2, 6);
            const yCount = MathUtils.clamp(Math.round(dims.height / 5) + 1, 2, 6);

            this._corners = new Array(xCount * yCount);
            const uStep = 1 / (xCount - 1);
            const jStep = 1 / (yCount - 1);

            let index = 0;
            for (let i = 0; i < xCount; i++) {
                for (let j = 0; j < yCount; j++) {
                    const u = i * uStep;
                    const v = j * jStep;

                    const { latitude, longitude } = this._extent.sampleUV(u, v, coord);

                    const p0 = this._ellipsoid.toCartesian(latitude, longitude, this._min);
                    const p1 = this._ellipsoid.toCartesian(latitude, longitude, this._max);

                    if (matrix) {
                        p0.applyMatrix4(matrix);
                        p1.applyMatrix4(matrix);
                    }

                    this._corners[index++] = p0;
                    this._corners[index++] = p1;
                }
            }
        }

        return this._corners;
    }

    public override getOBB(): OBB {
        if (this._obb == null) {
            const center = this._extent.center(coord);

            const cartesianCenter = this.ellipsoid.toCartesian(
                center.latitude,
                center.longitude,
                0,
            );

            // To help us compute the thickness (on the local Z axis) of the box,
            // we create a tangent plane on the ellipsoid, then measure the distance from
            // the corners to this plane.
            const distanceFromOrigin = cartesianCenter.length();
            const normal = this.ellipsoid.getNormalFromCartesian(cartesianCenter);
            const plane = new Plane(normal, -distanceFromOrigin);

            const corners = this.getWorldSpaceCorners();

            let localMax = 0;
            let localMin = 0;

            for (let i = 0; i < corners.length; i++) {
                const element = corners[i];
                const distance = plane.distanceToPoint(element);
                if (distance >= 0) {
                    localMax = Math.max(localMax, distance);
                } else {
                    localMin = Math.min(localMin, distance);
                }
            }

            const thickness = Math.abs(localMax - localMin);

            let horizontalDistance: number;

            // To compute the width and height of the box, we
            // measure the arc chords associated to the vertical
            // and horizontal sides of the extent (which looks like a curved sheet).
            const sw = this.extent.sampleUV(0, 0);
            const se = this.extent.sampleUV(1, 0);
            const nw = this.extent.sampleUV(0, 1);
            const ne = this.extent.sampleUV(1, 1);

            // We have to use the greatest chord length for the horizontal chord,
            // since tiles that touch the pole have a chord length of zero at the pole.

            if (center.latitude > 0) {
                // Northern hemisphere
                horizontalDistance = this._ellipsoid
                    .toCartesian(sw.latitude, sw.longitude, 0)
                    .distanceTo(this._ellipsoid.toCartesian(se.latitude, se.longitude, 0));
            } else {
                // Southern hemisphere
                horizontalDistance = this._ellipsoid
                    .toCartesian(nw.latitude, nw.longitude, 0)
                    .distanceTo(this._ellipsoid.toCartesian(ne.latitude, ne.longitude, 0));
            }

            // The vertical distance is simpler, since
            // it is the same on both sides of the extent.
            const verticalDistance = this._ellipsoid
                .toCartesian(sw.latitude, sw.longitude, 0)
                .distanceTo(this._ellipsoid.toCartesian(nw.latitude, nw.longitude, 0));

            const halfSize = new Vector3(
                horizontalDistance / 2,
                verticalDistance / 2,
                thickness / 2,
            );

            // The center is located on the tangent plane, but it's incorrect:
            // we have to move it down so that it is located at the actual
            // center of the computed volume.
            const midHeight = MathUtils.lerp(localMax, localMin, 0.5);
            cartesianCenter.addScaledVector(normal, midHeight);

            // Finally, the rotation component of the OBB is simply the ENU matrix at the center.
            const rotation = new Matrix3().setFromMatrix4(
                this.ellipsoid.getEastNorthUpMatrixFromCartesian(cartesianCenter, matrix4),
            );

            this._obb = new OBB(cartesianCenter, halfSize, rotation);
        }

        return this._obb;
    }

    protected override computeLocalBox(): Box3 {
        const extent = this._extent;

        const min = this._range.min;
        const max = this._range.max;

        const p0 = this._ellipsoid.toCartesian(extent.north, extent.west, min);
        const p1 = this._ellipsoid.toCartesian(extent.north, extent.west, max);

        const p2 = this._ellipsoid.toCartesian(extent.south, extent.west, min);
        const p3 = this._ellipsoid.toCartesian(extent.south, extent.west, max);

        const p4 = this._ellipsoid.toCartesian(extent.south, extent.east, min);
        const p5 = this._ellipsoid.toCartesian(extent.south, extent.east, max);

        const p6 = this._ellipsoid.toCartesian(extent.north, extent.east, min);
        const p7 = this._ellipsoid.toCartesian(extent.north, extent.east, max);

        const center = extent.center(coord);

        const p8 = this._ellipsoid.toCartesian(center.latitude, center.longitude, min);
        const p9 = this._ellipsoid.toCartesian(center.latitude, center.longitude, max);

        const p10 = this._ellipsoid.toCartesian(extent.north, center.longitude, min);
        const p11 = this._ellipsoid.toCartesian(extent.south, center.longitude, max);

        const p12 = this._ellipsoid.toCartesian(center.latitude, extent.west, min);
        const p13 = this._ellipsoid.toCartesian(center.latitude, extent.east, max);

        const worldBox = new Box3().setFromPoints([
            p0,
            p1,
            p2,
            p3,
            p4,
            p5,
            p6,
            p7,
            p8,
            p9,
            p10,
            p11,
            p12,
            p13,
        ]);

        return worldBox.setFromCenterAndSize(
            worldBox.getCenter(vec3).sub(p0),
            worldBox.getSize(new Vector3()),
        );
    }

    public setElevationRange(range: ElevationRange): void {
        let { min, max } = range;

        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            min = 0;
            max = 0;
        }

        this._range = { min, max };

        if (this._min !== min || this._max !== max) {
            this._min = min;
            this._max = max;
            this._localBox = this.computeLocalBox();
            this._corners = null;
            this._obb = null;
        }
    }

    public override getWorldSpaceBoundingSphere(target: Sphere): Sphere {
        const obb = this.getOBB();
        // Technically not a bounding sphere because we are selecting
        // the smallest side for the radius, but since this is used
        // for LOD computation rather than culling, it's fine.
        // The reason we are picking the smallest radius is to avoid having
        // giant spheres for very elongated tiles near the poles, leading to
        // very incorrect LOD selection for those regions.
        const radius = Math.min(obb.halfSize.x, obb.halfSize.y);
        return target.set(obb.center, radius);
    }
}
