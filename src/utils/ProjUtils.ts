import proj from 'proj4';
import type { Vector3 } from 'three';
import { MathUtils, Vector2, type TypedArray } from 'three';
import { getConverter } from '../core/geographic/ProjectionCache';

// @ts-expect-error no types
import parseCode from 'proj4/lib/parseCode';

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
        srcCrs: string;
        /** The destination CRS code. Must be known to PROJ. */
        dstCrs: string;
        /** The stride of the buffer. */
        stride: number;
        /** The offset to apply after transforming the coordinate. */
        offset?: Vector2;
    },
) {
    if (params.srcCrs === params.dstCrs) {
        return;
    }
    if (params.stride === undefined || params.stride < 2) {
        throw new Error('invalid stride: must be at least 2');
    }

    const src = proj.Proj(params.srcCrs);
    const dst = proj.Proj(params.dstCrs);

    const tmp = { x: 0, y: 0 };
    const length = buf.length;

    const stride = params.stride;
    const offset = params.offset ?? ZERO;

    for (let i = 0; i < length; i += stride) {
        tmp.x = buf[i + 0];
        tmp.y = buf[i + 1];
        const out = proj.transform(src, dst, tmp);
        buf[i + 0] = out.x + offset.x;
        buf[i + 1] = out.y + offset.y;
    }
}

/**
 * Transforms the vector array _in place_, from the source to the destination CRS.
 */
function transformVectors<T extends Vector2 | Vector3>(
    srcCrs: string,
    dstCrs: string,
    points: T[],
): void {
    const converter = getConverter(srcCrs, dstCrs);

    // The mercator projection does not work at poles
    const shouldClamp = srcCrs === 'EPSG:4326' && dstCrs === 'EPSG:3857';

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

export type ID = Record<string, number>;
export type Authority = Record<string, number>;

export type ProjCS = {
    AUTHORITY: Authority;
};

export type ProjCRS = {
    ID: ID;
};

export type CompoundCS = {
    PROJCS: ProjCS;
};

function getCode(authority: Authority): string {
    const [auth, code] = Object.entries(authority)[0];

    return `${auth}:${code}`;
}

function getWKTCrsCode(wkt: string): string | undefined {
    const parsed = parseCode(wkt) as ProjCRS | ProjCS | CompoundCS;

    if ('ID' in parsed) {
        // WKT 2 / PROJCRS
        return getCode(parsed.ID);
    } else if ('PROJCS' in parsed) {
        // WKT 1 / COMPD_CS
        return getCode(parsed['PROJCS'].AUTHORITY);
    } else if ('AUTHORITY' in parsed) {
        // WKT 1 / PROJCS
        return getCode(parsed.AUTHORITY);
    }

    return undefined;
}

export default {
    transformBufferInPlace,
    transformVectors,
    getWKTCrsCode,
};
