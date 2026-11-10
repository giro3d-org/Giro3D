/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { OrthographicCamera, PerspectiveCamera } from 'three';

import {
    Clock,
    EventDispatcher,
    Group,
    Object3D,
    Scene,
    Vector2,
    type ColorRepresentation,
    type WebGLRenderer,
    type WebGLRendererParameters,
} from 'three';

import type Entity from '../entities/Entity';
import type Entity3D from '../entities/Entity3D';
import type C3DEngine from '../renderer/c3DEngine';
import type RenderingOptions from '../renderer/RenderingOptions';
import type CoordinateSystem from './geographic/CoordinateSystem';
import type PickOptions from './picking/PickOptions';
import type PickResult from './picking/PickResult';

import { isEntity } from '../entities/Entity';
import { isEntity3D } from '../entities/Entity3D';
import View from '../renderer/View';
import { isDisposable } from './Disposable';
import MainLoop from './MainLoop';
import { isPickable } from './picking/Pickable';
import { isPickableFeatures } from './picking/PickableFeatures';
import pickObjectsAt from './picking/PickObjectsAt';

function isObject3D(o: unknown): o is Object3D {
    return (o as Object3D).isObject3D;
}

const pickVec2 = new Vector2();

/** Frame event payload */
export interface FrameEventPayload {
    /** The frame number. */
    frame: number;
    /** Time elapsed since previous update loop, in milliseconds */
    dt: number;
    /** `true` if the update loop restarted */
    updateLoopRestarted: boolean;
}

/** Entity event payload */
export interface EntityEventPayload {
    /** Entity */
    entity: Entity;
}

/**
 * Options for picking objects from a Giro3D {@link InstanceBase}.
 */
export interface PickObjectsAtOptions extends PickOptions {
    /**
     * List of entities to pick from.
     * If not provided, will pick from all the objects in the scene.
     * Strings consist in the IDs of the object.
     */
    where?: (string | Object3D | Entity)[];
    /**
     * Indicates if the results should be sorted by distance, as Three.js raycasting does.
     * This prevents the `limit` option to be fully used as it is applied after sorting,
     * thus it may be slow and is disabled by default.
     *
     * @defaultValue false
     */
    sortByDistance?: boolean;
    /**
     * Indicates if features information are also retrieved from the picked object.
     * On complex objects, this may be slow, and therefore is disabled by default.
     *
     * @defaultValue false
     */
    pickFeatures?: boolean;
}

/**
 * Events supported by
 * [`Instance.addEventListener()`](https://threejs.org/docs/#api/en/core/EventDispatcher.addEventListener)
 * and
 * [`Instance.removeEventListener()`](https://threejs.org/docs/#api/en/core/EventDispatcher.removeEventListener)
 */
export interface InstanceEvents {
    /**
     * Fires when an entity is added to the instance.
     */
    'entity-added': EntityEventPayload;
    /**
     * Fires when an entity is removed from the instance.
     */
    'entity-removed': EntityEventPayload;
    /**
     * Fires at the start of the update
     */
    'update-start': FrameEventPayload;
    /**
     * Fires before the camera update
     */
    'before-camera-update': { camera: View } & FrameEventPayload;
    /**
     * Fires after the camera update
     */
    'after-camera-update': { camera: View } & FrameEventPayload;
    /**
     * Fires before the entity update
     */
    'before-entity-update': EntityEventPayload & FrameEventPayload;
    /**
     * Fires after the entity update
     */
    'after-entity-update': EntityEventPayload & FrameEventPayload;
    /**
     * Fires before the render
     */
    'before-render': FrameEventPayload;
    /**
     * Fires after the render
     */
    'after-render': FrameEventPayload;
    /**
     * Fires at the end of the update
     */
    'update-end': FrameEventPayload;
    'picking-start': unknown;
    'picking-end': {
        /**
         * The duration of the picking, in seconds.
         */
        elapsed: number;
        /**
         * The picking results.
         */
        results?: PickResult<unknown>[];
    };
    /**
     * Fires when the instance is disposed.
     */
    dispose: unknown;
}

