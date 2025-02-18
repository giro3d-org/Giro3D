import {
    AxesHelper,
    Clock,
    EventDispatcher,
    Group,
    MeshBasicMaterial,
    MOUSE,
    Object3D,
    Spherical,
    Vector2,
    Vector3,
    type PerspectiveCamera,
} from 'three';
import type Disposable from '../core/Disposable';
import Coordinates from '../core/geographic/Coordinates';
import Ellipsoid from '../core/geographic/Ellipsoid';
import type Instance from '../core/Instance';
import ConstantSizeSphere from '../renderer/ConstantSizeSphere';
import { isPerspectiveCamera } from '../utils/predicates';

const EPSILON = 0.000001;
const NDC_CENTER = new Vector2(0, 0);
const tmpVec2 = new Vector2();
const tmpGeodetic = new Coordinates('EPSG:4978', 0, 0, 0);

interface GlobeControlsEvents {
    dispose: unknown;
}

type Listener<T> = (event: T) => void;

type Listeners = {
    wheel: Listener<WheelEvent>;
    mousedown: Listener<MouseEvent>;
    mousemove: Listener<MouseEvent>;
    mouseup: Listener<MouseEvent>;
};

enum Mode {
    None,
    Orbit,
}

function toYUp(v: Vector3): Vector3 {
    const { x, y, z } = v;
    return new Vector3(y, z, x);
}

function toZUp(v: Vector3): Vector3 {
    const { x, y, z } = v;
    return new Vector3(z, x, y);
}

const helperMaterial = new MeshBasicMaterial({ color: 'red' });

class Helper extends Object3D {
    readonly type = 'Helper' as const;
    readonly isHelper = true as const;

    private readonly _sphere: ConstantSizeSphere;
    private readonly _axes: AxesHelper;

    constructor() {
        super();

        this._sphere = new ConstantSizeSphere({ radius: 10, material: helperMaterial });
        this._axes = new AxesHelper(1000000);
        this.add(this._sphere);
        this.add(this._axes);
    }

    onBeforeRender(): void {
        this._axes.scale.copy(this._sphere.scale);
        this._axes.updateMatrixWorld(true);
    }

    dispose() {
        this._axes.dispose();
    }
}

export type PickFn = (e: MouseEvent | Vector2) => Vector3 | null;

function defaultPickFn(instance: Instance): PickFn {
    return e => instance.pickObjectsAt(e)[0]?.point;
}

/**
 * Camera controls for an [ECEF](https://en.wikipedia.org/wiki/Earth-centered,_Earth-fixed_coordinate_system)-based reference frame.
 * Useful for navigating around globe-shaped scenes.
 */
