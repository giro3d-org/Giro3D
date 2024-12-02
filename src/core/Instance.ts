import { register } from 'ol/proj/proj4.js';
import proj4 from 'proj4';
import {
    Clock,
    EventDispatcher,
    Group,
    Object3D,
    Scene,
    Vector2,
    Vector3,
    type ColorRepresentation,
    type WebGLRenderer,
    type WebGLRendererParameters,
} from 'three';
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type Entity from '../entities/Entity';
import { isEntity } from '../entities/Entity';
import Entity3D, { isEntity3D } from '../entities/Entity3D';
import Map from '../entities/Map';
import C3DEngine from '../renderer/c3DEngine';
import type RenderingOptions from '../renderer/RenderingOptions';
import { GlobalRenderTargetPool } from '../renderer/RenderTargetPool';
import View, { type CameraOptions } from '../renderer/View';
import { GlobalCache } from './Cache';
import { isDisposable } from './Disposable';
import MainLoop from './MainLoop';
import {
    aggregateMemoryUsage,
    getObject3DMemoryUsage,
    type GetMemoryUsageContext,
    type MemoryUsageReport,
} from './MemoryUsage';
import { isPickable } from './picking/Pickable';
import { isPickableFeatures } from './picking/PickableFeatures';
import pickObjectsAt from './picking/PickObjectsAt';
import type PickOptions from './picking/PickOptions';
import type PickResult from './picking/PickResult';
import type Progress from './Progress';

const vectors = {
    pos: new Vector3(),
    size: new Vector3(),
    evtToCanvas: new Vector2(),
    pickVec2: new Vector2(),
};

/** Frame event payload */
export type FrameEventPayload = {
    /** The frame number. */
    frame: number;
    /** Time elapsed since previous update loop, in milliseconds */
    dt: number;
    /** `true` if the update loop restarted */
    updateLoopRestarted: boolean;
};

/** Entity event payload */
export type EntityEventPayload = {
    /** Entity */
    entity: Entity;
};

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
    'entity-added': unknown;
    /**
     * Fires when an entity is removed from the instance.
     */
    'entity-removed': unknown;
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
}

/**
 * The names of events supported by
 * [`Instance.addEventListener()`](https://threejs.org/docs/#api/en/core/EventDispatcher.addEventListener)
 * and
 * [`Instance.removeEventListener()`](https://threejs.org/docs/#api/en/core/EventDispatcher.removeEventListener).
 *
 * @deprecated Use InstanceEvents instead.
 */
export const INSTANCE_EVENTS: Record<string, keyof InstanceEvents> = {
    ENTITY_ADDED: 'entity-added',
    ENTITY_REMOVED: 'entity-removed',
} as const;

/** Options for creating Instance */
export interface InstanceOptions extends CameraOptions {
    /**
     * The container for the instance. May be either the `id` of an existing `<div>` element,
     * or the element itself.
     */
    target: string | HTMLDivElement;
    /**
     * The coordinate reference system of the scene.
     * Must be a cartesian system.
     * Must first be registered via {@link Instance.registerCRS}
     */
    crs: string;
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
}

/**
 * Options for picking objects from the Giro3D {@link Instance}.
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

function isObject3D(o: unknown): o is Object3D {
    return (o as Object3D).isObject3D;
}

/**
 * The instance is the core component of Giro3D. It encapsulates the 3D scene,
 * the current camera and one or more {@link Entity | entities},
 * such as a {@link Map}.
 *
 * ```js
 * // Create a Giro3D instance in the EPSG:3857 coordinate system:
 * const instance = new Instance({
 *     target: 'view',
 *     crs: 'EPSG:3857',
 * });
 *
 * const map = new Map(...);
 *
 * // Add an entity to the instance
 * instance.add(map);
 *
 * // Bind an event listener on double click
 * instance.domElement.addEventListener('dblclick', () => console.log('double click!'));
 *
 * // Get the camera position
 * const position = instance.view.camera.position;
 *
 * // Set the camera position to be located 10,000 meters above the center of the coordinate system.
 * instance.view.camera.position.set(0, 0, 10000);
 * instance.view.camera.lookAt(lookAt);
 * ```
 */
