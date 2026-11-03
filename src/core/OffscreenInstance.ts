/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import C3DEngine from '../renderer/c3DEngine';
import InstanceBase, { type InstanceBaseOptions } from './InstanceBase';

/** Options for creating an {@link OffscreenInstance}. */
export interface OffscreenInstanceOptions extends InstanceBaseOptions {
    /**
     * The canvas to render into. Transferable, so the instance can be constructed inside a
     * dedicated Worker.
     */
    canvas: OffscreenCanvas;
}

/**
 * A DOM-free counterpart to {@link Instance}: it renders a
 * [Three.js Scene](https://threejs.org/docs/#api/en/scenes/Scene) into a caller-supplied
 * `OffscreenCanvas`, which can be constructed inside a dedicated Worker since no DOM is touched
 * at all.
 *
 * Like {@link Instance}, `OffscreenInstance` supports entities ({@link add}/{@link getEntities})
 * driven by the same {@link InstanceBase.mainLoop | MainLoop} machinery, so entities such as
 * `Map` or `Tiles3D` update and subdivide normally. Unlike {@link Instance}, it has no
 * `domElement` and no CSS2D label rendering. Interactive camera controls are not wired up
 * either: three.js's control classes call DOM-only APIs (`setPointerCapture`,
 * `getBoundingClientRect`) that don't exist on an `OffscreenCanvas`, so driving the camera from
 * user input is left to the caller, typically by mirroring camera transforms from a
 * main-thread-only controls instance.
 *
 * ```js
 * // Inside a dedicated Worker, having received a transferred OffscreenCanvas:
 * const instance = new OffscreenInstance({
 *     canvas: offscreenCanvas,
 *     crs: CoordinateSystem.epsg3857,
 * });
 *
 * instance.add(new Map(...));
 * ```
 */
class OffscreenInstance extends InstanceBase {
    private readonly _canvas: OffscreenCanvas;

    public constructor(options: OffscreenInstanceOptions) {
        const engine = new C3DEngine(options.canvas, {
            clearColor: options.backgroundColor,
            renderer: options.renderer,
        });

        super(engine, options);

        this._canvas = options.canvas;
    }

    /** Gets the `OffscreenCanvas` this instance renders into. */
    public get canvas(): OffscreenCanvas {
        return this._canvas;
    }
}

export default OffscreenInstance;
