/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type {
    Camera,
    PerspectiveCamera,
    Scene,
    SpriteMaterial,
    WebGLRenderer,
    Vector3,
} from 'three';

import { MathUtils, Sprite } from 'three';

import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData } from './SimpleGeometryMesh';

import { DEFAULT_POINT_SIZE } from '../../core/FeatureTypes';

export interface ConstructorParams {
    material: SpriteMaterial;
    opacity?: number;
    pointSize?: number;
}

export default class PointMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Sprite
    implements SimpleGeometryMesh<UserData>
{
    public readonly isSimpleGeometryMesh = true as const;
    public readonly isPointMesh = true as const;
    public override readonly type = 'PointMesh' as const;
    public geometryOrigin: Vector3 | undefined;

    private _featureOpacity = 1;
    private _styleOpacity = 1;
    private _pointSize: number;

    public override userData: Partial<UserData> = {};

    public constructor(params: ConstructorParams) {
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

    public set opacity(opacity: number) {
        this._featureOpacity = opacity;
        this.updateOpacity();
    }

    private updateOpacity(): void {
        this.material.opacity = this._featureOpacity * this._styleOpacity;
        // Because of textures, we have to force transparency
        this.material.transparent = true;
        this.matrixAutoUpdate = false;
    }

    public override onBeforeRender(renderer: WebGLRenderer, _scene: Scene, camera: Camera): void {
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

    public update(
        options: Omit<ConstructorParams, 'material'> & {
            material: SpriteMaterial | null;
            renderOrder: number;
        },
    ): void {
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

    public dispose(): void {
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
