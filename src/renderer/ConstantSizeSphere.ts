import {
    MathUtils,
    Mesh,
    MeshStandardMaterial,
    SphereGeometry,
    Vector2,
    Vector3,
    type Camera,
    type Intersection,
    type Material,
    type OrthographicCamera,
    type PerspectiveCamera,
    type Raycaster,
    type Scene,
    type WebGLRenderer,
} from 'three';

const tmpOrigin = new Vector3();
const tmpPosition = new Vector3();
const tmpSize = new Vector2();

const DEFAULT_MATERIAL = new MeshStandardMaterial({ color: 'red' });

function isPerspectiveCamera(cam: unknown): cam is PerspectiveCamera {
    return (cam as PerspectiveCamera).isPerspectiveCamera;
}

function isOrthographicCamera(cam: unknown): cam is OrthographicCamera {
    return (cam as OrthographicCamera).isOrthographicCamera;
}

const SHARED_GEOMETRY = new SphereGeometry(1);
const DEFAULT_RADIUS = 10;

/**
 * A 3D sphere that maintains the same apparent radius in screen space pixels.
 */
export default class ConstantSizeSphere extends Mesh {
    /**
     * The radius, in pixels.
     */
    radius: number;

    enableRaycast = true;

    readonly isConstantSizeSphere = true as const;
    readonly type = 'ConstantSizeSphere' as const;

    constructor(options?: {
        /**
         * The sphere apparent radius, in pixels.
         * @defaultValue 10
         */
        radius?: number;
        /**
         * The sphere material.
         * @defaultValue a {@link MeshStandardMaterial} with a red color.
         */
        material?: Material;
    }) {
        super(SHARED_GEOMETRY, options?.material ?? DEFAULT_MATERIAL);

        this.radius = options?.radius ?? DEFAULT_RADIUS;
    }

    raycast(raycaster: Raycaster, intersects: Intersection[]): void {
        if (this.enableRaycast) {
            super.raycast(raycaster, intersects);
        }
    }

    onBeforeRender(renderer: WebGLRenderer, _scene: Scene, camera: Camera): void {
        const scale = getWorldSpaceRadius(
            renderer,
            camera,
            this.getWorldPosition(tmpPosition),
            this.radius,
        );

        this.scale.set(scale, scale, scale);
        this.updateMatrixWorld(true);
    }
}

/**
 * Returns the radius in world units so that a sphere appears to have a given radius in pixels.
 */
export function getWorldSpaceRadius(
    renderer: WebGLRenderer,
    camera: Camera,
    worldPosition: Vector3,
    screenSpaceRadius: number,
) {
    const origin = camera.getWorldPosition(tmpOrigin);
    const dist = origin.distanceTo(worldPosition);

    let fieldOfViewHeight: number;

    if (isPerspectiveCamera(camera)) {
        const fovRads = MathUtils.degToRad(camera.fov);
        fieldOfViewHeight = Math.tan(fovRads) * dist;
    } else if (isOrthographicCamera(camera)) {
        fieldOfViewHeight = Math.abs(camera.top - camera.bottom);
    }

    const size = renderer.getSize(tmpSize);

    const pixelRatio = screenSpaceRadius / size.y;

    const worldSpaceRadius = fieldOfViewHeight * pixelRatio;

    return worldSpaceRadius;
}

export function isConstantSizeSphere(obj: unknown): obj is ConstantSizeSphere {
    if (obj == null) {
        return false;
    }

    return (obj as ConstantSizeSphere).isConstantSizeSphere;
}
