import type { PerspectiveCamera } from 'three';
import { Euler, MathUtils, Quaternion, Vector2, Vector3 } from 'three';
import type Instance from '../core/Instance';
import { type InstanceEvents } from '../core/Instance';
import { isPerspectiveCamera } from '../utils/predicates';

// Note: we could use existing js controls (like
// https://github.com/mrdoob/js/blob/dev/examples/js/controls/FirstPersonControls.js) but
// including these controls in Giro3D allows use to integrate them tightly with Giro3D.  Especially
// the existing controls are expecting a continuous update loop while we have a pausable one (so our
// controls use .notifyChange when needed)

interface State {
    rotateX: number;
    rotateY: number;
    snapshot?: () => State;
}

const tmpVec2 = new Vector2();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function limitRotation(camera: PerspectiveCamera, rot: number, verticalFOV: number) {
    // Limit vertical rotation (look up/down) to make sure the user cannot see
    // outside of the cone defined by verticalFOV
    // const limit = MathUtils.degToRad(verticalFOV - camera.fov * 0.5) * 0.5;
    const limit = Math.PI * 0.5 - 0.01;
    return MathUtils.clamp(rot, -limit, limit);
}

function applyRotation(instance: Instance, camera: PerspectiveCamera, state: State) {
    camera.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), camera.up);

    camera.rotateY(state.rotateY);
    camera.rotateX(state.rotateX);

    instance.notifyChange(instance.view.camera);
}

type MoveMethod = 'translateX' | 'translateY' | 'translateZ';

const MOVEMENTS: Record<number, { method: MoveMethod; sign: number }> = {
    38: { method: 'translateZ', sign: -1 }, // FORWARD: up key
    40: { method: 'translateZ', sign: 1 }, // BACKWARD: down key
    37: { method: 'translateX', sign: -1 }, // STRAFE_LEFT: left key
    39: { method: 'translateX', sign: 1 }, // STRAFE_RIGHT: right key
    33: { method: 'translateY', sign: 1 }, // UP: PageUp key
    34: { method: 'translateY', sign: -1 }, // DOWN: PageDown key
};

type Movement = (typeof MOVEMENTS)[keyof typeof MOVEMENTS];

export interface FirstPersonControlsOptions {
    /* whether or not to focus the renderer domElement on click */
    focusOnClick?: boolean;
    /** whether or not to focus when the mouse is over the domElement */
    focusOnMouseOver?: boolean;
    /** if \> 0, pressing the arrow keys will move the camera */
    moveSpeed?: number;
    /**
     * define the max visible vertical angle of the scene in degrees
     *
     * @defaultValue  180
     */
    verticalFOV?: number;
    /**
     * alternative way to specify the max vertical angle when using a panorama.
     * You can specify the panorama width/height ratio and the verticalFOV
     * will be computed automatically
     */
    panoramaRatio?: number;
    /**
     * if true, the controls will not self listen to mouse/key events.
     * You'll have to manually forward the events to the appropriate
     * functions: onMouseDown, onMouseMove, onMouseUp, onKeyUp, onKeyDown and onMouseWheel.
     */
    disableEventListeners?: boolean;
    /** the minimal height of the instance camera */
    minHeight?: number;
    /** the maximal height of the instance camera */
    maxHeight?: number;
}

class FirstPersonControls {
    camera: PerspectiveCamera;
    instance: Instance;
    enabled: boolean;
    moves: Set<Movement>;
    options: FirstPersonControlsOptions;
    private _isMouseDown: boolean;
    private _onMouseDownMouseX: number;
    private _onMouseDownMouseY: number;
    private _state: State;
    private _stateOnMouseDown?: State;

    /**
     * @param instance - the Giro3D instance to control
     * @param options - additional options
     */
    constructor(instance: Instance, options: FirstPersonControlsOptions = {}) {
        if (!isPerspectiveCamera(instance.view.camera)) {
            throw new Error('this control only supports perspective cameras');
        }
        this.camera = instance.view.camera;
        this.instance = instance;
        this.enabled = true;
        this.moves = new Set();
        if (options.panoramaRatio) {
            const radius = (options.panoramaRatio * 200) / (2 * Math.PI);
            options.verticalFOV =
                options.panoramaRatio === 2
                    ? 180
                    : MathUtils.radToDeg(2 * Math.atan(200 / (2 * radius)));
        }
        options.verticalFOV = options.verticalFOV ?? 180;

        options.minHeight = options.minHeight ?? null;
        options.maxHeight = options.maxHeight ?? null;

        // backward or forward move speed in m/s
        options.moveSpeed = options.moveSpeed ?? 10;
        this.options = options;

        this._isMouseDown = false;
        this._onMouseDownMouseX = 0;
        this._onMouseDownMouseY = 0;

        this._state = {
            rotateX: 0,
            rotateY: 0,
            snapshot() {
                return {
                    rotateX: this.rotateX,
                    rotateY: this.rotateY,
                };
            },
        };
        this.reset();

        const domElement = instance.domElement;
        if (!options.disableEventListeners) {
            domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
            domElement.addEventListener('touchstart', this.onMouseDown.bind(this), false);
            domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
            domElement.addEventListener('touchmove', this.onMouseMove.bind(this), false);
            domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false);
            domElement.addEventListener('touchend', this.onMouseUp.bind(this), false);
            domElement.addEventListener('keyup', this.onKeyUp.bind(this), true);
            domElement.addEventListener('keydown', this.onKeyDown.bind(this), true);
            domElement.addEventListener('mousewheel', this.onMouseWheel.bind(this), false);
            domElement.addEventListener('DOMMouseScroll', this.onMouseWheel.bind(this), false); // firefox
        }

