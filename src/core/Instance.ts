/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Object3D } from 'three';
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { Clock, Vector2 } from 'three';

import type Entity from '../entities/Entity';
import type Entity3D from '../entities/Entity3D';
import type PickOptions from './picking/PickOptions';
import type PickResult from './picking/PickResult';
import type Progress from './Progress';

import { isEntity3D } from '../entities/Entity3D';
import C3DEngine from '../renderer/c3DEngine';
import { GlobalRenderTargetPool } from '../renderer/RenderTargetPool';
import { GlobalCache } from './Cache';
import InstanceBase, {
    type EntityEventPayload,
    type FrameEventPayload,
    type InstanceBaseOptions,
    type InstanceEvents,
} from './InstanceBase';
import {
    aggregateMemoryUsage,
    getObject3DMemoryUsage,
    type GetMemoryUsageContext,
    type MemoryUsageReport,
} from './MemoryUsage';
import { isPickable } from './picking/Pickable';
import { isPickableFeatures } from './picking/PickableFeatures';
import pickObjectsAt from './picking/PickObjectsAt';

export type { EntityEventPayload, FrameEventPayload, InstanceEvents };

const vectors = {
    evtToCanvas: new Vector2(),
    pickVec2: new Vector2(),
};

/** Options for creating Instance */
export interface InstanceOptions extends InstanceBaseOptions {
    /**
     * The container for the instance. May be either the `id` of an existing `<div>` element,
     * or the element itself.
     */
    target: string | HTMLDivElement;
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

/**
 * The instance is the core component of Giro3D. It encapsulates the 3D scene,
 * the current camera and one or more {@link Entity | entities}. The instance displays
 * the 3D scene in the DOM element specified by the `target` constructor property.
 *
 * ```js
 * // Create a Giro3D instance in the EPSG:3857 coordinate system:
 * const instance = new Instance({
 *     target: 'view',
 *     crs: CoordinateSystem.epsg3857,
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
 * instance.view.camera.lookAt(0, 0, 0);
 * ```
 */
class Instance extends InstanceBase implements Progress {
    private readonly _viewport: HTMLDivElement;
    private readonly _resizeObserver?: ResizeObserver;
    private readonly _pickingClock: Clock;
    private readonly _onContextRestored: () => void;
    private readonly _onContextLost: () => void;
    private _resizeTimeout?: string | number | NodeJS.Timeout;

    /**
     * Constructs a Giro3D Instance
     *
     * @param options - Options
     *
     * ```js
     * const instance = new Instance({
     *   target: 'parentElement', // The id of the <div> to attach the instance
     *   crs: CoordinateSystem.epsg3857,
     * });
     * ```
     */
    public constructor(options: InstanceOptions) {
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

        // viewerDiv may have padding/borders, which is annoying when retrieving its size
        // Wrap our canvas in a new div so we make sure the display
        // is correct whatever the page layout is
        // (especially when skrinking so there is no scrollbar/bleading)
        const viewport = document.createElement('div');
        viewport.style.position = 'relative';
        viewport.style.overflow = 'hidden'; // Hide overflow during resizing
        viewport.style.width = '100%'; // Make sure it fills the space
        viewport.style.height = '100%';
        viewerDiv.appendChild(viewport);

        const engine = new C3DEngine(viewport, {
            clearColor: options.backgroundColor,
            renderer: options.renderer,
        });

        super(engine, options);

        this._viewport = viewport;

        if (globalThis.ResizeObserver != null) {
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

    private onContextLost(): void {
        this.getEntities().forEach(entity => {
            if (isEntity3D(entity)) {
                entity.onRenderingContextLost({ canvas: this.domElement });
            }
        });
    }

    private onContextRestored(): void {
        this.getEntities().forEach(entity => {
            if (isEntity3D(entity)) {
                entity.onRenderingContextRestored({ canvas: this.domElement });
            }
        });
        this.notifyChange();
    }

    /** Gets the canvas that this instance renders into. */
    public get domElement(): HTMLCanvasElement {
        return this._engine.renderer.domElement;
    }

    /** Gets the DOM element that contains the Giro3D viewport. */
    public get viewport(): HTMLDivElement {
        return this._viewport;
    }

    /** Gets whether at least one entity is currently loading data. */
    public get loading(): boolean {
        const entities = this.getEntities();
        return entities.some(e => e.loading);
    }

    /**
     * Gets the progress (between 0 and 1) of the processing of the entire instance.
     * This is the average of the progress values of all entities.
     * Note: This value is only meaningful is {@link loading} is `true`.
     * Note: if no entity is present in the instance, this will always return 1.
     */
    public get progress(): number {
        const entities = this.getEntities();
        if (entities.length === 0) {
            return 1;
        }
        const sum = entities.reduce((accum, entity) => accum + entity.progress, 0);
        return sum / entities.length;
    }

    /**
     * Gets the underlying CSS2DRenderer.
     */
    public get css2DRenderer(): CSS2DRenderer {
        // Always non-null: Instance always goes through C3DEngine's div-wrapping path, which
        // always creates a label renderer. Only OffscreenInstance's canvas path doesn't.
        return this._engine.labelRenderer as CSS2DRenderer;
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

    protected override onBeforeDispose(): void {
        this.domElement.removeEventListener('webglcontextlost', this._onContextLost);
        this.domElement.removeEventListener('webglcontextrestored', this._onContextRestored);

        this._resizeObserver?.disconnect();
    }

    protected override onAfterDispose(): void {
        this._viewport.remove();
    }

    /**
     * Extract canvas coordinates from a mouse-event / touch-event.
     *
     * @param event - event can be a MouseEvent or a TouchEvent
     * @param target - The target to set with the result.
     * @param touchIdx - Touch index when using a TouchEvent (default: 0)
     * @returns canvas coordinates (in pixels, 0-0 = top-left of the instance)
     */
    public eventToCanvasCoords(
        event: MouseEvent | TouchEvent,
        target: Vector2,
        touchIdx = 0,
    ): Vector2 {
        if (globalThis.TouchEvent != null && event instanceof TouchEvent) {
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
    public eventToNormalizedCoords(
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
    public pickObjectsAt(
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

    public getMemoryUsage(): MemoryUsageReport {
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
