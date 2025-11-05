/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Vector3 } from 'three';

import proj from 'proj4';
import { MathUtils, Vector2, type TypedArray } from 'three';

import type CoordinateSystem from '../core/geographic/CoordinateSystem';

import { getConverter } from '../core/geographic/ProjectionCache';

const ZERO = new Vector2(0, 0);

/**
 * Transform the position buffer in place, from the source to the destination CRS.
 * The buffer is expected to contain N * stride elements, where N is the number of points.
 * Only the 2 first elements of each point (i.e the X and Y coordinate) are transformed. The other
 * elements are left untouched.
 *
 * @param buf - The buffer to transform.
 * @param params - The transformation parameters.
 */
function transformBufferInPlace(
    buf: TypedArray,
    params: {
        /** The source CRS code. Must be known to PROJ. */
        srcCrs: CoordinateSystem;
        /** The destination CRS code. Must be known to PROJ. */
        dstCrs: CoordinateSystem;
        /** The stride of the buffer. */
        stride: number;
        /** The offset to apply after transforming the coordinate. */
        offset?: Vector2;
    },
): void {
    const srcCrsId = params.srcCrs.id;
    const dstCrsId = params.dstCrs.id;
    if (srcCrsId === dstCrsId) {
        return;
    }
    if (params.stride === undefined || params.stride < 2) {
        throw new Error('invalid stride: must be at least 2');
    }

    const src = proj.Proj(srcCrsId);
    const dst = proj.Proj(dstCrsId);

    const tmp = { x: 0, y: 0 };
    const length = buf.length;

    const stride = params.stride;
    const offset = params.offset ?? ZERO;

    for (let i = 0; i < length; i += stride) {
        tmp.x = buf[i + 0];
        tmp.y = buf[i + 1];

        const out = proj.transform(src, dst, tmp, true);

        if (out == null) {
            throw new Error(`could not reproject from ${src.name} to ${dst.name}`);
        }
        buf[i + 0] = out.x + offset.x;
        buf[i + 1] = out.y + offset.y;
    }
}

/**
 * Transforms the vector array _in place_, from the source to the destination CRS.
 */
function transformVectors<T extends Vector2 | Vector3>(
    srcCrs: CoordinateSystem,
    dstCrs: CoordinateSystem,
    points: T[],
): void {
    const converter = getConverter(srcCrs, dstCrs);

    // The mercator projection does not work at poles
    const shouldClamp = srcCrs.isEpsg(4326) && dstCrs.isEpsg(3857);

    for (let i = 0; i < points.length; i++) {
        const pt0 = points[i];
        if (shouldClamp) {
            pt0.setY(MathUtils.clamp(pt0.y, -89.999999, 89.999999));
        }
        const pt1 = converter.forward(pt0);
        // @ts-expect-error weird error
        points[i].copy(pt1);
    }
}

export default { transformBufferInPlace, transformVectors };