/** Options shared by {@link Instance} and {@link OffscreenInstance}. */
export interface InstanceBaseOptions {
    /**
     * The coordinate reference system of the scene.
     * Must be a cartesian system.
     * Must first be registered via {@link CoordinateSystem.register}
     */
    crs: CoordinateSystem;
    /**
     * The [Three.js Scene](https://threejs.org/docs/#api/en/scenes/Scene) instance to use,
     * otherwise a default one will be constructed
     */
    scene3D?: Scene;
    /**
     * The background color of the canvas. If `null`, the canvas is transparent.
     * If `undefined`, the default color is used.
     * @defaultValue `'#030508'`
     */
    backgroundColor?: ColorRepresentation | null;
    /**
     * The renderer to use. Might be either an instance of an existing {@link WebGLRenderer},
     * or options to create one. If `undefined`, a new one will be created with default parameters.
     */
    renderer?: WebGLRenderer | WebGLRendererParameters;
    /**
     * The THREE camera to use
     */
    camera?: PerspectiveCamera | OrthographicCamera;
}

/**
 * Shared implementation behind {@link Instance} (renders into a DOM `<div>`/canvas, supports
 * entities and interaction) and {@link OffscreenInstance} (a render-only primitive into a
 * caller-supplied `OffscreenCanvas`, no DOM, no entity system). Holds just the engine/scene/view
 * plumbing both need.
 */
abstract class InstanceBase extends EventDispatcher<InstanceEvents> {
    protected readonly _referenceCrs: CoordinateSystem;
    protected readonly _engine: C3DEngine;
    protected readonly _scene: Scene;
    protected readonly _view: View;
    protected readonly _mainLoop: MainLoop;
    protected readonly _threeObjects: Group;
    protected readonly _entities: Set<Entity>;
    protected _disposed = false;
    private readonly _pickingClock: Clock;

    protected constructor(engine: C3DEngine, options: InstanceBaseOptions) {
        super();
        Object3D.DEFAULT_UP.set(0, 0, 1);

        this._referenceCrs = options.crs;
        this._engine = engine;

        this._scene = options.scene3D || new Scene();
        if (!options.scene3D) {
            this._scene.matrixWorldAutoUpdate = false;
        }

        const windowSize = this._engine.getWindowSize();

        this._view = new View({
            crs: this._referenceCrs,
            renderer: this._engine.renderer,
            camera: options.camera,
            width: windowSize.width,
            height: windowSize.height,
        });

        this._view.addEventListener('change', () => this.notifyChange(this._view.camera));

        this._mainLoop = new MainLoop();

        // will contain simple three objects that need to be taken into
        // account, for example camera near / far calculation maybe it'll be
        // better to do the contrary: having a group where *all* the Giro3D
        // object will be added, and traverse all other objects for near far
        // calculation but actually I'm not even sure near far calculation is
        // worthy of this.
        this._threeObjects = new Group();
        this._threeObjects.name = 'threeObjects';
        this._scene.add(this._threeObjects);

        this._entities = new Set();

        this._pickingClock = new Clock(false);
    }

    /** Gets the CRS used in this instance. */
    public get coordinateSystem(): CoordinateSystem {
        return this._referenceCrs;
    }

    /** Gets the rendering engine */
    public get engine(): C3DEngine {
        return this._engine;
    }

    /**
     * Gets the rendering options.
     *
     * Note: you must call {@link notifyChange | notifyChange()} (on {@link Instance}) to take
     * the changes into account.
     */
    public get renderingOptions(): RenderingOptions {
        return this._engine.renderingOptions;
    }

    /**
     * Gets the underlying WebGL renderer.
     */
    public get renderer(): WebGLRenderer {
        return this._engine.renderer;
    }

    /** Gets the [3D Scene](https://threejs.org/docs/#api/en/scenes/Scene). */
    public get scene(): Scene {
        return this._scene;
    }

    /** Gets the view. */
    public get view(): View {
        return this._view;
    }

    /** Gets the main loop */
    public get mainLoop(): MainLoop {
        return this._mainLoop;
    }

    /** Gets the group containing native Three.js objects. */
    public get threeObjects(): Group {
        return this._threeObjects;
    }

    /**
     * Hook for subclass cleanup that must run before the shared teardown (entities, three
     * objects, engine, view). No-op by default.
     */
    protected onBeforeDispose(): void {}

    /**
     * Hook for subclass cleanup that must run after the shared teardown but before the
     * `dispose` event fires. No-op by default.
     */
    protected onAfterDispose(): void {}

    /**
     * Dispose of this instance object. Free all memory used.
     */
    public dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;

        this.onBeforeDispose();

        for (const obj of this.getObjects()) {
            this.remove(obj);
        }
        this._scene.remove(this._threeObjects);

        this._engine.dispose();
        this._view.dispose();

        this.onAfterDispose();

