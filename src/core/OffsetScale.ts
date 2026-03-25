/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2, Vector4 } from 'three';

/**
 * Describes a transformation of a point in 2D space without rotation.
 * Typically used for to transform texture coordinates.
 */
export class OffsetScale extends Vector4 {
    public readonly isOffsetScale = true;

    public get offsetX(): number {
        return this.x;
    }

    public get offsetY(): number {
        return this.y;
    }

    public get scaleX(): number {
        return this.z;
    }

    public get scaleY(): number {
        return this.w;
    }

    public constructor(offsetX?: number, offsetY?: number, scaleX?: number, scaleY?: number) {
        super(offsetX, offsetY, scaleX, scaleY);
    }

    public static identity(): OffsetScale {
        return new OffsetScale(0, 0, 1, 1);
    }

    /**
     * Transforms the point.
     * @param point - The point to transform.
     * @param target - The target to fill with the transformed point.
     * @returns The transformed point.
     */
    public transform(point: Vector2, target = new Vector2()): Vector2 {
        target.x = point.x * this.scaleX + this.offsetX;
        target.y = point.y * this.scaleY + this.offsetY;

        return target;
    }

    public combine(offsetScale: OffsetScale, target = new OffsetScale()): OffsetScale {
        target.copy(this);

        target.x += offsetScale.x * target.z;
        target.y += offsetScale.y * target.w;
        target.z *= offsetScale.z;
        target.w *= offsetScale.w;

        return target;
    }
}

export default OffsetScale;
