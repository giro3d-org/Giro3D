import {
    Box3,
    type Camera,
    EventDispatcher,
    Frustum,
    MathUtils,
    Matrix4,
    Object3D,
    type OrthographicCamera,
    PerspectiveCamera,
    Sphere,
    Vector3,
} from 'three';
import { type OBB } from 'three/examples/jsm/Addons.js';
import type Disposable from '../core/Disposable';
import type CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';
import Coordinates from '../core/geographic/Coordinates';
import Ellipsoid from '../core/geographic/Ellipsoid';
import type HasDefaultPointOfView from '../core/HasDefaultPointOfView';
import { hasDefaultPointOfView } from '../core/HasDefaultPointOfView';
import type PointOfView from '../core/PointOfView';
import { isPointOfView } from '../core/PointOfView';
import { isBox3, isOrthographicCamera, isPerspectiveCamera } from '../utils/predicates';

const ZERO = new Vector3(0, 0, 0);

const tmp = {
    vec3: new Vector3(),
    frustum: new Frustum(),
    matrix: new Matrix4(),
    obbMatrix: new Matrix4(),
    box3: new Box3(),
    up: new Vector3(),
    sphere: new Sphere(),
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

export interface ExternalControls extends EventDispatcher<{ change: unknown }> {
    update(): void;
}

export const DEFAULT_MIN_NEAR_PLANE = 2;
export const DEFAULT_MAX_FAR_PLANE = 2_000_000_000;

type ViewEvents = {
    change: unknown;
};

/**
 * Returns the distance from the center of the bounding sphere so
 * that the perspective camera's frustum view fits the sphere.
 * @param camera - The perspective camera.
 * @param bounds - The bounds to encompass.
 */
export function computeDistanceToFitSphere(camera: PerspectiveCamera, radius: number): number {
    // Simple trigonometry
    const opposite = radius;
    const halfFov = camera.fov / 2;
    const theta = MathUtils.degToRad(halfFov);

    const adjacent = opposite / Math.tan(theta);

    return adjacent;
}

/**
 * Computes the zoom value so that the sphere fits in the orthographic camera's frustum.
 * @param camera - The orthographic camera.
 * @param sphere - The sphere to fit.
 */
export function computeZoomToFitSphere(camera: OrthographicCamera, radius: number): number {
    const camWidth = camera.right - camera.left;
    const camHeight = camera.top - camera.bottom;
    const camSize = Math.max(camWidth, camHeight);
    const diameter = radius * 2;

    return camSize / diameter / 2;
}

/**
 * Adds geospatial capabilities to three.js cameras.
 */
class View extends EventDispatcher<ViewEvents> implements Disposable {
    private readonly _coordinateSystem: CoordinateSystem;
    private readonly _viewMatrix: Matrix4;
    private _camera: PerspectiveCamera | OrthographicCamera;
    private _width: number;
    private _height: number;
    private _preSSE: number;
    private _maxFar: number = DEFAULT_MAX_FAR_PLANE;
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
    constructor(params: {
        crs: CoordinateSystem;
        width: number;
        height: number;
        camera?: PerspectiveCamera | OrthographicCamera;
    }) {
        super();

        const { width, height, crs } = params;

        this._coordinateSystem = crs;

        this._camera = params.camera ?? new PerspectiveCamera(30, width / height);
        this._camera.near = DEFAULT_MIN_NEAR_PLANE;
        this._camera.far = DEFAULT_MAX_FAR_PLANE;
        this._camera.updateProjectionMatrix();
        this._viewMatrix = new Matrix4();
        this._width = width;
        this._height = height;

        this._preSSE = Infinity;
    }

    get crs() {
        return this._coordinateSystem;
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

    get frustum(): Readonly<Frustum> {
        return this._frustum;
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
        if (controls != null) {
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
    update() {
        this._controls?.update();

        // update matrix
        this.camera.updateMatrixWorld();
        this.camera.updateProjectionMatrix();

        // keep our visibility testing matrix ready
        this._viewMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse,
        );

        this._frustum.setFromProjectionMatrix(this._viewMatrix);
    }

    setSize(width?: number, height?: number) {
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
    position(crs?: CoordinateSystem) {
        return new Coordinates(this.crs, this.camera.position).as(crs ?? this.crs);
    }

    isOBBVisible(worldOBB: OBB): boolean {
        const box = tmp.box3.setFromCenterAndSize(ZERO, worldOBB.getSize(tmp.vec3));

        const obbMatrix = tmp.obbMatrix
            .setFromMatrix3(worldOBB.rotation)
            .setPosition(worldOBB.center);

        const matrix = tmp.matrix.multiplyMatrices(this._viewMatrix, obbMatrix);

        tmp.frustum.setFromProjectionMatrix(matrix);

        return tmp.frustum.intersectsBox(box);
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

    /**
     * Returns the "up" vector at a given coordinates.
     *
     * The "up" vector is generally used to orient objects and cameras.
     *
     * If a custom function was specified in the constructor of the instance, this will be used.
     *
     * Otherwise, the default implementation is used:
     *
     * - For projected coordinate systems, this is equal to the vertical axis (typically Z).
     * - For the ECEF geocentric coordinate system (EPSG:4878), this is equal to the normal
     * of the WGS84 ellipsoid at this location.
     *
     * @param coordinate - The coordinate of the point for which to compute the vector.
     * @param target - The vector to store the result. If unspecified, a new one is created.
     * @returns The up vector at this location.
     */
    private getUpVector(coordinate: Vector3, target?: Vector3): Vector3 {
        if (this._coordinateSystem.isEpsg(4978)) {
            return Ellipsoid.WGS84.getNormalFromCartesian(coordinate, target);
        }

        target = target ?? new Vector3();

        // We expect that DEFAULT_UP was set properly during construction of the instance.
        return target.copy(Object3D.DEFAULT_UP);
    }
    /**
     * Computes a {@link PointOfView} for the given object.
     * @param obj - The object to compute the point of view, or a world space bounding box.
     * @param options - Optional parameters.
     * @returns The readonly point of view if it could be computed, `null` otherwise.
     */
    getDefaultPointOfView(
        obj: Object3D | Box3,
        options?: {
            /**
             * The optional camera to compute this point of view.
             * If unspecified, the currently active camera on this view is used.
             */
            camera?: Camera;
        },
    ): Readonly<PointOfView> | null {
        if (obj == null) {
            return null;
        }

        const box = isBox3(obj) ? obj : new Box3().setFromObject(obj);

        const sphere = box.getBoundingSphere(tmp.sphere);

        const target = sphere.center;

        const camera = options?.camera ?? this.camera;

        const up = this.getUpVector(target, tmp.up);

        const radius = sphere.radius * 1.2;
        let distance = 0;
        let orthographicZoom = 1;

        if (isPerspectiveCamera(camera)) {
            distance = computeDistanceToFitSphere(camera, radius);
        } else if (isOrthographicCamera(camera)) {
            orthographicZoom = computeZoomToFitSphere(camera, radius);
            distance = radius * 4;
        } else {
            return null;
        }

        const origin = target.clone().addScaledVector(up, distance);

        const result: PointOfView = { origin, target, orthographicZoom };

        Object.freeze(result);

        return result;
    }

    private applyPointOfView(pov: PointOfView, allowTranslation: boolean): void {
        if (pov != null) {
            if (allowTranslation) {
                this.camera.position.copy(pov.origin);
            }

            let actualTarget: Vector3 = pov.target;

            if (
                this.camera.position.x === pov.target.x &&
                this.camera.position.y === pov.target.y
            ) {
                // Since we have a perfectly vertical line of sight, we cannot set the camera position
                // to the exact same XY coordinates as the target, otherwise we run into the
                // typical gimbal lock problem. That can be easly solved by adding a slight
                // offset on any axis. Here we arbitrarily choose the Y axis.
                const GIMBAL_LOCK_EPSILON = -0.001;

                actualTarget = pov.target.clone().setY(pov.target.y + GIMBAL_LOCK_EPSILON);
            }

            this.camera.lookAt(actualTarget);

            if (isOrthographicCamera(this.camera)) {
                this.camera.zoom = pov.orthographicZoom;
            }

            this.camera.updateMatrixWorld(true);
        }

        this.dispatchEvent({ type: 'change' });
    }

    /**
     * Setup the camera to match the specified object or point of view.
     *
     * - If the argument is a {@link PointOfView}, this will be used directly.
     * - If the object implements {@link HasDefaultPointOfView}, this will be used to compute the point of view.
     * - Otherwise, a default point of view is computed from the object's bounding box.
     *
     * **Important note:** this method does not update any camera controls that are controlling the camera.
     * Those controls have to be updated manually so they do not override the new camera position. For example,
     * controls that have a target must be updated so that the target position matches the one returned by this method.
     * @param obj - The object to go to.
     * @param options - The options.
     * @returns The immutable {@link PointOfView} that was used to setup the camera, or `null` if it couldn't be computed.
     */
    goTo(
        obj: Object3D | HasDefaultPointOfView | PointOfView,
        options?: {
            /**
             * Allow moving the camera. If `false`, the camera is only rotated to look at the object.
             * @defaultValue true
             */
            allowTranslation?: boolean;
        },
    ): Readonly<PointOfView> | null {
        if (obj == null) {
            return null;
        }

        let pov: PointOfView | null = null;

        if (isPointOfView(obj)) {
            pov = { ...obj };
        } else if (hasDefaultPointOfView(obj)) {
            pov = obj.getDefaultPointOfView({ camera: this.camera });
        } else {
            pov = this.getDefaultPointOfView(obj);
        }

        if (pov != null) {
            this.applyPointOfView(pov, options?.allowTranslation ?? true);
        }

        // Ensure that the point of view is immutable to emphasize
        // the fact that it was created under specific camera conditions
        // and it not applicable to any camera.
        return Object.freeze(pov);
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
