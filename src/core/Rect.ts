/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type Extent from './geographic/Extent';

/**
 * A rectangle.
 */
class Rect {
    public xMin: number;
    public xMax: number;
    public yMin: number;
    public yMax: number;

    public constructor(xMin: number, xMax: number, yMin: number, yMax: number) {
        this.xMin = xMin;
        this.xMax = xMax;
        this.yMin = yMin;
        this.yMax = yMax;
    }

    public get left(): number {
        return this.xMin;
    }

    public get right(): number {
        return this.xMax;
    }

    public get top(): number {
        return this.yMax;
    }

    public get bottom(): number {
        return this.yMin;
    }

    public get width(): number {
        return this.xMax - this.xMin;
    }

    public get height(): number {
        return this.yMax - this.yMin;
    }

    public get centerX(): number {
        return this.xMin + (this.xMax - this.xMin) * 0.5;
    }

    public get centerY(): number {
        return this.yMin + (this.yMax - this.yMin) * 0.5;
    }

    public static fromExtent(extent: Extent): Rect {
        return new Rect(extent.west, extent.east, extent.south, extent.north);
    }

    /**
     * @param other - The other rect.
     * @param epsilon - The comparison epsilon.
     * @returns True if they are equal.
     */
    public equals(other: Rect, epsilon = 0.0001): boolean {
        return (
            Math.abs(other.xMin - this.xMin) <= epsilon &&
            Math.abs(other.xMax - this.xMax) <= epsilon &&
            Math.abs(other.yMin - this.yMin) <= epsilon &&
            Math.abs(other.yMax - this.yMax) <= epsilon
        );
    }

    public getIntersection(other: Rect): Rect {
        const xMin = Math.max(this.xMin, other.xMin);
        const xMax = Math.min(this.xMax, other.xMax);
        const yMin = Math.max(this.yMin, other.yMin);
        const yMax = Math.min(this.yMax, other.yMax);

        return new Rect(xMin, xMax, yMin, yMax);
    }

    /**
     * Returns the equivalent rectangle of `source` normalized over the dimensions of `dest`.
     *
     * @param source - The source rect.
     * @param dest - The destination rect.
     */
    public static getNormalizedRect(
        source: Rect,
        dest: Rect,
    ): { x: number; y: number; w: number; h: number } {
        const dstDim = { x: dest.width, y: dest.height };
        const srcDim = { x: source.width, y: source.height };
        let x = (source.left - dest.left) / dstDim.x;
        // We reverse north and south because canvas coordinates are top left corner based,
        // whereas extents are bottom left based.
        let y = (dest.top - source.top) / dstDim.y;

        let w = srcDim.x / dstDim.x;
        let h = srcDim.y / dstDim.y;

        // Necessary to avoid seams between tiles due to problems in
        // floating point precision when tile size is a multiple of the canvas size.
        const precision = 10 ** 10;

        x = Math.round((x + Number.EPSILON) * precision) / precision;
        y = Math.round((y + Number.EPSILON) * precision) / precision;
        w = Math.round((w + Number.EPSILON) * precision) / precision;
        h = Math.round((h + Number.EPSILON) * precision) / precision;

        return {
            x,
            y,
            w,
            h,
        };
    }
}

export default Rect;
