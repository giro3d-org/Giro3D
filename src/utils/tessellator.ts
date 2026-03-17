/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import Earcut from 'earcut';
import { Matrix4, Plane, Vector3 } from 'three';

const X = 0;
const Y = 1;
const Z = 2;

const tris = {
    a: new Vector3(),
    b: new Vector3(),
    c: new Vector3(),
    matrix: new Matrix4(),
    plane: new Plane(),
    tempV: new Vector3(),
    UP: Object.freeze(new Vector3(0, 0, 1)),
    DEFAULT_PLANE: Object.freeze(new Plane(new Vector3(0, 0, 1))),
};

function getPlaneFromPoints(coord: ArrayLike<number>, target: Plane): Plane | null {
    const length = coord.length;

    for (let i = 0; i < length; i += 9) {
        const aX = (i + 0) % length;
        const aY = (i + 1) % length;
        const aZ = (i + 2) % length;

        const bX = (i + 3) % length;
        const bY = (i + 4) % length;
        const bZ = (i + 5) % length;

        const cX = (i + 6) % length;
        const cY = (i + 7) % length;
        const cZ = (i + 8) % length;

        // For each triplet of points, attempt to create a triangle.
        tris.a.set(coord[aX], coord[aY], coord[aZ]);
        tris.b.set(coord[bX], coord[bY], coord[bZ]);
        tris.c.set(coord[cX], coord[cY], coord[cZ]);

        // If the triangle is not degenerate, return the plane that it lies on.
        const plane = target.setFromCoplanarPoints(tris.a, tris.b, tris.c);

        if (plane.normal.lengthSq() > 0) {
            return plane;
        }
    }

    // This will happen if all points are collinear.
    return null;
}

/**
 * Triangulate (or tessellate) the given polygon. Triangulation will work in any plane, contrary
 * to the naive Earcut implementation that does not work if all vertices are located on a vertical plane
 * (since the algorithm works on the XY coordinates).
 * @param forceFlat - If true, then the algorithm considers that the polygon is flat on the
 * horizontal plane and does not try to correct orientation of faces.
 */
export function triangulate(
    flatCoordinates: ArrayLike<number>,
    holeIndices?: ArrayLike<number>,
    forceFlat?: boolean,
): number[] {
    const coord = flatCoordinates;

    if (forceFlat === true) {
        return Earcut(flatCoordinates, holeIndices, 3);
    }

    // Since the earcut algorithm only works on the XY plane, any vertical polygon (e.g walls)
    // will not be correctly processed. We thus have to transform them as if they were sitting
    // (roughly) on the XY plane.
    // To do this, we compute the plane that the vertices are on, then create a matrix that has
    // the same orientation as this plane, then transform all points using this matrix.
    const plane = getPlaneFromPoints(coord, tris.plane) ?? tris.DEFAULT_PLANE;

    // Is the plane completely orthogonal to the horizontal plane ?
    const dot = Math.abs(plane.normal.dot(tris.UP));

    // A dot product equals to zero means that the two planes are orthogonal (i.e all points of the
    // polygon plane, when projected onto the horizontal plane, will form a straight line, without any area)
    // Even if the area is very small, it is generally sufficient for the earcut algorithm to work.
    if (Math.abs(dot) > 0.05) {
        // Don't bother to transform coordinates since the polygon is on the XY plane.
        return Earcut(flatCoordinates, holeIndices, 3);
    }

    const matrix = tris.matrix.lookAt(tris.a, plane.normal.add(tris.a), tris.UP);

    const adjustedCoordinates = new Float64Array(flatCoordinates.length);

    for (let i = 0; i < flatCoordinates.length; i += 3) {
        const x = flatCoordinates[i + X];
        const y = flatCoordinates[i + Y];
        const z = flatCoordinates[i + Z];

        const v = tris.tempV.set(x, y, z).applyMatrix4(matrix);

        adjustedCoordinates[i + X] = v.y;
        adjustedCoordinates[i + Y] = v.x;
        adjustedCoordinates[i + Z] = v.z;
    }

    return Earcut(adjustedCoordinates, holeIndices, 3);
}
