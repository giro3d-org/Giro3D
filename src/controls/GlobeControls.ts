/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Object3D, OrthographicCamera, PerspectiveCamera } from 'three';

import { GlobeControls as WrappedControls, Ellipsoid as WrappedEllipsoid } from '3d-tiles-renderer';
import { EventDispatcher } from 'three';

import Ellipsoid from '../core/geographic/Ellipsoid';

export interface GlobeControlsEvents {
    start: unknown;
    end: unknown;
    change: unknown;
}

export interface GlobeControlsOptions {
    /**
     * The scene to navigate around.
     * Can be the root object of the Giro3D instance, or a particular globe's root object.
     */
    scene: Object3D;
    /**
     * The camera to control.
     */
    camera: PerspectiveCamera | OrthographicCamera;
    /**
     * The DOM element to listen to.
     */
    domElement: HTMLElement;
    /**
     * The ellipsoid to navigate around.
     * @defaultValue {@link Ellipsoid.WGS84}
     */
    ellipsoid?: Ellipsoid;
    /**
     * The zoom speed
     * @defaultValue 1
     */
    zoomSpeed?: number;
    /**
     * Enables damping
     * @defaultValue false
     */
    enableDamping?: boolean;
    /**
     * The damping factor.
     * @defaultValue 0.15
     */
    dampingFactor?: number;
    /**
     * The minimum distance to the ellipsoid.
     * @defaultValue 10
     */
    minDistance?: number;
    /**
     * The maximum distance to the ellipsoid.
     * @defaultValue infinity
     */
    maxDistance?: number;
}

/**
 * Camera controls for a {@link entities.Globe}. Internally, this wraps `3d-tiles-renderer`'s own `GlobeControls`.
 */
export class GlobeControls extends EventDispatcher<GlobeControlsEvents> {
    private readonly _controls: WrappedControls;
    private readonly _camera: PerspectiveCamera | OrthographicCamera;
    private readonly _domElement: HTMLElement;

    private readonly _eventListeners: {
        change: () => void;
        start: () => void;
        end: () => void;
    };

    public constructor(params: GlobeControlsOptions) {
        super();

        const { scene, camera, domElement } = params;

        this._domElement = domElement;

        this._camera = camera;

        this._eventListeners = {
            change: (): void => this.dispatchEvent({ type: 'change' }),
            start: (): void => this.dispatchEvent({ type: 'start' }),
            end: (): void => this.dispatchEvent({ type: 'end' }),
        };

        const ellipsoid = params.ellipsoid ?? Ellipsoid.WGS84;
        this._controls = new WrappedControls(scene, camera, domElement);

        this._controls.setEllipsoid(
            new WrappedEllipsoid(
                ellipsoid.semiMajorAxis,
                ellipsoid.semiMajorAxis,
                ellipsoid.semiMinorAxis,
            ),
            null,
        );
        this._controls.minDistance = params.minDistance ?? this._controls.minDistance;
        this._controls.maxDistance = params.maxDistance ?? this._controls.maxDistance;
        this._controls.zoomSpeed = params.zoomSpeed ?? this._controls.zoomSpeed;
        this._controls.enableDamping = params.enableDamping ?? this._controls.enableDamping;
        this._controls.dampingFactor = params.dampingFactor ?? this._controls.dampingFactor;

        this._controls.addEventListener('start', this._eventListeners.start);
        this._controls.addEventListener('end', this._eventListeners.end);
        this._controls.addEventListener('change', this._eventListeners.change);
    }

    public get enabled(): boolean {
        return this._controls.enabled;
    }

    public set enabled(v: boolean) {
        this._controls.enabled = v;
    }

    public get enableDamping(): boolean {
        return this._controls.enableDamping;
    }

    public set enableDamping(v: boolean) {
        this._controls.enableDamping = v;
    }

    public get dampingFactor(): number {
        return this._controls.dampingFactor;
    }

    public set dampingFactor(v: number) {
        this._controls.dampingFactor = v;
    }

    public get minAltitude(): number {
        return this._controls.minAltitude;
    }

    public set minAltitude(v: number) {
        this._controls.minAltitude = v;
    }

    /**
     * The zoom speed.
     * @defaultValue 1
     */
    public get zoomSpeed(): number {
        return this._controls.zoomSpeed;
    }

    public set zoomSpeed(v: number) {
        this._controls.zoomSpeed = v;
    }

    /**
     * The minimal distance to the ellipsoid surface allowed for the controls.
     * @defaultValue 0 (the ellipsoid surface)
     */
    public get minDistance(): number {
        return this._controls.minDistance;
    }

    public set minDistance(v: number) {
        this._controls.minDistance = v;
    }

    /**
     * The maximal distance to the ellipsoid surface allowed for the controls.
     * @defaultValue infinity
     */
    public get maxDistance(): number {
        return this._controls.maxDistance;
    }

    public set maxDistance(v: number) {
        this._controls.maxDistance = v;
    }

    /**
     * The maximum zoom value (orthographic cameras only).
     */
    public get maxZoom(): number {
        return this._controls.maxZoom;
    }

    public set maxZoom(v: number) {
        this._controls.maxZoom = v;
    }

    /**
     * The minimum zoom value (orthographic cameras only).
     */
    public get minZoom(): number {
        return this._controls.minZoom;
    }

    public set minZoom(v: number) {
        this._controls.minZoom = v;
    }

    public update(deltaTime?: number): void {
        // The controls adjust the clipping planes, but we don't want that.
        // https://github.com/NASA-AMMOS/3DTilesRendererJS/pull/1066
        const near = this._camera.near;
        const far = this._camera.far;

        this._controls.update(deltaTime);

        this._camera.near = near;
        this._camera.far = far;
    }

    /**
     * Attaches event listeners to the DOM element.
     * If the event listeners are already attached, this will throw an error.
     */
    public attach(): void {
        this._controls.attach(this._domElement);
    }

    /**
     * Detaches event listeners from the DOM element.
     */
    public detach(): void {
        this._controls.detach();
    }

    public dispose(): void {
        this._controls.removeEventListener('change', this._eventListeners.change);

        this._controls.dispose();
    }

    public resetState(): void {
        this._controls.resetState();
    }
}

export default GlobeControls;
