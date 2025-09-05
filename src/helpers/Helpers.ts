/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type {
    BufferGeometry,
    LineBasicMaterial,
    LineSegments,
    MeshBasicMaterial,
    Object3D,
} from 'three';
import type { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

import {
    ArrowHelper,
    AxesHelper,
    Box3,
    Box3Helper,
    Color,
    GridHelper,
    Mesh,
    Vector3,
    type Material,
} from 'three';

import { isMaterial, isObject } from '../utils/predicates';
import { nonNull } from '../utils/tsutils';

export class SphereHelper extends Mesh<BufferGeometry, MeshBasicMaterial> {
    public readonly isHelper = true;
}

export class BoundingBoxHelper extends Box3Helper {
    public readonly isHelper = true;
    public readonly isvolumeHelper = true;
}

interface HasBoundingBox extends Object3D {
    boundingBox: Box3;
}

interface HasBoundingBoxHelper extends Object3D {
    volumeHelper: BoundingBoxHelper;
}

function hasBoundingBoxHelper(obj: unknown): obj is HasBoundingBoxHelper {
    return isObject(obj) && (obj as HasBoundingBoxHelper).volumeHelper != null;
}

interface HasSelectionHelper extends Object3D {
    selectionHelper: BoundingBoxHelper;
}

interface HasBoundingVolumeHelper extends Object3D {
    boundingVolumeHelper: {
        object3d:
            | SphereHelper
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
let _axisSize = 500;

/**
 * @param colorDesc - A THREE color or hex string.
 * @returns The THREE color.
 */
function getColor(colorDesc: Color | string): Color {
    if (typeof colorDesc === 'string' || colorDesc instanceof String) {
        return new Color(colorDesc);
    }

    return colorDesc;
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
    public static addBoundingBox(obj: Object3D, color: Color | string): void {
        // Don't add a bounding box helper to a bounding box helper !
        if ((obj as BoundingBoxHelper).isvolumeHelper) {
            return;
        }

        const helper = Helpers.createBoxHelper(makeLocalBbox(obj), getColor(color));
        obj.add(helper);
        (obj as HasBoundingBoxHelper).volumeHelper = helper;
        helper.updateMatrixWorld(true);
    }

    public static createBoxHelper(box: Box3, color: Color): BoundingBoxHelper {
        const helper = new BoundingBoxHelper(box, color);
        helper.name = 'bounding box';
        if (isMaterial(helper.material)) {
            helper.material.transparent = true;
            helper.material.needsUpdate = true;
        }
        return helper;
    }

    public static set axisSize(v: number) {
        _axisSize = v;
    }

    public static get axisSize(): number {
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
    public static createSelectionBox(obj: Object3D, color: Color): BoundingBoxHelper {
        const helper = Helpers.createBoxHelper(makeLocalBbox(obj), getColor(color));
        (obj as HasSelectionHelper).selectionHelper = helper;
        obj.add(helper);
        obj.updateMatrixWorld(true);
        return helper;
    }

    /**
     * Create a grid on the XZ plane.
     *
     * @param origin - The grid origin.
     * @param size - The size of the grid.
     * @param subdivs - The number of grid subdivisions.
     */
    public static createGrid(origin: Vector3, size: number, subdivs: number): GridHelper {
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
    public static createAxes(size: number): AxesHelper {
        const axes = new AxesHelper(size);
        // We want the axes to be always visible,
        // and rendered on top of any other object in the scene.
        axes.renderOrder = 9999;
        (axes.material as Material).depthTest = false;
        return axes;
    }

    /**
     * Creates an arrow between the two points.
     *
     * @param start - The starting point.
     * @param end - The end point.
     */
    public static createArrow(start: Vector3, end: Vector3): ArrowHelper {
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
    public static removeBoundingBox(obj: Object3D): void {
        if (hasBoundingBoxHelper(obj)) {
            const volumeHelper = (obj as HasBoundingBoxHelper).volumeHelper;
            obj.remove(volumeHelper);
            if ('dispose' in volumeHelper && typeof volumeHelper.dispose === 'function') {
                volumeHelper.dispose();
            }
            // @ts-expect-error cannot remove "mandatory" property
            delete obj.volumeHelper;
        }
    }
}

export default Helpers;
