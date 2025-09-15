/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2, Vector4 } from 'three';

/**
 * Describes a transformation of a point in 2D space without rotation.
 * Typically used for to transform texture coordinates.
 */
export default class OffsetScale extends Vector4 {
    readonly isOffsetScale = true;

    get offsetX() {
        return this.x;
    }

    get offsetY() {
        return this.y;
    }

    get scaleX() {
        return this.z;
    }

    get scaleY() {
        return this.w;
    }

    constructor(offsetX?: number, offsetY?: number, scaleX?: number, scaleY?: number) {
        super(offsetX, offsetY, scaleX, scaleY);
    }

    static identity(): OffsetScale {
        return new OffsetScale(0, 0, 1, 1);
    }

    /**
     * Transforms the point.
     * @param point - The point to transform.
     * @param target - The target to fill with the transformed point.
     * @returns The transformed point.
     */
    transform(point: Vector2, target = new Vector2()): Vector2 {
        target.x = point.x * this.scaleX + this.offsetX;
        target.y = point.y * this.scaleY + this.offsetY;

        return target;
    }

    combine(offsetScale: OffsetScale, target = new OffsetScale()): OffsetScale {
        target.copy(this);

        target.x += offsetScale.x * target.z;
        target.y += offsetScale.y * target.w;
        target.z *= offsetScale.z;
        target.w *= offsetScale.w;

        return target;
    }
}
