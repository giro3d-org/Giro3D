import { Color, FloatType, Vector3, type Points, type Vector2 } from 'three';
import type Entity3D from '../../entities/Entity3D';
import PointCloudMaterial from '../../renderer/PointCloudMaterial';
import type Instance from '../Instance';
import traversePickingCircle from './PickingCircle';
import type PickOptions from './PickOptions';
import type PickResult from './PickResult';

/** Pick result on PointCloud-like objects */
export interface PointsPickResult<TFeature = unknown> extends PickResult<TFeature & unknown> {
    isPointsPickResult: true;
    /** Point cloud picked */
    object: Points;
    /** Index of the point in the `Points` object */
    index: number;
    /** Coordinates of the point picked. */
    coord: { x: number; y: number; z: number };
}

/**
 * Tests whether an object implements {@link PointsPickResult}.
 *
 * @param obj - Object
 * @returns `true` if the object implements the interface.
 */
export const isPointsPickResult = (obj: unknown): obj is PointsPickResult =>
    (obj as PointsPickResult).isPointsPickResult;

const BLACK = new Color(0, 0, 0);

interface PickPointsCandidate {
    pickingId: number;
    index: number;
    coord: { x: number; y: number; z: number };
}

/**
 * Pick points from a PointCloud-like entity.
 *
 * @param instance - Instance to pick from
 * @param canvasCoords - Coordinates on the rendering canvas
 * @param entity - Object to pick from
 * @param options - Options
 * @returns Array of picked objects
 */
function pickPointsAt(
    instance: Instance,
    canvasCoords: Vector2,
    entity: Entity3D,
    options: PickOptions = {},
) {
    const radius = Math.floor(options.radius ?? 0);
    const limit = options.limit ?? Infinity;
    const filter = options.filter;
    const target: PointsPickResult[] = [];

    // Enable picking mode for points material, by assigning
    // a unique id to each Points instance.
    let objectId = 1;
    entity.object3d.traverse(o => {
        if (!('isPoints' in o) || o.isPoints !== true || !o.visible) {
            return;
        }
        const pts = o as Points;
        if (!PointCloudMaterial.isPointCloudMaterial(pts.material)) {
            return;
        }

        const mat = pts.material;
        if (mat.visible && typeof mat.enablePicking === 'function') {
            mat.enablePicking(objectId++);
        }
    });

    // render 1 pixel
    const buffer = instance.engine.renderToBuffer({
        camera: instance.view.camera,
        scene: entity.object3d,
        clearColor: BLACK,
        datatype: FloatType,
        zone: {
            x: Math.max(0, canvasCoords.x - radius),
            y: Math.max(0, canvasCoords.y - radius),
            width: 1 + radius * 2,
            height: 1 + radius * 2,
        },
    }) as Float32Array;

    const candidates: PickPointsCandidate[] = [];

    traversePickingCircle(radius, (x, y, idx) => {
        const coord = {
            x: x + canvasCoords.x,
            y: y + canvasCoords.y,
            z: 0,
        };

        if (idx * 4 < 0 || (idx + 1) * 4 > buffer.length) {
            console.error(
                'Index out of bounds: The calculated index is either negative or exceeds the buffer length.',
            );
        }

        // The point index is in the red channel, and the object ID is in the green channel.
        // Points are encoded into floats in the shader, so we have to round them to eliminate
        // potential rounding errors.
        const RED = 0;
        const GREEN = 1;
        const pointIndex = Math.round(buffer[idx * 4 + RED]);
        const objectId = Math.round(buffer[idx * 4 + GREEN]);

        if (objectId > objectId) {
            console.warn(`weird: pickingId (${objectId}) > visibleId (${objectId})`);
        }

        const r: PickPointsCandidate = {
            pickingId: objectId,
            index: pointIndex,
            coord,
        };

        // filter already if already present
        for (let i = 0; i < candidates.length; i++) {
            if (candidates[i].pickingId === r.pickingId && candidates[i].index === r.index) {
                return null;
            }
        }

        candidates.push(r);
        return null;
    });

    entity.object3d.traverse(o => {
        if (!('isPoints' in o) || o.isPoints !== true || !o.visible) {
            return;
        }
        const pts = o as Points;
        if (!PointCloudMaterial.isPointCloudMaterial(pts.material)) {
            return;
        }

        const mat = pts.material;
        if (!mat.visible) {
            return;
        }

        const positions = pts.geometry.getAttribute('position');

        for (let i = 0; i < candidates.length; i++) {
            if (candidates[i].pickingId === mat.pickingId) {
                const index = candidates[i].index;

                const x = positions.getX(index);
                const y = positions.getY(index);
                const z = positions.getZ(index);

                const position = new Vector3(x, y, z).applyMatrix4(o.matrixWorld);

                const p: PointsPickResult = {
                    isPointsPickResult: true,
                    object: pts,
                    index,
                    entity,
                    point: position,
                    coord: candidates[i].coord,
                    distance: instance.view.camera.position.distanceTo(position),
                };
                if (!filter || filter(p)) {
                    target.push(p);

                    if (target.length >= limit) {
                        break;
                    }
                }
            }
        }
        // disable picking mode
        mat.enablePicking(0);
    });

    return target;
}

export default pickPointsAt;
