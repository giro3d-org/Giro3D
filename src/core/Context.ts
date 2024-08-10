import { Plane, Vector3 } from 'three';
import type Entity from '../entities/Entity';
import type View from '../renderer/View';
import type Instance from './Instance';

/**
 * Contains the render/update loop context.
 * Each {@link Entity} being updated is given a
 * context in its update methods.
 * This context can be modified by entities (notably the near and far clipping planes).
 *
 */
class Context {
    /**
     * The view.
     */
    readonly view: View;
    /**
     * The Giro3D instance
     */
    readonly instance: Instance;

    /**
     * Contains clipping plane distances.
     */
    readonly distance: {
        /**  The plane that is normal to the line of sight. */
        plane: Plane;
        /** The minimum distance to the camera */
        min: number;
        /** The maximum distance to the camera */
        max: number;
    };

    /**
     * Attribute allowing processing code to remember whether they
     * did a full update (in which case the value is `undefined`)
     * or a partial update and to act accordingly.
     *
     * @internal
     */
    fastUpdateHint: unknown;
    private _entity: Entity;
    /**
     * Current entity being updated.
     */
    get entity() {
        return this._entity;
    }

    /**
     * Constructs a context.
     *
     * @param view - the view.
     * @param instance - the Giro3D instance.
     */
    constructor(view: View, instance: Instance) {
        this.view = view;

        this.instance = instance;

        this.distance = {
            plane: new Plane().setFromNormalAndCoplanarPoint(
                view.camera.getWorldDirection(new Vector3()),
                view.camera.position /* TODO matrixWorld */,
            ),
            min: Infinity,
            max: 0,
        };

        this.fastUpdateHint = undefined;
    }

    resetForEntity(entity: Entity): void {
        this.fastUpdateHint = undefined;
        this._entity = entity;
    }
}

export default Context;
