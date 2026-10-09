/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { OrthographicCamera, PerspectiveCamera } from 'three';

import {
    EventDispatcher,
    Object3D,
    Scene,
    type ColorRepresentation,
    type WebGLRenderer,
    type WebGLRendererParameters,
} from 'three';

import type Entity from '../entities/Entity';
import type C3DEngine from '../renderer/c3DEngine';
import type RenderingOptions from '../renderer/RenderingOptions';
import type CoordinateSystem from './geographic/CoordinateSystem';
import type PickResult from './picking/PickResult';

import View from '../renderer/View';

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
    protected _disposed = false;

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

    /**
     * Hook for subclass cleanup that must run before the shared teardown (engine, view).
     * No-op by default.
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
}

export default InstanceBase;
