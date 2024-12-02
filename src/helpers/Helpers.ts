import {
    ArrowHelper,
    AxesHelper,
    Box3,
    Box3Helper,
    BufferAttribute,
    BufferGeometry,
    Color,
    GridHelper,
    LineBasicMaterial,
    LineSegments,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    SphereGeometry,
    Vector3,
    type Material,
    type Object3D,
    type Sphere,
} from 'three';
import type { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type OBB from '../core/OBB.js';
import type { ProcessedTile } from '../entities/3dtiles/3dTilesIndex';
import type Tiles3D from '../entities/Tiles3D';
import { isMaterial } from '../utils/predicates';
import { nonNull } from '../utils/tsutils';
import OBBHelper from './OBBHelper';

export class VolumeHelper extends OBBHelper {
    readonly isvolumeHelper = true;
}

export class SphereHelper extends Mesh<BufferGeometry, MeshBasicMaterial> {
    readonly isHelper = true;
}

export class BoundingBoxHelper extends Box3Helper {
    readonly isHelper = true;
    readonly isvolumeHelper = true;
}

interface HasBoundingBox extends Object3D {
    boundingBox: Box3;
}

interface HasVolumeHelper extends Object3D {
    volumeHelper: VolumeHelper;
}

interface HasBoundingBoxHelper extends Object3D {
    volumeHelper: BoundingBoxHelper;
}

export function hasVolumeHelper(obj: unknown): obj is HasVolumeHelper {
    return (obj as HasVolumeHelper)?.volumeHelper !== undefined;
}

interface HasSelectionHelper extends Object3D {
    selectionHelper: BoundingBoxHelper;
}

interface HasBoundingVolumeHelper extends Object3D {
    boundingVolumeHelper: {
        object3d:
            | SphereHelper
            | VolumeHelper
            | LineSegments<LineSegmentsGeometry | BufferGeometry, LineBasicMaterial>
            | Mesh<BufferGeometry, MeshBasicMaterial>;
        absolute: boolean;
    };
}

export function hasBoundingVolumeHelper(obj: unknown): obj is HasBoundingVolumeHelper {
    return (obj as HasBoundingVolumeHelper)?.boundingVolumeHelper !== undefined;
}

interface HasGeometry extends Object3D {
    geometry: BufferGeometry;
}

const _vector = new Vector3();
const invMatrixChangeUpVectorZtoY = new Matrix4().makeRotationX(Math.PI / 2).invert();
const invMatrixChangeUpVectorZtoX = new Matrix4().makeRotationZ(-Math.PI / 2).invert();
let _axisSize = 500;

/**
 * @param colorDesc - A THREE color or hex string.
 * @returns The THREE color.
 */
function getColor(colorDesc: Color | string) {
    if (typeof colorDesc === 'string' || colorDesc instanceof String) {
        return new Color(colorDesc);
    }

    return colorDesc;
}

function create3dTileRegion(region: OBB, color: Color) {
    const helper = new VolumeHelper(region, color);
    helper.position.copy(region.position);
    helper.rotation.copy(region.rotation);
    return helper;
}

/**
 * This function creates a Box3 by matching the object's bounding box,
 * without including its children.
 *
 * @param object - The object to expand.
 * @param precise - If true, the computation uses the vertices from the geometry.
 * @returns The expanded box.
 */
function makeLocalBbox(object: Object3D, precise = false): Box3 {
    // The object provides a specific bounding box
    if ((object as HasBoundingBox).boundingBox != null) {
        return (object as HasBoundingBox).boundingBox;
    }

    const box = new Box3();

    const geometry = (object as HasGeometry).geometry;

    if (geometry !== undefined) {
        if (
            precise &&
            geometry.attributes !== undefined &&
            geometry.attributes.position !== undefined
        ) {
            const position = geometry.attributes.position;
            for (let i = 0, l = position.count; i < l; i++) {
                _vector.fromBufferAttribute(position, i);
                box.expandByPoint(_vector);
            }
        } else {
            if (geometry.boundingBox === null) {
                geometry.computeBoundingBox();
            }

            box.copy(nonNull(geometry.boundingBox));
        }
    }

    return box;
}

const unitBoxMesh = (function _() {
    const indices = new Uint16Array([
        0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7,
    ]);
    const positions = new Float32Array(8 * 3);
    new Vector3(+0.5, +0.5, +0.5).toArray(positions, 0);
    new Vector3(-0.5, +0.5, +0.5).toArray(positions, 3);
    new Vector3(-0.5, -0.5, +0.5).toArray(positions, 6);
    new Vector3(+0.5, -0.5, +0.5).toArray(positions, 9);
    new Vector3(+0.5, +0.5, -0.5).toArray(positions, 12);
    new Vector3(-0.5, +0.5, -0.5).toArray(positions, 15);
    new Vector3(-0.5, -0.5, -0.5).toArray(positions, 18);
    new Vector3(+0.5, -0.5, -0.5).toArray(positions, 21);
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute('position', new BufferAttribute(positions, 3));

    return function _unitBoxMesh(color: Color) {
        const material = new LineBasicMaterial({
            color,
            linewidth: 3,
        });

        const box = new LineSegments(geometry, material);
        box.frustumCulled = false;
        return box;
    };
})();

/**
 * @param box - The box.
 * @param color - The color.
 */
function createBoxVolume(box: Box3, color: Color) {
    const helper = unitBoxMesh(color);
    helper.scale.copy(box.getSize(_vector));
    box.getCenter(helper.position);
    return helper;
}

function createSphereVolume(sphere: Sphere, color: Color) {
    const geometry = new SphereGeometry(sphere.radius, 32, 32);
    const material = new MeshBasicMaterial({ wireframe: true, color });
    const helper = new SphereHelper(geometry, material);
    helper.position.copy(sphere.center);
    return helper;
}

/**
 * Provides utility functions to create scene helpers, such as bounding boxes, grids, axes...
 *
 */
class Helpers {
    /**
     * Adds a bounding box helper to the object.
     * If a bounding box is already present, it is updated instead.
     *
     * @param obj - The object to decorate.
     * @param color - The color.
     * @example
     * // add a bounding box to 'obj'
     * Helpers.addBoundingBox(obj, 'green');
     */
    static addBoundingBox(obj: Object3D, color: Color | string) {
        // Don't add a bounding box helper to a bounding box helper !
        if ((obj as BoundingBoxHelper).isvolumeHelper) {
            return;
        }
        if (hasVolumeHelper(obj)) {
            obj.volumeHelper.updateMatrixWorld(true);
        } else {
            const helper = Helpers.createBoxHelper(makeLocalBbox(obj), getColor(color));
            obj.add(helper);
            (obj as HasBoundingBoxHelper).volumeHelper = helper;
            helper.updateMatrixWorld(true);
        }
    }

    static createBoxHelper(box: Box3, color: Color) {
        const helper = new BoundingBoxHelper(box, color);
        helper.name = 'bounding box';
        if (isMaterial(helper.material)) {
            helper.material.transparent = true;
            helper.material.needsUpdate = true;
        }
        return helper;
    }

    static set axisSize(v) {
        _axisSize = v;
    }

    static get axisSize() {
        return _axisSize;
    }

    /**
     * Creates a selection bounding box helper around the specified object.
     *
     * @param obj - The object to decorate.
     * @param color - The color.
     * @returns the created box helper.
     * @example
     * // add a bounding box to 'obj'
     * Helpers.createSelectionBox(obj, 'green');
     */
    static createSelectionBox(obj: Object3D, color: Color) {
        const helper = Helpers.createBoxHelper(makeLocalBbox(obj), getColor(color));
        (obj as HasSelectionHelper).selectionHelper = helper;
        obj.add(helper);
        obj.updateMatrixWorld(true);
        return helper;
    }

    /**
     * Adds an oriented bounding box (OBB) helper to the object.
     * If a bounding box is already present, it is updated instead.
     *
     * @param obj - The object to decorate.
     * @param obb - The OBB.
     * @param color - The color.
     * @example
     * // add an OBB to 'obj'
     * Helpers.addOBB(obj, obj.OBB, 'green');
     */
    static addOBB(obj: Object3D, obb: OBB, color: Color) {
        if (hasVolumeHelper(obj)) {
            obj.volumeHelper.update(obb, color);
        } else {
            const helper = new VolumeHelper(obb, color);
            helper.name = 'OBBHelper';
            obj.add(helper);
            (obj as HasVolumeHelper).volumeHelper = helper;
            helper.updateMatrixWorld(true);
        }
    }

    static removeOBB(obj: Object3D) {
        if (hasVolumeHelper(obj)) {
            const helper = (obj as HasVolumeHelper).volumeHelper;
            helper.removeFromParent();
            helper.dispose();
            // @ts-expect-error cannot remove "mandatory" property
            delete obj.volumeHelper;
        }
    }

    /**
     * Creates a bounding volume helper to the 3D Tile object and returns it.
     * The bounding volume can contain a sphere, a region, or a box.
     *
     * @param entity - The entity.
     * @param obj - The object to decorate.
     * @param metadata - The tile metadata
     * @param color - The color.
     * @returns The helper object, or null if it could not be created.
     * @example
     * // add a bounding box to 'obj'
     * Helpers.create3DTileBoundingVolume(entity, obj, volume, 'green');
     */
    static create3DTileBoundingVolume(
        entity: Tiles3D,
        obj: Object3D,
        metadata: ProcessedTile,
        color: Color | string,
    ) {
        if (hasBoundingVolumeHelper(obj)) {
            obj.boundingVolumeHelper.object3d.visible = obj.visible;
            return obj.boundingVolumeHelper;
        }

        color = getColor(color);
        let object3d;
        let absolute = false;
        const { boundingVolumeObject: boundingVolume } = metadata;

        if (boundingVolume.region) {
            object3d = create3dTileRegion(boundingVolume.region, color);
            // regions have worldspace (absolute) positions,
            // they should not be attached to the tile object.
            absolute = true;
        } else if (boundingVolume.box) {
            object3d = createBoxVolume(boundingVolume.box, color);
        } else if (boundingVolume.sphere) {
            object3d = createSphereVolume(boundingVolume.sphere, color);
        }

        if (
            object3d &&
            (metadata.magic === 'b3dm' || metadata.magic === 'i3dm') &&
            !boundingVolume.region
        ) {
            // compensate B3dm orientation correction
            const { gltfUpAxis } = entity.asset;
            object3d.updateMatrix();
            if (gltfUpAxis === undefined || gltfUpAxis === 'Y') {
                object3d.matrix.premultiply(invMatrixChangeUpVectorZtoY);
            } else if (gltfUpAxis === 'X') {
                object3d.matrix.premultiply(invMatrixChangeUpVectorZtoX);
            }
            object3d.applyMatrix4(new Matrix4());
        }

        if (object3d) {
            object3d.name = `${obj.name} volume`;
            const result = { object3d, absolute };
            (obj as HasBoundingVolumeHelper).boundingVolumeHelper = result;
            return result;
        }

        return null;
    }

    /**
     * Create a grid on the XZ plane.
     *
     * @param origin - The grid origin.
     * @param size - The size of the grid.
     * @param subdivs - The number of grid subdivisions.
     */
    static createGrid(origin: Vector3, size: number, subdivs: number) {
        const grid = new GridHelper(size, subdivs);
        grid.name = 'grid';

        // Rotate the grid to be in the XZ plane.
        grid.rotateX(Math.PI / 2);
        grid.position.copy(origin);
        grid.updateMatrixWorld();

        return grid;
    }

    /**
     * Create an axis helper.
     *
     * @param size - The size of the helper.
     */
    static createAxes(size: number) {
        const axes = new AxesHelper(size);
        // We want the axes to be always visible,
        // and rendered on top of any other object in the scene.
        axes.renderOrder = 9999;
        (axes.material as Material).depthTest = false;
        return axes;
    }

    static remove3DTileBoundingVolume(obj: Object3D) {
        if (hasBoundingVolumeHelper(obj)) {
            // The helper is not necessarily attached to the object, in the
            // case of helpers with absolute position.
            const obj3d = obj.boundingVolumeHelper.object3d;
            obj3d.removeFromParent();

            obj3d.geometry?.dispose();
            obj3d.material?.dispose();
            // @ts-expect-error cannot remove "mandatory" property
            delete obj.boundingVolumeHelper;
        }
    }

    static update3DTileBoundingVolume(obj: Object3D, properties: { color: Color }) {
        if (!hasBoundingVolumeHelper(obj)) {
            return;
        }
        if (properties.color != null) {
            obj.boundingVolumeHelper.object3d.material.color = properties.color;
        }
    }

    /**
     * Creates an arrow between the two points.
     *
     * @param start - The starting point.
     * @param end - The end point.
     */
    static createArrow(start: Vector3, end: Vector3) {
        const length = start.distanceTo(end);
        const dir = end.sub(start).normalize();
        const arrow = new ArrowHelper(dir, start, length);
        return arrow;
    }

    /**
     * Removes an existing bounding box from the object, if any.
     *
     * @param obj - The object to update.
     * @example
     * Helpers.removeBoundingBox(obj);
     */
    static removeBoundingBox(obj: Object3D) {
        if (hasVolumeHelper(obj)) {
            const volumeHelper = (obj as HasVolumeHelper).volumeHelper;
            obj.remove(volumeHelper);
            volumeHelper.dispose();
            // @ts-expect-error cannot remove "mandatory" property
            delete obj.volumeHelper;
        }
    }
}

export default Helpers;