class Instance extends EventDispatcher<InstanceEvents> implements Progress {
    private readonly _referenceCrs: string;
    private readonly _viewport: HTMLDivElement;
    private readonly _mainLoop: MainLoop;
    private readonly _engine: C3DEngine;
    private readonly _scene: Scene;
    private readonly _threeObjects: Group;
    private readonly _view: View;
    private readonly _entities: Set<Entity>;
    private readonly _resizeObserver?: ResizeObserver;
    private readonly _pickingClock: Clock;
    private readonly _onContextRestored: () => void;
    private readonly _onContextLost: () => void;
    private _resizeTimeout?: string | number | NodeJS.Timeout;
    private _disposed = false;

    /**
     * Constructs a Giro3D Instance
     *
     * @param options - Options
     *
     * ```js
     * const instance = new Instance({
     *   target: 'parentElement', // The id of the <div> to attach the instance
     *   crs: 'EPSG:3857',
     * });
     * ```
     */
    constructor(options: InstanceOptions) {
        super();
        Object3D.DEFAULT_UP.set(0, 0, 1);

        const target = options.target;
        let viewerDiv: HTMLElement | null = null;

        if (typeof target === 'string') {
            viewerDiv = document.getElementById(target);
        } else if (options.target instanceof HTMLElement) {
            viewerDiv = options.target;
        }

        if (!viewerDiv || !(viewerDiv instanceof HTMLDivElement)) {
            throw new Error('Invalid target parameter (must be a valid <div>)');
        }
        if (viewerDiv.childElementCount > 0) {
            console.warn(
                'Target element has children; Giro3D expects an empty element - this can lead to unexpected behaviors',
            );
        }

        if (!options.crs) {
            throw new Error('missing "crs" parameter');
        }
        this._referenceCrs = options.crs;
        this._viewport = viewerDiv;

        // viewerDiv may have padding/borders, which is annoying when retrieving its size
        // Wrap our canvas in a new div so we make sure the display
        // is correct whatever the page layout is
        // (especially when skrinking so there is no scrollbar/bleading)
        this._viewport = document.createElement('div');
        this._viewport.style.position = 'relative';
        this._viewport.style.overflow = 'hidden'; // Hide overflow during resizing
        this._viewport.style.width = '100%'; // Make sure it fills the space
        this._viewport.style.height = '100%';
        viewerDiv.appendChild(this._viewport);

        this._engine = new C3DEngine(this._viewport, {
            clearColor: options.backgroundColor,
            renderer: options.renderer,
        });

        this._mainLoop = new MainLoop();

        this._scene = options.scene3D || new Scene();
        // will contain simple three objects that need to be taken into
        // account, for example camera near / far calculation maybe it'll be
        // better to do the contrary: having a group where *all* the Giro3D
        // object will be added, and traverse all other objects for near far
        // calculation but actually I'm not even sure near far calculation is
        // worthy of this.
        this._threeObjects = new Group();
        this._threeObjects.name = 'threeObjects';

        this._scene.add(this._threeObjects);
        if (!options.scene3D) {
            this._scene.matrixWorldAutoUpdate = false;
        }

        this._view = new View(
            this._referenceCrs,
            this._engine.getWindowSize().x,
            this._engine.getWindowSize().y,
            options,
        );

        this._view.addEventListener('change', () => this.notifyChange(this._view.camera));

        this._entities = new Set();

        if (window.ResizeObserver != null) {
            this._resizeObserver = new ResizeObserver(() => {
                this._updateRendererSize(this.viewport);
            });
            this._resizeObserver.observe(viewerDiv);
        }

        this._pickingClock = new Clock(false);

        this._onContextRestored = this.onContextRestored.bind(this);
        this._onContextLost = this.onContextLost.bind(this);
        this.domElement.addEventListener('webglcontextlost', this._onContextLost);
        this.domElement.addEventListener('webglcontextrestored', this._onContextRestored);
    }

    private onContextLost() {
        this.getEntities().forEach(entity => {
            if (isEntity3D(entity)) {
                entity.onRenderingContextLost({ canvas: this.domElement });
            }
        });
    }

    private onContextRestored() {
        this.getEntities().forEach(entity => {
            if (isEntity3D(entity)) {
                entity.onRenderingContextRestored({ canvas: this.domElement });
            }
        });
        this.notifyChange();
    }

