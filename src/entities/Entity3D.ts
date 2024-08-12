import { Box3, type Material, type Mesh, type Object3D, type Plane, type Vector2 } from 'three';

import type Context from '../core/Context';
import type Instance from '../core/Instance';
import { type ObjectToUpdate } from '../core/MainLoop';
import type MemoryUsage from '../core/MemoryUsage';
import { type GetMemoryUsageContext } from '../core/MemoryUsage';
import type Pickable from '../core/picking/Pickable';
import pickObjectsAt from '../core/picking/PickObjectsAt';
import type PickOptions from '../core/picking/PickOptions';
import type PickResult from '../core/picking/PickResult';
import type RenderingContextHandler from '../renderer/RenderingContextHandler';
import Entity, { type EntityEventMap, type EntityUserData } from './Entity';

export interface Entity3DEventMap extends EntityEventMap {
    /**
     * Fired when the entity opacity changed.
     */
    'opacity-property-changed': { opacity: number };
    /**
     * Fired when the entity visibility changed.
     */
    'visible-property-changed': { visible: boolean };
    /**
     * Fired when the entity's clipping planes have changed.
     */
    'clippingPlanes-property-changed': { clippingPlanes: Plane[] };
    /**
     * Fired when the entity render order changed.
     */
    'renderOrder-property-changed': { renderOrder: number };
    /**
     * Fired when the entity creates a new object
     */
    'object-created': { obj: Object3D };
}

/**
 * Base class for any {@link Entity} that displays 3D objects.
 *
 * Subclasses *must* call `onObjectCreated` when creating new Object3D, before adding them to the
 * scene
 */
