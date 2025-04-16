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

type ID = Record<string, number>;

type ProjCS = {
    type: 'PROJCS';
    name: string;
    AUTHORITY?: object;
};

type ProjCRS = {
    ID: ID;
};

type CompoundCS = {
    type: 'COMPD_CS';
    PROJCS: ProjCS;
};

function getAuthorityName(authority: object): string {
    const [auth, code] = Object.entries(authority)[0];

    return `${auth}:${code}`;
}

type CrsName = { name: string; srid?: string };

function getNicename(obj: object): string {
    if ('name' in obj && typeof obj.name === 'string') {
        return obj.name;
    }
    return '<unknown>';
}

function getWKTCrsName(wkt: string): CrsName | undefined {
    const parsed = parseCode(wkt) as ProjCRS | ProjCS | CompoundCS | object;

    if ('ID' in parsed) {
        // WKT 2 / PROJCRS
        const name = getNicename(parsed);
        const authority = getAuthorityName(parsed.ID);
        return { name, srid: authority };
    } else if ('PROJCS' in parsed) {
        // WKT 1 / COMPD_CS
        return getProjCSName(parsed['PROJCS']);
    } else if ('type' in parsed && parsed.type === 'PROJCS') {
        // WKT 1 / PROJCS
        return getProjCSName(parsed);
    } else {
        const name = getNicename(parsed);
        if ('AUTHORITY' in parsed && typeof parsed.AUTHORITY === 'object' && parsed.AUTHORITY) {
            const authority = getAuthorityName(parsed.AUTHORITY);
            return { name, srid: authority };
        }
        return { name };
    }

    return undefined;
}

function getProjCSName(projCs: ProjCS): CrsName | undefined {
    const name = getNicename(projCs);
    if (projCs.AUTHORITY) {
        const authority = getAuthorityName(projCs.AUTHORITY);
        return { name, srid: authority };
    }
    return { name };
}

type ParsedWkt = CrsName & { definition: string };
function readCrsFromWkt(wkt?: string): ParsedWkt | undefined {
    if (typeof wkt === 'undefined' || !wkt) {
        return undefined;
    }

    const crsName = getWKTCrsName(wkt);
    if (!crsName) {
        return undefined;
    }

    return { ...crsName, definition: wkt };
}

export default {
    transformBufferInPlace,
    transformVectors,
    readCrsFromWkt,
};