        this.dispatchEvent({ type: 'dispose' });
    }

    /**
     * Executes the rendering.
     * Internal use only.
     *
     * @internal
     */
    public render(): void {
        this._engine.render(this._scene, this._view.camera);
    }

    /**
     * Add THREE object or Entity to the instance.
     *
     * If the object or entity has no parent, it will be added to the default tree (i.e under
     * `.scene` for entities and under `.threeObjects` for regular Object3Ds.).
     *
     * If the object or entity already has a parent, then it will not be changed. Check that this
     * parent is present in the scene graph (i.e has the `.scene` object as ancestor), otherwise it
     * will **never be displayed**.
     *
     * @example
     * // Add Map to instance
     * instance.add(new Map(...);
     *
     * // Add Map to instance then wait for the map to be ready.
     * instance.add(new Map(...).then(...);
     * @param object - the object to add
     * @returns a promise resolved with the new layer object when it is fully initialized
     * or rejected if any error occurred.
     */
    public async add<T extends Object3D | Entity>(object: T): Promise<T> {
        if (object == null) {
            throw new Error('object is undefined');
        }

        if (!isObject3D(object) && !isEntity(object)) {
            throw new Error('object is not an instance of THREE.Object3D or Giro3D.Entity');
        }

        if (isObject3D(object)) {
            // case of a simple THREE.js object3D
            const object3d = object as Object3D;
            if (object.parent == null) {
                // Add to default scene graph
                this._threeObjects.add(object3d);
            }
            this.notifyChange(object3d);
            return object3d as T;
        }

        // We know it's an Entity
        const entity = object as Entity;

        const duplicate = this.getObjects(l => l.id === object.id);
        if (duplicate.length > 0) {
            throw new Error(`Invalid id '${object.id}': id already used`);
        }

        this._entities.add(entity);

        await entity.initialize({
            instance: this,
        });

        if (
            isEntity3D(entity) &&
            entity.object3d != null &&
            entity.object3d.parent == null &&
            entity.object3d !== this._scene
        ) {
            // Add to default scene graph
            this._scene.add(entity.object3d);
        }

        this.notifyChange(object, { needsRedraw: false });
        this.dispatchEvent({ type: 'entity-added', entity });
        return object;
    }

    /**
     * Removes the entity or THREE object from the scene.
     *
     * @param object - the object to remove.
     */
    public remove(object: Object3D | Entity): void {
        if (isDisposable(object)) {
            object.dispose();
        }

        if (isEntity(object)) {
            if (isEntity3D(object)) {
                object.object3d.removeFromParent();
            }

            this._entities.delete(object);

            this.dispatchEvent({ type: 'entity-removed', entity: object });
        } else if (isObject3D(object)) {
            object.removeFromParent();
        }

        this.notifyChange(this._view.camera);
    }

    /**
     * Notifies the scene it needs to be updated due to changes exterior to the
     * scene itself (e.g. camera movement).
     * non-interactive events (e.g: texture loaded)
     *
     * @param changeSources - The source(s) of the change. Might be a single object or an array.
     * @param options - Notification options.
     */
    public notifyChange(
        changeSources: unknown | unknown[] = undefined,
        options?: {
            /**
             * Should we render the scene?
             * @defaultValue true
             */
            needsRedraw?: boolean;
            /**
             * Should the update be immediate? If `false`, the update is deferred to the
             * next animation frame.
             * @defaultValue false
             */
            immediate?: boolean;
        },
    ): void {
        this._mainLoop.scheduleUpdate(this, changeSources, options);
    }

    /**
     * Get all top-level objects (entities and regular THREE objects), using an optional filter
     * predicate.
     *
     * ```js
     * // get all objects
     * const allObjects = instance.getObjects();
     * // get all object whose name includes 'foo'
     * const fooObjects = instance.getObjects(obj => obj.name === 'foo');
     * ```
     * @param filter - the optional filter predicate.
     * @returns an array containing the queried objects
     */
    public getObjects(filter?: (obj: Object3D | Entity) => boolean): (Object3D | Entity)[] {
        const result = [];
        for (const obj of this._entities) {
            if (!filter || filter(obj)) {
                result.push(obj);
            }
        }
        for (const obj of this._threeObjects.children) {
            if (!filter || filter(obj)) {
                result.push(obj);
            }
        }
        return result;
    }

    /**
     * Get all entities, with an optional predicate applied.
     *
     * ```js
     * // get all entities
     * const allEntities = instance.getEntities();
     *
     * // get all entities whose name contains 'building'
     * const buildings = instance.getEntities(entity => entity.name.includes('building'));
     * ```
     * @param filter - the optional filter predicate
     * @returns an array containing the queried entities
     */
    public getEntities(filter?: (obj: Entity) => boolean): Entity[] {
        const result = [];

        for (const obj of this._entities) {
            if (!filter || filter(obj)) {
                result.push(obj);
            }
        }

        return result;
    }

    /**
     * Gets the object by it's id property.
     *
     * @param objectId - Object id
     * @returns Object found
     * @throws Error if object cannot be found
     */
    private objectIdToObject(objectId: string | number): Object3D | Entity {
        const lookup = this.getObjects(l => l.id === objectId);
        if (!lookup.length) {
            throw new Error(`Invalid object id used as where argument (value = ${objectId})`);
        }
        return lookup[0];
    }

    /**
     * Return objects from some layers/objects3d under the given canvas coordinates.
     *
     * @param canvasCoords - canvas coordinates (in pixels, 0-0 = top-left of the instance)
     * @param options - Options
     * @returns An array of objects. Each element contains at least an object
     * property which is the Object3D under the cursor. Then depending on the queried
     * layer/source, there may be additionnal properties (coming from THREE.Raycaster
     * for instance).
     * If `options.pickFeatures` if `true`, `features` property may be set.
     *
     * ```js
     * instance.pickObjectsAt(canvasCoords)
     * instance.pickObjectsAt(canvasCoords, { radius: 1, where: [entity0, entity1] })
     * instance.pickObjectsAt(canvasCoords, { radius: 3, where: [entity0] })
     * ```
     */
    public pickObjectsAt(canvasCoords: Vector2, options: PickObjectsAtOptions = {}): PickResult[] {
        this.dispatchEvent({ type: 'picking-start' });
        this._pickingClock.start();

        let results: PickResult[] = [];
        const sources =
            options.where && options.where.length > 0 ? [...options.where] : this.getObjects();
        const radius = options.radius ?? 0;
        const limit = options.limit ?? Infinity;
        const sortByDistance = options.sortByDistance ?? false;
        const pickFeatures = options.pickFeatures ?? false;

        for (const source of sources) {
            const object = typeof source === 'string' ? this.objectIdToObject(source) : source;

            if (!(object as Object3D | Entity3D).visible) {
                continue;
            }

            const pickOptions = {
                ...options,
                radius,
                limit: limit - results.length,
                vec2: pickVec2,
                sortByDistance: false,
            };
            if (sortByDistance) {
                pickOptions.limit = Infinity;
                pickOptions.pickFeatures = false;
            }

            if (isPickable(object)) {
                const res = object.pick(canvasCoords, pickOptions);
                results.push(...res);
            } else if ((object as Object3D).isObject3D) {
                const res = pickObjectsAt(this, canvasCoords, object as Object3D, pickOptions);
                results.push(...res);
            }

            if (results.length >= limit && !sortByDistance) {
                break;
            }
        }

        if (sortByDistance) {
            results.sort((a, b) => a.distance - b.distance);
            if (limit !== Infinity) {
                results = results.slice(0, limit);
            }
        }

        if (pickFeatures) {
            const pickFeaturesOptions = options;

            results.forEach(result => {
                if (result.entity && isPickableFeatures(result.entity)) {
                    result.entity.pickFeaturesFrom(result, pickFeaturesOptions);
                } else if (result.object != null && isPickableFeatures(result.object)) {
                    result.object.pickFeaturesFrom(result, pickFeaturesOptions);
                }
            });
        }

        const elapsed = this._pickingClock.getElapsedTime();
        this._pickingClock.stop();
        this.dispatchEvent({ type: 'picking-end', elapsed, results });

        return results;
    }

    /**
     * Convert canvas coordinates to normalized device coordinates (NDC).
     *
     * @param canvasCoords - (in pixels, 0-0 = top-left of the instance)
     * @param target - The target to set with the result.
     * @returns NDC coordinates (x and y are [-1, 1])
     */
    public canvasToNormalizedCoords(canvasCoords: Vector2, target: Vector2): Vector2 {
        target.x = 2 * (canvasCoords.x / this._view.width) - 1;
        target.y = -2 * (canvasCoords.y / this._view.height) + 1;
        return target;
    }

    /**
     * Convert NDC coordinates to canvas coordinates.
     *
     * @param ndcCoords - The NDC coordinates to convert
     * @param target - The target to set with the result.
     * @returns canvas coordinates (in pixels, 0-0 = top-left of the instance)
     */
    public normalizedToCanvasCoords(ndcCoords: Vector2, target: Vector2): Vector2 {
        target.x = (ndcCoords.x + 1) * 0.5 * this._view.width;
        target.y = (ndcCoords.y - 1) * -0.5 * this._view.height;
        return target;
    }
}

export default InstanceBase;
