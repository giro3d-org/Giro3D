import {
    BufferAttribute,
    Color,
    UnsignedByteType,
    Vector3,
    type BufferGeometry,
    type Points,
    type Vector2,
} from 'three';
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

export function preparePointGeometryForPicking(pointsGeometry: BufferGeometry) {
    // generate unique id for picking
    const numPoints = pointsGeometry.attributes.position.count;
    // reserve 12 bits for the entity id
    if (numPoints >= 1 << 20) {
        console.warn(`picking issue: only ${1 << 20} points per Points object supported`);
    }
    const ids = new Uint8Array(4 * numPoints);
    for (let i = 0; i < numPoints; i++) {
        ids[4 * i + 0] = 0;
        ids[4 * i + 1] = (i & 0x000f0000) >> 16;
        ids[4 * i + 2] = (i & 0x0000ff00) >> 8;
        ids[4 * i + 3] = (i & 0x000000ff) >> 0;
    }
    pointsGeometry.setAttribute('unique_id', new BufferAttribute(ids, 4, true));
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
    let visibleId = 1;
    // 12 bits reserved for the ids (= 4096 instances)
    const maxVisibleId = 1 << 12;
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
            mat.enablePicking(visibleId++);

            if (visibleId === maxVisibleId) {
                console.warn("Too much visible point instance. The next one won't be pickable");
            }
        }
    });

    // render 1 pixel
    const buffer = instance.engine.renderToBuffer({
        camera: instance.view.camera,
        scene: entity.object3d,
        clearColor: BLACK,
        datatype: UnsignedByteType,
        zone: {
            x: Math.max(0, canvasCoords.x - radius),
            y: Math.max(0, canvasCoords.y - radius),
            width: 1 + radius * 2,
            height: 1 + radius * 2,
        },
    });

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

        const data = buffer.slice(idx * 4, idx * 4 + 4);

        if (data[0] === 255 && data[1] === 255) {
            return null;
        }
        // 12 first bits (so data[0] and half of data[1]) = pickingId
        const pickingId = data[0] + ((data[1] & 0xf0) << 4);

        if (pickingId > visibleId) {
            console.warn(`weird: pickingId (${pickingId}) > visibleId (${visibleId})`);
        }
        // the remaining 20 bits = the point index
        const index = ((data[1] & 0x0f) << 16) + (data[2] << 8) + data[3];

        const r: PickPointsCandidate = {
            pickingId,
            index,
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

        for (let i = 0; i < candidates.length; i++) {
            if (candidates[i].pickingId === mat.pickingId) {
                const position = new Vector3()
                    .fromArray(pts.geometry.attributes.position.array, 3 * candidates[i].index)
                    .applyMatrix4(o.matrixWorld);
                const p: PointsPickResult = {
                    isPointsPickResult: true,
                    object: pts,
                    index: candidates[i].index,
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