export default class GlobeControls
    extends EventDispatcher<GlobeControlsEvents>
    implements Disposable
{
    readonly isGlobeControls = true as const;
    readonly type = 'GlobeControls' as const;

    private readonly _pickFn: PickFn;
    private readonly _instance: Instance;
    private readonly _clock = new Clock(true);
    private readonly _root = new Group();
    private readonly _helperGroup = new Group();
    private readonly _camera: PerspectiveCamera;
    private readonly _domElement: HTMLElement;
    private readonly _eventListeners: Listeners;
    private readonly _cameraTargetOnGlobe = new Object3D();
    private readonly _movingCameraTargetOnGlobe = new Vector3();
    private readonly _rotateStart = new Spherical();
    private readonly _rotateEnd = new Spherical();
    private readonly _offset = new Vector3();
    private readonly _spherical = new Spherical(1.0, 0.01, 0);
    private readonly _sphericalDelta = new Spherical(1.0, 0, 0);
    private readonly _sphericalTo = new Spherical();
    private readonly _targetHelper = new Helper();
    private readonly _pickHelper = new Helper();
    private readonly _orbit = {
        spherical: this._spherical,
        sphericalDelta: this._sphericalDelta,
        sphericalTo: this._sphericalTo,
        altitudeDelta: 0,
    };

    private _enabled = true;
    private _mode = Mode.None;

    zoomSpeed = 2;
    minZoom = 0;
    maxZoom = Infinity;

    minDistance = 300;
    maxDistance = Ellipsoid.WGS84.semiMajorAxis * 8;
    autoRotateSpeed = 2;

    minAzimuthAngle = -Infinity; // radians
    maxAzimuthAngle = Infinity; // radians

    enableDamping = false; // TODO
    dampingFactor = 0.25;

    get enabled() {
        return this._enabled;
    }

    set enabled(v: boolean) {
        if (this._enabled !== v) {
            this._enabled = v;
            if (!this._enabled) {
                this._sphericalDelta.theta = 0;
                this._sphericalDelta.phi = 0;
                this._orbit.altitudeDelta = 0;
            }
        }
    }

    get showHelpers() {
        return this._helperGroup.visible;
    }

    set showHelpers(v: boolean) {
        if (this._helperGroup.visible !== v) {
            this._helperGroup.visible = v;
            this._targetHelper.visible = v;
            this._instance.notifyChange(this._camera);
        }
    }

    get target() {
        return this._cameraTargetOnGlobe.position;
    }

    set target(v: Vector3) {
        this._cameraTargetOnGlobe.position.copy(v);
        this._cameraTargetOnGlobe.updateMatrix();
        this._cameraTargetOnGlobe.updateMatrixWorld(true);
    }

    constructor(options: {
        instance: Instance;
        domElement?: HTMLElement;
        enableDamping?: boolean;
        dampingFactor?: number;
        minZoom?: number;
        maxZoom?: number;
        zoomSpeed?: number;
        minAzimuthAngle?: number;
        maxAzimuthAngle?: number;
        minDistance?: number;
        maxDistance?: number;
        autoRotateSpeed?: number;
        showHelpers?: boolean;
        pickFn?: PickFn;
    }) {
        super();

        this._instance = options.instance;

        this._pickFn = options.pickFn ?? defaultPickFn(options.instance);

        if (!isPerspectiveCamera(this._instance.view.camera)) {
            throw new Error('expected a perspective camera');
        }

        this._domElement = options.domElement ?? this._instance.domElement;
        this._camera = this._instance.view.camera as PerspectiveCamera;

        this.enableDamping = options.enableDamping ?? this.enableDamping;
        this.dampingFactor = options.dampingFactor ?? this.dampingFactor;

        this.zoomSpeed = options.zoomSpeed ?? this.zoomSpeed;
        this.minZoom = options.minZoom ?? this.minZoom;
        this.maxZoom = options.maxZoom ?? this.maxZoom;

        this.maxDistance = options.maxDistance ?? this.maxDistance;
        this.minDistance = options.minDistance ?? this.minDistance;

        this.minAzimuthAngle = options.minAzimuthAngle ?? this.minAzimuthAngle;
        this.maxAzimuthAngle = options.maxAzimuthAngle ?? this.maxAzimuthAngle;
        this.autoRotateSpeed = options.autoRotateSpeed ?? this.autoRotateSpeed;

        this.showHelpers = options.showHelpers ?? false;

        this._root.name = this.type;
        this._helperGroup.name = 'helpers';
        this._helperGroup.visible = this.showHelpers;
        this._root.add(this._helperGroup);
        this._root.add(this._cameraTargetOnGlobe);
        this._helperGroup.add(this._pickHelper);
        this._targetHelper.name = 'center';
        this._pickHelper.name = 'mouse';
        this._instance.add(this._root);
        this._root.updateMatrixWorld(true);
        this._movingCameraTargetOnGlobe.copy(this._cameraTargetOnGlobe.position);
        this._cameraTargetOnGlobe.add(this._targetHelper);

        // TODO touch events
        this._eventListeners = {
            wheel: this.onMouseWheel.bind(this),
            mousedown: this.onMouseDown.bind(this),
            mousemove: this.onMouseMove.bind(this),
            mouseup: this.onMouseUp.bind(this),
        };

        this.addEventListeners();

        this.updateFromCamera();
    }

    private registerListener(name: keyof Listeners, target: HTMLElement) {
        // @ts-expect-error typing
        target.addEventListener(name, this._eventListeners[name]);
    }

    private unregisterListener(name: keyof Listeners, target: HTMLElement) {
        // @ts-expect-error typing
        target.removeEventListener(name, this._eventListeners[name], false);
    }

    private addEventListeners() {
        this.registerListener('wheel', this._domElement);
        this.registerListener('mousedown', this._domElement);

        // We are not listening to mouse move and up now, to avoid interfering
        // with other DOM elements. Instead we listen to those events only when
        // the mouse down event has been received, and then unlisten to them when
        // the mouse up event is received.
    }

    private removeEventListeners() {
        this.unregisterListener('wheel', this._domElement);
        this.unregisterListener('mousedown', this._domElement);
        this.unregisterListener('mousemove', document.body);
        this.unregisterListener('mouseup', document.body);
    }

    getAltitude(): number {
        const { x, y, z } = this._camera.position;
        return Ellipsoid.WGS84.toGeodetic(x, y, z, tmpGeodetic).altitude;
    }

    getAltitudeDelta(): number {
        const altitude = this.getAltitude();

        return (altitude / 20) * this.zoomSpeed;
    }

    private doDolly(dollyScale: number) {
        this._orbit.altitudeDelta = dollyScale;
    }

    dollyIn(delta?: number) {
        if (delta == null) {
            delta = this.getAltitudeDelta();
        }
        this.doDolly(+delta);
    }

    dollyOut(delta?: number) {
        if (delta == null) {
            delta = this.getAltitudeDelta();
        }
        this.doDolly(-delta);
    }

    /**
     * Rotates the controls on the horizontal plane.
     * @param radians - The angle, in radians.
     */
    rotateLeft(radians?: number) {
        if (radians === undefined) {
            radians = this.getAutoRotationAngle();
        }
        if (Math.abs(radians) > EPSILON) {
            this._sphericalDelta.theta -= radians;
        }
    }

    rotateUp(radians?: number) {
        if (radians === undefined) {
            radians = this.getAutoRotationAngle();
        }
        if (Math.abs(radians) > EPSILON) {
            this._sphericalDelta.phi -= radians;
        }
    }

    getAutoRotationAngle() {
        return ((2 * Math.PI) / 60 / 60) * this.autoRotateSpeed;
    }

    /**
     * Returns the {@link Coordinates} of the globe point targeted by the camera in EPSG:4978 projection. See {@link Coordinates} for conversion
     */
    getCameraTargetPosition() {
        return this._cameraTargetOnGlobe.position;
    }

    /**
     * Returns the "range": the distance in meters between the camera and the current central point on the screen.
     */
    getRange() {
        return this.getCameraTargetPosition().distanceTo(this._camera.position);
    }

    private getMode(event: MouseEvent): Mode {
        // TODO remaining events
        switch (event.button) {
            case MOUSE.LEFT:
                return Mode.Orbit;
            default:
                return Mode.None;
        }
    }

    private onMouseUp(_event: MouseEvent) {
        this._mode = Mode.None;

        // To make sure we know when the button is released,
        // even when the mouse is over another element, we listen to the body
        this.unregisterListener('mousemove', document.body);
        this.unregisterListener('mouseup', document.body);
    }

    private onMouseMove(event: MouseEvent) {
        if (!this._enabled) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        switch (this._mode) {
            case Mode.Orbit:
                this.onMouseMoveRotate(event);
                break;
        }

        this.update();
    }

    private onMouseMoveRotate(event: MouseEvent) {
        const pickedPoint = this.pick(event);

        if (pickedPoint) {
            this._rotateEnd.setFromVector3(toYUp(pickedPoint));

            const theta = this._rotateEnd.theta - this._rotateStart.theta;
            const phi = this._rotateEnd.phi - this._rotateStart.phi;

            this.rotateLeft(theta);
            this.rotateUp(phi);
        }
    }

    private onMouseDown(event: MouseEvent) {
        if (!this._enabled) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        // To make sure we know when the button is released,
        // even when the mouse is over another element, we listen to the body
        this.registerListener('mousemove', document.body);
        this.registerListener('mouseup', document.body);

        const pickedPoint = this.pick(event);

        this._mode = this.getMode(event);

        switch (this._mode) {
            case Mode.Orbit:
                if (pickedPoint) {
                    this._sphericalDelta.theta = 0;
                    this._sphericalDelta.phi = 0;
                    this._rotateStart.setFromVector3(toYUp(pickedPoint));
                } else {
                    // We require a picked point to work.
                    this._mode = Mode.None;
                }
                break;
            default:
                break;
        }

        // Assume orbit for now
    }

    private updateTargetToCanvasCenter() {
        const centerPoint = this.pickCanvasCenter();

        if (centerPoint) {
            this._cameraTargetOnGlobe.position.copy(centerPoint);
            this._cameraTargetOnGlobe.updateMatrixWorld(true);
        }
    }

    private pickCanvasCenter(): Vector3 | null {
        const coords = this._instance.normalizedToCanvasCoords(NDC_CENTER, tmpVec2);

        return this._pickFn(coords);
    }

    private pick(e: MouseEvent): Vector3 | null {
        const result = this._pickFn(e);

        if (result) {
            this._pickHelper.visible = true;
            this._pickHelper.position.copy(result);
            this._pickHelper.updateMatrixWorld(true);
        } else {
            this._pickHelper.visible = false;
        }

        return result;
    }

    private onMouseWheel(event: WheelEvent) {
        if (!this._enabled) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const delta = event.deltaY;

        if (delta < 0) {
            this.dollyOut();
        } else if (delta > 0) {
            this.dollyIn();
        }

        // const previousRange = this.getRange();
        this.update();
    }

    private updateDeltas(dt: number): boolean {
        if (this.enableDamping) {
            if (this._mode === Mode.None) {
                this._sphericalDelta.theta *= (1 - this.dampingFactor) * dt;
                this._sphericalDelta.phi *= (1 - this.dampingFactor) * dt;
                this._orbit.altitudeDelta *= (1 - this.dampingFactor) * dt;
            }
        } else {
            this._sphericalDelta.theta = 0;
            this._sphericalDelta.phi = 0;
            this._orbit.altitudeDelta = 0;
        }

        if (
            this._sphericalDelta.theta > EPSILON ||
            this._sphericalDelta.phi > EPSILON ||
            this._orbit.altitudeDelta > EPSILON
        ) {
            return true;
        } else {
            this._sphericalDelta.theta = 0;
            this._sphericalDelta.phi = 0;
            this._orbit.altitudeDelta = 0;
        }

        return false;
    }

    /**
     * Update the controls.
     */
    update(): void {
        if (!this._enabled) {
            return;
        }
        this.updatePassively();

        this._camera.updateMatrixWorld(true);

        const dt = this._clock.getDelta();

        if (this.updateDeltas(dt)) {
            this._instance.notifyChange(this._camera);
        }
    }

    private updateFromCamera() {
        this._cameraTargetOnGlobe.updateMatrix();
        this._cameraTargetOnGlobe.updateMatrixWorld();
        this._movingCameraTargetOnGlobe.copy(this._cameraTargetOnGlobe.position);

        this._offset
            .copy(toYUp(this._camera.position))
            .applyMatrix4(this._cameraTargetOnGlobe.matrixWorld.clone().invert());

        this._spherical.setFromVector3(this._offset);
    }

    private updatePassively(): void {
        this.updateFromCamera();

        this._spherical.theta += this._sphericalDelta.theta;
        this._spherical.phi += this._sphericalDelta.phi;

        // restrict spherical.theta to be between desired limits
        this._spherical.theta = Math.max(
            this.minAzimuthAngle,
            Math.min(this.maxAzimuthAngle, this._spherical.theta),
        );

        this._spherical.radius += this._orbit.altitudeDelta;

        this._spherical.makeSafe();

        this._spherical.radius = Math.max(
            this.minDistance,
            Math.min(this.maxDistance, this._spherical.radius),
        );

        this._offset.setFromSpherical(this._spherical);

        const rawPosition = this._cameraTargetOnGlobe.localToWorld(this._offset);

        const newPosition = toZUp(rawPosition);

        if (newPosition.distanceTo(this._camera.position) > EPSILON) {
            this._camera.position.copy(newPosition);
            this._instance.notifyChange(this._camera);
        }

        this._camera.lookAt(this._movingCameraTargetOnGlobe);
    }

    dispose(): void {
        this.removeEventListeners();
        this._pickHelper.dispose();
        this._instance.remove(this._pickHelper);
        this.dispatchEvent({ type: 'dispose' });
    }
}
