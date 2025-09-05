/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
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
};

/**
 * Triangulate (or tessellate) the given polygon. Triangulation will work in any plane, contrary
 * to the naive Earcut implementation that does not work if all vertices are located on a vertical plane
 * (since the algorithm works on the XY coordinates).
 */
export function triangulate(
    flatCoordinates: ArrayLike<number>,
    holeIndices?: ArrayLike<number>,
): number[] {
    const coord = flatCoordinates;

    tris.a.set(coord[0], coord[1], coord[2]);
    tris.b.set(coord[3], coord[4], coord[5]);
    tris.c.set(coord[6], coord[7], coord[8]);

    // Since the earcut algorithm only works on the XY plane, any vertical polygon (e.g walls)
    // will not be correctly processed. We thus have to transform them as if they were sitting
    // (roughly) on the XY plane.
    // To do this, we compute the plane that the vertices are on, then create a matrix that has
    // the same orientation as this plane, then transform all points using this matrix.
    const plane = tris.plane.setFromCoplanarPoints(tris.a, tris.b, tris.c);

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
