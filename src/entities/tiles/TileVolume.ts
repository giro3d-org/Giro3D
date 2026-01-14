/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, type Matrix4, type Sphere, type Vector3 } from 'three';
import { OBB } from 'three/examples/jsm/Addons.js';

import type ElevationRange from '../../core/ElevationRange';

const tmpBox = new Box3();

/**
 * Provides an approximated volume taken by a {@link TileGeometry}
 * used for culling and LOD computation.
 */
export default abstract class TileVolume {
    protected _localBox: Box3 | null = null;

    public get localBox(): Readonly<Box3> {
        if (!this._localBox) {
            this._localBox = this.computeLocalBox();
        }
        return this._localBox;
    }

    public abstract getWorldSpaceCorners(matrix: Matrix4): Vector3[];

    protected abstract computeLocalBox(): Box3;

    public abstract setElevationRange(range: ElevationRange): void;

    /**
     * Returns the local size of this volume.
     */
    public getLocalSize(target: Vector3): Vector3 {
        return this.localBox.getSize(target);
    }

    /**
     * Returns the local bounding box.
     */
    public getLocalBoundingBox(target?: Box3): Box3 {
        const result = target ?? new Box3();

        result.copy(this.localBox);

        return result;
    }

    /**
     * Gets the world bounding box, taking into account world transformation.
     */
    public getWorldSpaceBoundingBox(target: Box3, matrix: Matrix4): Box3 {
        const result = target ?? new Box3();

        result.copy(this.localBox);

        result.applyMatrix4(matrix);

        return result;
    }

    /**
     * Gets the world-space oriented bounding box of this tile volume.
     */
    public getOBB(matrix: Matrix4): OBB {
        return new OBB().fromBox3(this.getWorldSpaceBoundingBox(new Box3(), matrix));
    }

    public getWorldSpaceBoundingSphere(target: Sphere, matrix: Matrix4): Sphere {
        return this.getWorldSpaceBoundingBox(tmpBox, matrix).getBoundingSphere(target);
    }
}
