import {
    Box3,
    EventDispatcher,
    Frustum,
    MathUtils,
    Matrix4,
    PerspectiveCamera,
    Vector3,
    type OrthographicCamera,
    type Sphere,
} from 'three';
import type Disposable from '../core/Disposable';
import Coordinates from '../core/geographic/Coordinates';
import { isOrthographicCamera, isPerspectiveCamera } from '../utils/predicates';

const tmp = {
    frustum: new Frustum(),
    matrix: new Matrix4(),
    box3: new Box3(),
};

const points = [
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
];

const IDENTITY = new Matrix4();

export interface CameraOptions {
    /** the THREE camera to use */
    camera?: PerspectiveCamera;
}

export interface ExternalControls extends EventDispatcher<{ change: unknown }> {
    update(): void;
}

export const DEFAULT_MIN_NEAR_PLANE = 2;
export const DEFAULT_MAX_NEAR_PLANE = 2000000000;

type ViewEvents = {
    change: unknown;
};

/**
 * Adds geospatial capabilities to three.js cameras.
 */
class View extends EventDispatcher<ViewEvents> implements Disposable {
    private readonly _crs: string;
    private readonly _viewMatrix: Matrix4;
    private _camera: PerspectiveCamera | OrthographicCamera;
    private _width: number;
    private _height: number;
    private _preSSE: number;
    private _maxFar: number = DEFAULT_MAX_NEAR_PLANE;
    private _minNear: number = DEFAULT_MIN_NEAR_PLANE;
    private _controls: ExternalControls | null = null;
    private _onControlsUpdated = () => this.dispatchEvent({ type: 'change' });
    private _frustum: Frustum = new Frustum();

    /**
     * The width, in pixels, of this view.
     */
    get width() {
        return this._width;
    }

    /**
     * The height, in pixels, of this view.
     */
    get height() {
        return this._height;
    }

    /**
     * Gets or sets the current camera.
     */
    get camera(): PerspectiveCamera | OrthographicCamera {
        return this._camera;
    }

    set camera(c: PerspectiveCamera | OrthographicCamera) {
        if (c != null) {
            this._camera = c;
        } else {
            throw new Error('a camera is required');
        }
    }

    /**
     * @param crs - the CRS of this camera
     * @param width - the width in pixels of the camera viewport
     * @param height - the height in pixels of the camera viewport
     * @param options - optional values
     */
    constructor(crs: string, width: number, height: number, options: CameraOptions = {}) {
        super();

        this._crs = crs;

        this._camera = options.camera ? options.camera : new PerspectiveCamera(30, width / height);
        this._camera.near = DEFAULT_MIN_NEAR_PLANE;
        this._camera.far = DEFAULT_MAX_NEAR_PLANE;
        this._camera.updateProjectionMatrix();
        this._viewMatrix = new Matrix4();
        this._width = width;
        this._height = height;

        this._preSSE = Infinity;
    }

    get crs() {
        return this._crs;
    }

    get preSSE() {
        return this._preSSE;
    }

    set preSSE(value) {
        this._preSSE = value;
    }

    get viewMatrix() {
        return this._viewMatrix;
    }

    get near() {
        return this.camera.near;
    }

    /**
     * Gets or sets the distance to the near plane. The distance will be clamped to be within
     * the bounds defined by {@link minNearPlane} and {@link maxFarPlane}.
     */
    set near(distance: number) {
        this.camera.near = MathUtils.clamp(distance, this.minNearPlane, this.maxFarPlane);
    }

    get far() {
        return this.camera.far;
    }

    /**
     * Gets or sets the distance to the far plane. The distance will be clamped to be within
     * the bounds defined by {@link minNearPlane} and {@link maxFarPlane}.
     */
    set far(distance: number) {
        this.camera.far = MathUtils.clamp(distance, this.minNearPlane, this.maxFarPlane);
    }

    /**
     * Gets or sets the maximum distance allowed for the camera far plane.
     */
    get maxFarPlane() {
        return this._maxFar;
    }

    set maxFarPlane(distance: number) {
        this._maxFar = distance;
        this.camera.far = Math.min(this.camera.far, distance);
    }

    /**
     * Gets or sets the minimum distance allowed for the camera near plane.
     */
    get minNearPlane() {
        return this._minNear;
    }

    set minNearPlane(distance: number) {
        this._minNear = distance;
        this.camera.near = Math.max(this.camera.near, distance);
    }

    /**
     * Gets the currently registered controls, if any.
     *
     * Note: To register controls, use {@link setControls}.
     */
    get controls(): ExternalControls | null {
        return this._controls;
    }

    /**
     * Registers external controls that must be udpated periodically.
     *
     * Note: this is the case of simple controls in the  `examples/{js,jsm}/controls` folder
     * of THREE.js (e.g `MapControls`):
     *
     * - they fire `'change'` events when the controls' state has changed and the view must be rendered,
     * - they have an `update()` method to update the controls' state.
     *
     * For more complex controls, such as the package [`camera-controls`](https://www.npmjs.com/package/camera-controls),
     * a more complex logic is required. Please refer to the appropriate examples for a detailed
     * documentation on how to bind Giro3D and those controls.
     *
     * @param controls - The controls to register. If `null`, currently registered controls
     * are unregistered (they are not disabled however).
     */
    setControls(controls: ExternalControls | null) {
        if (controls) {
            controls.addEventListener('change', this._onControlsUpdated);
        } else {
            this._controls?.removeEventListener('change', this._onControlsUpdated);
        }
        this._controls = controls;
    }