class Entity3D<TEventMap extends Entity3DEventMap = Entity3DEventMap, TUserData = EntityUserData>
    extends Entity<TEventMap & Entity3DEventMap, TUserData>
    implements Pickable, MemoryUsage, RenderingContextHandler
{
    readonly isMemoryUsage = true as const;

    readonly type: string = 'Entity3D' as const;

    readonly isPickable = true;
    /**
     * Read-only flag to check if a given object is of type Entity3D.
     */
    readonly isEntity3D: boolean = true as const;

    protected _instance: Instance;
    private _visible: boolean;
    private _opacity: number;
    private _object3d: Object3D;
    protected _distance: { min: number; max: number };
    public get distance(): { min: number; max: number } {
        return { min: this._distance.min, max: this._distance.max };
    }
    private _clippingPlanes: Plane[];
    private _renderOrder: number;

    /**
     * Creates a Entity3D with the specified parameters.
     *
     * @param object3d - the root Three.js of this entity
     */
    constructor(object3d: Object3D) {
        super();
        if (!object3d || !object3d.isObject3D) {
            throw new Error(
                'Missing/Invalid object3d parameter (must be a three.js Object3D instance)',
            );
        }
        this._instance = null; // will be filled when we add the object to an instance

        if (object3d.type === 'Group' && object3d.name === '') {
            object3d.name = this.id;
        }

        this._visible = true;
        this._opacity = 1;
        this._object3d = object3d;

        // processing can overwrite that with values calculating from this layer's Object3D
        this._distance = { min: Infinity, max: 0 };

        this._clippingPlanes = null;

        this._renderOrder = 0;

        this.onObjectCreated(object3d);
    }

    getMemoryUsage(_context: GetMemoryUsageContext) {
        // Do nothing
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onRenderingContextLost(options: { canvas: HTMLCanvasElement }): void {
        /* Do nothing */
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onRenderingContextRestored(options: { canvas: HTMLCanvasElement }) {
        /* Do nothing */
    }

    /**
     * Returns the root object of this entity.
     */
    get object3d() {
        return this._object3d;
    }

    /**
     * Gets or sets the visibility of this entity.
     * A non-visible entity will not be automatically updated.
     */
    get visible() {
        return this._visible;
    }

    set visible(v) {
        if (this._visible !== v) {
            this._visible = v;
            this.updateVisibility();
            this.dispatchEvent({ type: 'visible-property-changed', visible: v });
        }
    }

    /**
     * Gets or sets the render order of this entity.
     */
    get renderOrder() {
        return this._renderOrder;
    }

    set renderOrder(v: number) {
        if (v !== this._renderOrder) {
            this._renderOrder = v;
            this.updateRenderOrder();
            this.dispatchEvent({ type: 'renderOrder-property-changed', renderOrder: v });
        }
    }

    /**
     * Gets or sets the opacity of this entity.
     */
    get opacity() {
        return this._opacity;
    }

    set opacity(v) {
        if (this._opacity !== v) {
            this._opacity = v;
            this.updateOpacity();
            this.dispatchEvent({ type: 'opacity-property-changed', opacity: v });
        }
    }

    /**
     * Gets or sets the clipping planes set on this entity. Default is `null` (no clipping planes).
     *
     * Note: custom entities must ensure that the materials and shaders used do support
     * the [clipping plane feature](https://threejs.org/docs/index.html?q=materi#api/en/materials/Material.clippingPlanes) of three.js.
     * Refer to the three.js documentation for more information.
     */
    get clippingPlanes() {
        return this._clippingPlanes;
    }

    set clippingPlanes(planes: Plane[]) {
        this._clippingPlanes = planes;
        this.updateClippingPlanes();
        this.dispatchEvent({ type: 'clippingPlanes-property-changed', clippingPlanes: planes });
    }

    /**
     * Updates the visibility of the entity.
     * Note: this method can be overriden for custom implementations.
     *
     */
    updateVisibility() {
        // Default implementation
        if (this.object3d) {
            this.object3d.visible = this.visible;
        }
    }

    /**
     * Updates the opacity of the entity.
     * Note: this method can be overriden for custom implementations.
     */
    updateOpacity() {
        // Default implementation
        this.traverseMaterials(material => {
            if (material.opacity != null) {
                // != null: we want the test to pass if opacity is 0
                const currentTransparent = material.transparent;
                material.transparent = this.opacity < 1.0;
                material.needsUpdate = currentTransparent !== material.transparent;
                material.opacity = this.opacity;
            }
        });
    }

    /**
     * Updates the render order of the entity.
     * Note: this method can be overriden for custom implementations.
     */
    updateRenderOrder() {
        // Default implementation
        this.traverse(o => {
            o.renderOrder = this.renderOrder;
        });
    }

    /**
     * Updates the clipping planes of all objects under this entity.
     */
    updateClippingPlanes() {
        this.traverseMaterials(mat => {
            mat.clippingPlanes = this._clippingPlanes;
        });
    }

    shouldCheckForUpdate(): boolean {
        return super.shouldCheckForUpdate() && this._visible;
    }

    shouldFullUpdate(updateSource: unknown): boolean {
        return super.shouldFullUpdate(updateSource) || this.contains(updateSource);
    }

    shouldUpdate(updateSource: unknown): boolean {
        return super.shouldUpdate(updateSource) || this.isOwned(updateSource);
    }

    /**
     * Returns true if this object belongs to this entity.
     *
     * @param obj - The object to test.
     */
    protected isOwned(obj: unknown) {
        if ((obj as Object3D).isObject3D) {
            const obj3d = obj as Object3D;
            if (obj3d.userData?.parentEntity === this) {
                return true;
            }
        }

        return false;
    }

    preUpdate(context: Context, changeSources: Set<unknown>): unknown[] | null {
        if (changeSources.size > 0) {
            // if we don't have any element in srcs, it means we don't need to update
            // our layer to display it correctly.  but in this case we still need to
            // use layer._distance to calculate near / far hence the reset is here,
            // and the update of context.distance is outside of this if
            this._distance.min = Infinity;
            this._distance.max = 0;
        }
        return null;
    }

    /**
     * Returns an approximated bounding box of this entity in the scene.
     *
     * @returns the resulting bounding box, or `null` if it could not be computed.
     */
    getBoundingBox(): Box3 | null {
        if (this.object3d) {
            const box = new Box3().setFromObject(this.object3d);
            return box;
        }

        return null;
    }

    /**
     * Applies entity-level setup on new object's material.
     *
     * Subclasses can override this to setup custom logic, for instance if the entity can produce
     * objects that are naturally transparent.
     *
     * @param material - the material of the newly created object
     */
    protected setupMaterial(material: Material) {
        material.clippingPlanes = this._clippingPlanes;
        material.opacity = this._opacity;
        if (material.opacity < 1.0) {
            material.transparent = true;
        }
    }

    /**
     * Applies entity-level setup on a new object.
     *
     * Note: this method should be called from the subclassed entity to notify the parent
     * class that a new 3D object has just been created, so that it can be setup with entity-wide
     * parameters.
     *
     * @example
     * // In the subclass
     * const obj = new Object3D();
     *
     * // Notify the parent class
     * this.onObjectCreated(obj);
     * @param obj - The object to prepare.
     */
    protected onObjectCreated(obj: Object3D) {
        // note: we use traverse() because the object might have its own sub-hierarchy as well.

        this.traverse(o => {
            // To be able to link an object to its parent entity (e.g for picking purposes)
            o.userData.parentEntity = this;
            o.renderOrder = this.renderOrder;
        }, obj);

        // Setup materials
        this.traverseMaterials(m => this.setupMaterial(m), obj);
        // dispatch event
        this.dispatchEvent({ type: 'object-created', obj });
    }

    /* eslint-disable class-methods-use-this */
    /**
     * Attached layers expect to receive the visual representation of a layer (= THREE object
     * with a material).  So if a layer's update function don't process this kind of object, the
     * layer must provide a getObjectToUpdateForAttachedLayers function that returns the correct
     * object to update for attached layer from the objects returned by preUpdate.
     *
     * @param obj - the Mesh or the object containing a Mesh. These are the objects returned
     * by preUpdate or update.
     * @returns an object passed to the update function of attached layers.
     */
    getObjectToUpdateForAttachedLayers(obj: any): ObjectToUpdate | null {
        if (!obj.parent || !obj.material) {
            return null;
        }
        return {
            element: obj,
            parent: obj.parent,
        };
    }
    /* eslint-enable class-methods-use-this */

    /**
     * Test whether this entity contains the given object.
     *
     * The object may be a component of the entity, or a 3D object.
     *
     * @param obj - The object to test.
     * @returns true if the entity contains the object.
     */
    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
    contains(obj: unknown): boolean {
        return false;
    }

    /**
     * Traverses all materials in the hierarchy of this entity.
     *
     * @param callback - The callback.
     * @param root - The traversal root. If undefined, the traversal starts at the root
     * object of this entity.
     */
    traverseMaterials(callback: (arg0: Material) => void, root: Object3D = undefined) {
        this.traverse((o: any) => {
            if (Array.isArray(o.material)) {
                o.material.forEach((m: Material) => callback(m));
            } else if (o.material) {
                callback(o.material as Material);
            }
        }, root);
    }

    /**
     * Traverses all meshes in the hierarchy of this entity.
     *
     * @param callback - The callback.
     * @param root - The raversal root. If undefined, the traversal starts at the root
     * object of this entity.
     */
    traverseMeshes(callback: (arg0: Mesh) => void, root: Object3D = undefined) {
        const origin = root ?? this.object3d;

        if (origin) {
            origin.traverse(o => {
                if ((o as Mesh).isMesh) {
                    callback(o as Mesh);
                }
            });
        }
    }

    /**
     * Traverses all objects in the hierarchy of this entity.
     *
     * @param callback - The callback.
     * @param root - The traversal root. If undefined, the traversal starts at the root
     * object of this entity.
     */
    traverse(callback: (arg0: Object3D) => void, root: Object3D = undefined) {
        const origin = root ?? this.object3d;

        if (origin) {
            origin.traverse(callback);
        }
    }

    pick(canvasCoords: Vector2, options?: PickOptions): PickResult[] {
        return pickObjectsAt(this._instance, canvasCoords, this.object3d, options);
    }
}

export function isEntity3D(o: unknown): o is Entity3D {
    return (o as Entity3D).isEntity3D;
}

export default Entity3D;
