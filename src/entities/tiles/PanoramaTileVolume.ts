/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Matrix4 } from 'three';

import { Box3, MathUtils, Sphere, Vector2, Vector3 } from 'three';

import type ElevationRange from '../../core/ElevationRange';
import type Extent from '../../core/geographic/Extent';

import CoordinateSystem from '../../core/geographic/coordinate-system/CoordinateSystem';
import Coordinates from '../../core/geographic/Coordinates';
import { toCartesian } from './PanoramaTileGeometry';
import TileVolume from './TileVolume';

const vec3 = new Vector3();
const vec2 = new Vector2();
const coord = new Coordinates(CoordinateSystem.epsg4326, 0, 0);
const tmpCorners: Vector3[] = [];

export default class PanoramaTileVolume extends TileVolume {
    private readonly _radius: number;
    private readonly _extent: Extent;

    private _corners: Vector3[] | null = null;

    public get extent(): Readonly<Extent> {
        return this._extent;
    }

    public get radius(): Readonly<number> {
        return this._radius;
    }

    public constructor(options: { extent: Extent; radius: number }) {
        super();
        this._extent = options.extent;
        this._radius = options.radius;
    }

    public getWorldSpaceCorners(matrix: Matrix4, target?: Vector3[]): Vector3[] {
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

                    const p0 = toCartesian(latitude, longitude, this._radius, new Vector3());

                    this._corners[index++] = p0;
                }
            }
        }

        target = target ?? [];
        target.length = this._corners.length;

        for (let i = 0; i < target.length; i++) {
            target[i] = this._corners[i].clone().applyMatrix4(matrix);
        }

        return target;
    }

    protected override computeLocalBox(): Box3 {
        const extent = this._extent;

        const radius = this._radius;

        const nw = toCartesian(extent.north, extent.west, radius, new Vector3());
        const sw = toCartesian(extent.south, extent.west, radius, new Vector3());
        const se = toCartesian(extent.south, extent.east, radius, new Vector3());
        const ne = toCartesian(extent.north, extent.east, radius, new Vector3());

        const center = extent.center(coord);

        const c = toCartesian(center.latitude, center.longitude, radius, new Vector3());
        const nc = toCartesian(extent.north, center.longitude, radius, new Vector3());
        const cw = toCartesian(center.latitude, extent.west, radius, new Vector3());
        const ce = toCartesian(center.latitude, extent.east, radius, new Vector3());
        const sc = toCartesian(extent.south, center.longitude, radius, new Vector3());

        const worldBox = new Box3().setFromPoints([nw, sw, se, ne, c, nc, cw, ce, sc]);

        return worldBox.setFromCenterAndSize(
            worldBox.getCenter(vec3).sub(nw),
            worldBox.getSize(new Vector3()),
        );
    }

    public setElevationRange(_range: ElevationRange): void {
        // Nothing to do
    }

    public override getWorldSpaceBoundingSphere(target: Sphere, matrix: Matrix4): Sphere {
        target = target ?? new Sphere();
        return target.setFromPoints(this.getWorldSpaceCorners(matrix, tmpCorners));
    }
}