    /**
     * Resets the near and far planes to their default value.
     */
    resetPlanes() {
        this.near = this.minNearPlane;
        this.far = this.maxFarPlane;
    }

    /**
     * @internal
     */
    update(width?: number, height?: number) {
        this.resize(width, height);

        this._controls?.update();

        // update matrix
        this.camera.updateMatrixWorld();

        // keep our visibility testing matrix ready
        this._viewMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse,
        );

        this._frustum.setFromProjectionMatrix(this._viewMatrix);
    }

    private resize(width?: number, height?: number) {
        if (width != null && height != null) {
            this._width = width;
            this._height = height;
            const ratio = width / height;

            if (isPerspectiveCamera(this.camera)) {
                if (this.camera.aspect !== ratio) {
                    this.camera.aspect = ratio;
                }
            } else if (isOrthographicCamera(this.camera)) {
                const orthographic = this.camera;
                const width = orthographic.right - orthographic.left;
                const height = width / ratio;
                orthographic.top = height / 2;
                orthographic.bottom = -height / 2;
            }
        }

        this.camera.updateProjectionMatrix();
    }

    /**
     * Return the position in the requested CRS, or in camera's CRS if undefined.
     *
     * @param crs - if defined (e.g 'EPSG:4236') the camera position will be
     * returned in this CRS
     * @returns Coordinates object holding camera's position
     */
    position(crs?: string) {
        return new Coordinates(this.crs, this.camera.position).as(crs ?? this.crs);
    }

    isBox3Visible(box3: Box3, matrixWorld?: Matrix4) {
        if (matrixWorld && !matrixWorld.equals(IDENTITY)) {
            tmp.matrix.multiplyMatrices(this._viewMatrix, matrixWorld);
            tmp.frustum.setFromProjectionMatrix(tmp.matrix);
            return tmp.frustum.intersectsBox(box3);
        } else {
            return this._frustum.intersectsBox(box3);
        }
    }

    isSphereVisible(sphere: Sphere, matrixWorld?: Matrix4) {
        if (matrixWorld && !matrixWorld.equals(IDENTITY)) {
            tmp.matrix.multiplyMatrices(this._viewMatrix, matrixWorld);
            tmp.frustum.setFromProjectionMatrix(tmp.matrix);
            return tmp.frustum.intersectsSphere(sphere);
        } else {
            return this._frustum.intersectsSphere(sphere);
        }
    }

    box3SizeOnScreen(box3: Box3, matrixWorld: Matrix4) {
        const pts = this.projectBox3PointsInCameraSpace(box3, matrixWorld);

        // All points are in front of the near plane -> box3 is invisible
        if (!pts) {
            return tmp.box3.makeEmpty();
        }

        // Project points on screen
        for (let i = 0; i < 8; i++) {
            pts[i].applyMatrix4(this.camera.projectionMatrix);
        }

        return tmp.box3.setFromPoints(pts);
    }

    private projectBox3PointsInCameraSpace(box3: Box3, matrixWorld?: Matrix4) {
        if (!('near' in this.camera)) {
            return undefined;
        }

        // Projects points in camera space
        // We don't project directly on screen to avoid artifacts when projecting
        // points behind the near plane.
        let m = this.camera.matrixWorldInverse;
        if (matrixWorld) {
            m = tmp.matrix.multiplyMatrices(this.camera.matrixWorldInverse, matrixWorld);
        }
        points[0].set(box3.min.x, box3.min.y, box3.min.z).applyMatrix4(m);
        points[1].set(box3.min.x, box3.min.y, box3.max.z).applyMatrix4(m);
        points[2].set(box3.min.x, box3.max.y, box3.min.z).applyMatrix4(m);
        points[3].set(box3.min.x, box3.max.y, box3.max.z).applyMatrix4(m);
        points[4].set(box3.max.x, box3.min.y, box3.min.z).applyMatrix4(m);
        points[5].set(box3.max.x, box3.min.y, box3.max.z).applyMatrix4(m);
        points[6].set(box3.max.x, box3.max.y, box3.min.z).applyMatrix4(m);
        points[7].set(box3.max.x, box3.max.y, box3.max.z).applyMatrix4(m);

        // In camera space objects are along the -Z axis
        // So if min.z is > -near, the object is invisible
        let atLeastOneInFrontOfNearPlane = false;
        for (let i = 0; i < 8; i++) {
            if (points[i].z <= -this.camera.near) {
                atLeastOneInFrontOfNearPlane = true;
            } else {
                // Clamp to near plane
                points[i].z = -this.camera.near;
            }
        }

        return atLeastOneInFrontOfNearPlane ? points : undefined;
    }

    dispose(): void {
        this.setControls(null);
    }
}

export default View;