    /** Gets the canvas that this instance renders into. */
    get domElement(): HTMLCanvasElement {
        return this._engine.renderer.domElement;
    }

    /** Gets the DOM element that contains the Giro3D viewport. */
    get viewport(): HTMLDivElement {
        return this._viewport;
    }

    /** Gets the CRS used in this instance. */
    get referenceCrs(): string {
        return this._referenceCrs;
    }

    /** Gets whether at least one entity is currently loading data. */
    get loading(): boolean {
        const entities = this.getEntities();
        return entities.some(e => e.loading);
    }

    /**
     * Gets the progress (between 0 and 1) of the processing of the entire instance.
     * This is the average of the progress values of all entities.
     * Note: This value is only meaningful is {@link loading} is `true`.
     * Note: if no entity is present in the instance, this will always return 1.
     */
    get progress(): number {
        const entities = this.getEntities();
        if (entities.length === 0) {
            return 1;
        }
        const sum = entities.reduce((accum, entity) => accum + entity.progress, 0);
        return sum / entities.length;
    }

    /** Gets the main loop */
    get mainLoop(): MainLoop {
        return this._mainLoop;
    }

    /** Gets the rendering engine */
    get engine(): C3DEngine {
        return this._engine;
    }

    /**
     * Gets the rendering options.
     *
     * Note: you must call {@link notifyChange | notifyChange()} to take
     * the changes into account.
     */
    get renderingOptions(): RenderingOptions {
        return this._engine.renderingOptions;
    }

    /**
     * Gets the underlying WebGL renderer.
     */
    get renderer(): WebGLRenderer {
        return this._engine.renderer;
    }

    /**
     * Gets the underlying CSS2DRenderer.
     */
    get css2DRenderer(): CSS2DRenderer {
        return this._engine.labelRenderer;
    }

    /** Gets the [3D Scene](https://threejs.org/docs/#api/en/scenes/Scene). */
    get scene(): Scene {
        return this._scene;
    }

    /** Gets the group containing native Three.js objects. */
    get threeObjects(): Group {
        return this._threeObjects;
    }

    /** Gets the view. */
    get view(): View {
        return this._view;
    }

    private _doUpdateRendererSize(div: HTMLDivElement): void {
        this._engine.onWindowResize(div.clientWidth, div.clientHeight);
        this.notifyChange(this._view.camera);
    }

    private _updateRendererSize(div: HTMLDivElement): void {
        // Each time a canvas is resized, its content is erased and must be re-rendered.
        // Since we are only interested in the last size, we must discard intermediate
        // resizes to avoid the flickering effect due to the canvas going blank.

        if (this._resizeTimeout != null) {
            // If there's already a timeout in progress, discard it
            clearTimeout(this._resizeTimeout);
        }

        // And add another one
        this._resizeTimeout = setTimeout(() => this._doUpdateRendererSize(div), 50);
    }

    /**
     * Dispose of this instance object. Free all memory used.
     *
     * Note: this *will not* dispose the following reusable objects:
     * - controls (because they can be attached and detached). For THREE.js controls, use
     * `controls.dispose()`
     * - Inspectors, use `inspector.detach()`
     * - any openlayers objects, please see their individual documentation
     *
     */
    dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;

        this.domElement.removeEventListener('webglcontextlost', this._onContextLost);
        this.domElement.removeEventListener('webglcontextrestored', this._onContextRestored);

        this._resizeObserver?.disconnect();
        for (const obj of this.getObjects()) {
            this.remove(obj);
        }
        this._scene.remove(this._threeObjects);

        this._engine.dispose();
        this._view.dispose();
        this.viewport.remove();
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
    async add<T extends Object3D | Entity>(object: T): Promise<T> {
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
            entity instanceof Entity3D &&
            entity.object3d != null &&
            entity.object3d.parent == null &&
            entity.object3d !== this._scene
        ) {
            // Add to default scene graph
            this._scene.add(entity.object3d);
        }