        this.instance.addEventListener('after-camera-update', this.update.bind(this));

        // focus policy
        if (options.focusOnMouseOver) {
            domElement.addEventListener('mouseover', () => domElement.focus());
        }
        if (options.focusOnClick) {
            domElement.addEventListener('click', () => domElement.focus());
        }
    }

    isUserInteracting() {
        return this.moves.size !== 0 || this._isMouseDown;
    }

    /**
     * Resets the controls internal state to match the camera' state.
     * This must be called when manually modifying the camera's position or rotation.
     *
     * @param preserveRotationOnX - if true, the look up/down rotation will
     * not be copied from the camera
     */
    reset(preserveRotationOnX = false) {
        // Compute the correct init state, given the calculus in applyRotation:
        // cam.quaternion = q * r
        // => r = invert(q) * cam.quaterion
        // q is the quaternion derived from the up vector
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), this.camera.up);
        q.invert();
        // compute r
        const r = this.camera.quaternion.clone().premultiply(q);
        // tranform it to euler
        const e = new Euler(0, 0, 0, 'YXZ').setFromQuaternion(r);

        if (!preserveRotationOnX) {
            this._state.rotateX = e.x;
        }
        this._state.rotateY = e.y;
    }

    /**
     * Updates the camera position / rotation based on occured input events.
     * This is done automatically when needed but can also be done if needed.
     *
     * @param event - Event
     * @param force - set to true if you want to force the update, even if it
     * appears unneeded.
     */
    update(event: InstanceEvents['after-camera-update'], force = false) {
        if (!this.enabled) {
            return;
        }
        // dt will not be relevant when we just started rendering, we consider a 1-frame move in
        // this case
        const dt = event.updateLoopRestarted ? 16 : event.dt;

        for (const move of this.moves) {
            if (move.method === 'translateY') {
                this.camera.position.z += (move.sign * this.options.moveSpeed * dt) / 1000;
            } else {
                this.camera[move.method]((move.sign * this.options.moveSpeed * dt) / 1000);
            }
        }

        if (this.options.minHeight !== null && this.camera.position.z < this.options.minHeight) {
            this.camera.position.z = this.options.minHeight;
        } else if (
            this.options.maxHeight !== null &&
            this.camera.position.z > this.options.maxHeight
        ) {
            this.camera.position.z = this.options.maxHeight;
        }

        if (this._isMouseDown === true || force === true) {
            applyRotation(this.instance, this.camera, this._state);
        }

        if (this.moves.size > 0) {
            this.instance.notifyChange(this.instance.view.camera);
        }
    }

    // Event callback functions
    // Mouse movement handling
    onMouseDown(event: MouseEvent) {
        if (!this.enabled || event.button !== 0) {
            return;
        }
        event.preventDefault();
        this._isMouseDown = true;

        const coords = this.instance.eventToCanvasCoords(event, tmpVec2);
        this._onMouseDownMouseX = coords.x;
        this._onMouseDownMouseY = coords.y;

        this._stateOnMouseDown = this._state.snapshot();
    }

    onMouseUp(event: MouseEvent) {
        if (!this.enabled || event.button !== 0) {
            return;
        }
        this._isMouseDown = false;
    }

    onMouseMove(event: MouseEvent) {
        if (!this.enabled || event.button !== 0) {
            return;
        }
        if (this._isMouseDown === true) {
            // in rigor we have tan(theta) = tan(cameraFOV) * deltaH / H
            // (where deltaH is the vertical amount we moved, and H the renderer height)
            // we loosely approximate tan(x) by x
            const pxToAngleRatio =
                MathUtils.degToRad(this.camera.fov) / this.instance.engine.height;

            const coords = this.instance.eventToCanvasCoords(event, tmpVec2);

            // update state based on pointer movement
            this._state.rotateY =
                (coords.x - this._onMouseDownMouseX) * pxToAngleRatio +
                this._stateOnMouseDown.rotateY;
            this._state.rotateX = limitRotation(
                this.camera,
                (coords.y - this._onMouseDownMouseY) * pxToAngleRatio +
                    this._stateOnMouseDown.rotateX,
                this.options.verticalFOV,
            );

            applyRotation(this.instance, this.camera, this._state);
        }
    }

    // Mouse wheel
    onMouseWheel(event: WheelEvent) {
        if (!this.enabled) {
            return;
        }
        let delta = 0;
        if ('wheelDelta' in event && event.wheelDelta !== undefined) {
            delta = -event.wheelDelta;
            // Firefox
        } else if (event.detail !== undefined) {
            delta = event.detail;
        }

        this.camera.fov = MathUtils.clamp(
            this.camera.fov + Math.sign(delta),
            10,
            Math.min(100, this.options.verticalFOV),
        );

        this.camera.updateProjectionMatrix();

        this._state.rotateX = limitRotation(
            this.camera,
            this._state.rotateX,
            this.options.verticalFOV,
        );

        applyRotation(this.instance, this.camera, this._state);
    }

    // Keyboard handling
    onKeyUp(e: KeyboardEvent) {
        if (!this.enabled) {
            return;
        }
        const move = MOVEMENTS[e.keyCode];
        if (move) {
            this.moves.delete(move);
            this.instance.notifyChange(undefined);
            e.preventDefault();
        }
    }

    onKeyDown(e: KeyboardEvent) {
        if (!this.enabled) {
            return;
        }
        const move = MOVEMENTS[e.keyCode];
        if (move) {
            this.moves.add(move);
            this.instance.notifyChange(undefined);
            e.preventDefault();
        }
    }
}

export default FirstPersonControls;
