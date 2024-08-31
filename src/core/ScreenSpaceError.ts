import type { Sphere } from 'three';
import { Box3, Matrix4, ShapeUtils, Vector3 } from 'three';

import type View from '../renderer/View';
import { isPerspectiveCamera } from '../utils/predicates';

const m = new Matrix4();
const tmpBox3 = new Box3();
const temp = [
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
];

export interface SSE {
    origin: Vector3;
    x: Vector3;
    y: Vector3;
    z: Vector3 | null;
    lengths: {
        x: number;
        y: number;
        z: number | null;
    };
    ratio: number;
    area: number;
}

function easeInOutQuad(t: number) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function computeSSE(
    offset: Vector3,
    size: Vector3,
    matrix: Matrix4,
    camera: View,
    _3d: boolean,
): SSE {
    temp[0].copy(offset);
    temp[0].applyMatrix4(matrix);

    matrix.extractBasis(temp[1], temp[2], temp[3]);
    // x-axis
    temp[1].normalize().multiplyScalar(size.x);
    // y-axis
    temp[2].normalize().multiplyScalar(size.y);
    // diag-axis
    temp[3] = temp[1].clone().add(temp[2]);
    // z-axis
    if (_3d) {
        temp[4].normalize().multiplyScalar(size.z);
    }

    for (let i = 1; i < (_3d ? 5 : 4); i++) {
        temp[i].add(temp[0]);
    }
    const worldToNDC = camera.viewMatrix;
    for (let i = 0; i < (_3d ? 5 : 4); i++) {
        temp[i].applyMatrix4(worldToNDC);
        temp[i].z = 0;
        // temp[i].clampScalar(-1, 1);
        // Map temp[i] from NDC = [-1, 1] to canvas coordinates
        temp[i].x = (temp[i].x + 1.0) * camera.width * 0.5;
        temp[i].y = camera.height - (temp[i].y + 1.0) * camera.height * 0.5;
    }

    // compute the real area
    const area = Math.abs(ShapeUtils.area([temp[0], temp[2], temp[3], temp[1]]));

    const xLength = temp[1].sub(temp[0]).length();
    const yLength = temp[2].sub(temp[0]).length();
    let z = null;
    let zLength = null;
    if (_3d) {
        z = temp[4].clone();
        zLength = temp[4].sub(temp[0]).length();
    }
    const result = {
        origin: temp[0].clone(),
        x: temp[1].clone(),
        y: temp[2].clone(),
        z,
        lengths: {
            x: xLength,
            y: yLength,
            z: zLength,
        },
        ratio: easeInOutQuad(area / (xLength * yLength)),
        area,
    };

    return result;
}

function findBox3Distance(camera: View, box3: Box3, matrix: Matrix4, isMode3d: boolean) {
    // TODO: can be cached
    // TODO: what about matrix scale component
    m.copy(matrix).invert();
    // Move camera position in box3 basis
    // (we don't transform box3 to camera basis because box3 are AABB,
    // so instead we apply the inverse transformation to the camera)
    const pt = new Vector3(0, 0, 0).applyMatrix4(camera.camera.matrixWorld).applyMatrix4(m);
    // Compute distance between the camera / box3
    tmpBox3.copy(box3);
    if (!isMode3d) {
        const avgZ = (box3.min.z + box3.max.z) / 2;
        // this is to avoid degenerated box3. If not, the z size is 0, which will break codes that
        // divide by size
        tmpBox3.min.z = avgZ - 0.1;
        tmpBox3.max.z = avgZ + 0.1;
    }
    return tmpBox3.distanceToPoint(pt);
}

function computeSizeFromGeometricError(box3: Box3, geometricError: number, _3d: boolean) {
    const size = box3.getSize(temp[5]);
    let maxComponent = Math.max(size.x, size.y);
    if (_3d) {
        maxComponent = Math.max(maxComponent, size.z);
    }
    // Build a vector with the same ratio than box3,
    // and with the biggest component being geometricError
    size.multiplyScalar(geometricError / maxComponent);
    return size;
}

enum Mode {
    /*
     * Compute SSE based on the 2D bounding-box (ignore z size)
     */
    MODE_2D = 1,
    /*
     * Compute SSE based on the 3D bounding-box
     */
    MODE_3D = 2,
}

export default {
    Mode,

    /**
     * Compute a "visible" error: project geometricError in meter on screen,
     * based on a bounding box and a transformation matrix.
     *
     * @param view - the current view of the scene
     * @param box3 - the box3 to consider
     * @param matrix - the matrix world of the box
     * @param geometricError - the geometricError
     * @param mode - Whether or not use 3D in the calculus
     */
    computeFromBox3(
        view: View,
        box3: Box3,
        matrix: Matrix4,
        geometricError: number,
        mode: Mode,
    ): SSE | null {
        if (isPerspectiveCamera(view.camera)) {
            const distance = findBox3Distance(view, box3, matrix, mode === Mode.MODE_3D);
            if (distance <= geometricError) {
                return null;
            }
        }

        const size = computeSizeFromGeometricError(box3, geometricError, mode === Mode.MODE_3D);
        const offset = box3.min;

        const sse = computeSSE(offset, size, matrix, view, mode === Mode.MODE_3D);

        return sse;
    },

    computeFromSphere(view: View, sphere: Sphere, geometricError: number) {
        const distance = Math.max(0.0, sphere.distanceToPoint(view.camera.position));
        temp[0].set(geometricError, 0, -distance);
        temp[0].applyMatrix4(view.camera.projectionMatrix);
        temp[0].x = temp[0].x * view.width * 0.5;
        temp[0].y = temp[0].y * view.height * 0.5;
        temp[0].z = 0;

        return temp[0].length();
    },
};
