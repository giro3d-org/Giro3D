import type { Camera, PerspectiveCamera, Scene, SpriteMaterial, WebGLRenderer } from 'three';
import { MathUtils, Sprite } from 'three';
import { DEFAULT_POINT_SIZE } from '../../core/FeatureTypes';
import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData } from './SimpleGeometryMesh';

export type ConstructorParams = { material: SpriteMaterial; opacity?: number; pointSize?: number };

export default class PointMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Sprite
    implements SimpleGeometryMesh<UserData>
{
    readonly isSimpleGeometryMesh = true as const;
    readonly isPointMesh = true as const;
    readonly type = 'PointMesh' as const;

    private _featureOpacity = 1;
    private _styleOpacity = 1;
    private _pointSize: number;

    override userData: Partial<UserData> = {};

    constructor(params: ConstructorParams) {
        super(params.material);
        this._styleOpacity = params.opacity ?? 1;
        this._pointSize = params.pointSize ?? DEFAULT_POINT_SIZE;

        // We initialize the scale at zero and it will be updated with
        // onBeforeRender() whenever the point become visible. This is necessary
        // to avoid intercepting raycasts when the scale is not yet computed.
        this.scale.set(0, 0, 0);
        this.updateMatrix();
        this.updateMatrixWorld(true);
    }

    set opacity(opacity: number) {
        this._featureOpacity = opacity;
        this.updateOpacity();
    }

    private updateOpacity() {
        this.material.opacity = this._featureOpacity * this._styleOpacity;
        // Because of textures, we have to force transparency
        this.material.transparent = true;
        this.matrixAutoUpdate = false;
    }

    onBeforeRender(renderer: WebGLRenderer, _scene: Scene, camera: Camera): void {
        // sprite size stand for sprite height in view
        const perspective = camera as PerspectiveCamera;
        const resolutionHeight = renderer.getRenderTarget()?.height ?? renderer.domElement?.height;
        const fov = MathUtils.degToRad(perspective.fov);
        const spriteSize = resolutionHeight * (1 / (2 * Math.tan(fov / 2))); // this is in pixel
        // so the real height depends on pixel can be calculate as:
        const scale = 0.75 * (this._pointSize / spriteSize);

        if (this.scale.x !== scale) {
            this.scale.set(scale, scale, 1);

            this.updateMatrix();
            this.updateMatrixWorld(true);
        }
    }

    update(
        options: Omit<ConstructorParams, 'material'> & {
            material: SpriteMaterial | null;
            renderOrder: number;
        },
    ) {
        if (options.material) {
            this.material = options.material;
            this._styleOpacity = options.opacity ?? 1;
            this.updateOpacity();
            this._pointSize = options.pointSize ?? DEFAULT_POINT_SIZE;
        }

        this.renderOrder = options.renderOrder;

        // We can't have no material on a mesh,
        // so setting a material to "null" only hides the mesh.
        this.visible = options.material != null;
    }

    dispose(): void {
        this.geometry.dispose();
        // Don't dispose the material as it is not owned by this mesh.

        // @ts-expect-error dispose is not known because the types for three.js
        // "forget" to expose event map to subclasses.
        this.dispatchEvent({ type: 'dispose' });
    }
}

export function isPointMesh<UserData extends DefaultUserData = DefaultUserData>(
    obj: unknown,
): obj is PointMesh<UserData> {
    return (obj as PointMesh)?.isPointMesh ?? false;
}