        this.notifyChange(object, { needsRedraw: false });
        this.dispatchEvent({ type: 'entity-added' });
        return object;
    }

    /**
     * Removes the entity or THREE object from the scene.
     *
     * @param object - the object to remove.
     */
    remove(object: Object3D | Entity): void {
        if (isDisposable(object)) {
            object.dispose();
        }

        if (isEntity(object)) {
            if (isEntity3D(object)) {
                object.object3d.removeFromParent();
            }

            this._entities.delete(object);

            this.dispatchEvent({ type: 'entity-removed' });
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
    notifyChange(
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
     * Registers a new coordinate reference system.
     * This should be done before creating the instance.
     * This method can be called several times to add multiple CRS.
     *
     * ```js
     *  // register the CRS first...
     *  Instance.registerCRS(
     *  'EPSG:102115',
     *  '+proj=utm +zone=5 +ellps=clrk66 +units=m +no_defs +type=crs');
     *
     *  // ...then create the instance
     *  const instance = new Instance({ crs: 'EPSG:102115' });
     * ```
     * @param name - the short name, or EPSG code to identify this CRS.
     * @param value - the CRS definition, either in proj syntax, or in WKT syntax.
     */
    static registerCRS(name: string, value: string): void {
        if (!name || name === '') {
            throw new Error('missing CRS name');
        }
        if (!value || value === '') {
            throw new Error('missing CRS PROJ string');
        }

        try {
            // define the CRS with PROJ
            proj4.defs(name, value);
        } catch (e) {
            let message = '';
            if (e instanceof Error) {
                message = ': ' + e.message;
            }
            throw new Error(`failed to register PROJ definition for ${name}${message}`);
        }
        try {
            // register this CRS with OpenLayers
            register(proj4);
        } catch (e) {
            let message = '';
            if (e instanceof Error) {
                message = ': ' + e.message;
            }
            throw new Error(`failed to register PROJ definitions in OpenLayers${message}`);
        }
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
    getObjects(filter?: (obj: Object3D | Entity) => boolean): (Object3D | Entity)[] {
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
    getEntities(filter?: (obj: Entity) => boolean): Entity[] {
        const result = [];

        for (const obj of this._entities) {
            if (!filter || filter(obj)) {
                result.push(obj);
            }
        }

        return result;
    }

    /**
     * Executes the rendering.
     * Internal use only.
     *
     * @internal
     */
    render() {
        this._engine.render(this._scene, this._view.camera);
    }

    /**
     * Extract canvas coordinates from a mouse-event / touch-event.
     *
     * @param event - event can be a MouseEvent or a TouchEvent
     * @param target - The target to set with the result.
     * @param touchIdx - Touch index when using a TouchEvent (default: 0)
     * @returns canvas coordinates (in pixels, 0-0 = top-left of the instance)
     */
    eventToCanvasCoords(event: MouseEvent | TouchEvent, target: Vector2, touchIdx = 0): Vector2 {
        if (window.TouchEvent != null && event instanceof TouchEvent) {
            const touchEvent = event as TouchEvent;
            const br = this.domElement.getBoundingClientRect();
            return target.set(
                touchEvent.touches[touchIdx].clientX - br.x,
                touchEvent.touches[touchIdx].clientY - br.y,
            );
        }

        const mouseEvent = event as MouseEvent;

        if (mouseEvent.target === this.domElement) {
            return target.set(mouseEvent.offsetX, mouseEvent.offsetY);
        }

        // Event was triggered outside of the canvas, probably a CSS2DElement
        const br = this.domElement.getBoundingClientRect();
        return target.set(mouseEvent.clientX - br.x, mouseEvent.clientY - br.y);
    }

    /**
     * Extract normalized coordinates (NDC) from a mouse-event / touch-event.
     *
     * @param event - event can be a MouseEvent or a TouchEvent
     * @param target - The target to set with the result.
     * @param touchIdx - Touch index when using a TouchEvent (default: 0)
     * @returns NDC coordinates (x and y are [-1, 1])
     */
    eventToNormalizedCoords(
        event: MouseEvent | TouchEvent,
        target: Vector2,
        touchIdx = 0,
    ): Vector2 {
        return this.canvasToNormalizedCoords(
            this.eventToCanvasCoords(event, target, touchIdx),
            target,
        );
    }

    /**
     * Convert canvas coordinates to normalized device coordinates (NDC).
     *
     * @param canvasCoords - (in pixels, 0-0 = top-left of the instance)
     * @param target - The target to set with the result.
     * @returns NDC coordinates (x and y are [-1, 1])
     */
    canvasToNormalizedCoords(canvasCoords: Vector2, target: Vector2): Vector2 {
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
    normalizedToCanvasCoords(ndcCoords: Vector2, target: Vector2): Vector2 {
        target.x = (ndcCoords.x + 1) * 0.5 * this._view.width;
        target.y = (ndcCoords.y - 1) * -0.5 * this._view.height;
        return target;
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
     * Return objects from some layers/objects3d under the mouse in this instance.
     *
     * @param mouseOrEvt - mouse position in window coordinates, i.e [0, 0] = top-left,
     * or `MouseEvent` or `TouchEvent`
     * @param options - Options
     * @returns An array of objects. Each element contains at least an object
     * property which is the Object3D under the cursor. Then depending on the queried
     * layer/source, there may be additionnal properties (coming from THREE.Raycaster
     * for instance).
     * If `options.pickFeatures` if `true`, `features` property may be set.
     *
     * ```js
     * instance.pickObjectsAt(mouseEvent)
     * instance.pickObjectsAt(mouseEvent, { radius: 1, where: [entity0, entity1] })
     * instance.pickObjectsAt(mouseEvent, { radius: 3, where: [entity0] })
     * ```
     */
    pickObjectsAt(
        mouseOrEvt: Vector2 | MouseEvent | TouchEvent,
        options: PickObjectsAtOptions = {},
    ): PickResult[] {
        this.dispatchEvent({ type: 'picking-start' });
        this._pickingClock.start();

        let results: PickResult[] = [];
        const sources =
            options.where && options.where.length > 0 ? [...options.where] : this.getObjects();
        const mouse =
            mouseOrEvt instanceof Event
                ? this.eventToCanvasCoords(mouseOrEvt, vectors.evtToCanvas)
                : mouseOrEvt;
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
                vec2: vectors.pickVec2,
                sortByDistance: false,
            };
            if (sortByDistance) {
                pickOptions.limit = Infinity;
                pickOptions.pickFeatures = false;
            }

            if (isPickable(object)) {
                const res = object.pick(mouse, pickOptions);
                results.push(...res);
            } else if ((object as Object3D).isObject3D) {
                const res = pickObjectsAt(this, mouse, object as Object3D, pickOptions);
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
     * Moves the camera to look at an object.
     *
     * @param obj - Object to look at
     */
    focusObject(obj: Object3D | Entity3D) {
        const cam = this._view.camera;
        if (obj instanceof Map) {
            // Configure camera
            // TODO support different CRS
            const dim = obj.extent.dimensions();
            const positionCamera = obj.extent.centerAsVector3();
            positionCamera.z = Math.max(dim.x, dim.y);
            const lookat = positionCamera;
            lookat.z = 0; // TODO this supposes there is no terrain, nor z-displacement

            cam.position.copy(positionCamera);
            cam.lookAt(lookat);
            cam.updateMatrixWorld(true);
        } else if ('getBoundingBox' in obj && typeof obj.getBoundingBox === 'function') {
            const box = obj.getBoundingBox();
            if (box != null && !box.isEmpty()) {
                const center = box.getCenter(vectors.pos);
                const size = box.getSize(vectors.size);
                const positionCamera = center.clone();
                positionCamera.x = Math.max(size.x, size.y);
                cam.position.copy(positionCamera);
                cam.lookAt(center);
                cam.updateMatrixWorld(true);
            }
        }
    }

    getMemoryUsage(): MemoryUsageReport {
        const context: GetMemoryUsageContext = {
            renderer: this.renderer,
            objects: new globalThis.Map(),
        };

        for (const entity of this._entities) {
            if (isEntity3D(entity)) {
                entity.getMemoryUsage(context);
            }
        }

        this.threeObjects.traverse(obj => {
            getObject3DMemoryUsage(context, obj);
        });

        GlobalRenderTargetPool.getMemoryUsage(context);

        GlobalCache.getMemoryUsage(context);

        return aggregateMemoryUsage(context);
    }
}

export default Instance;
