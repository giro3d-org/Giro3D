/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { BufferGeometry, Material } from 'three';

import { Mesh } from 'three';

import type PolygonMesh from './PolygonMesh';

import { type FeatureElevation, type FeatureExtrusionOffset } from '../../core/FeatureTypes';
import { type DefaultUserData, type SimpleGeometryMeshEventMap } from './SimpleGeometryMesh';

export default class SurfaceMesh<UserData extends DefaultUserData = DefaultUserData> extends Mesh<
    BufferGeometry,
    Material,
    SimpleGeometryMeshEventMap
> {
    public readonly isSurfaceMesh = true as const;
    public override readonly type = 'SurfaceMesh' as const;

    private _featureOpacity = 1;
    private _styleOpacity = 1;

    public override userData: Partial<UserData> = {};

    public override parent: PolygonMesh<UserData> | null = null;

    public extrusionOffset: FeatureExtrusionOffset | undefined = undefined;
    public elevation: FeatureElevation | undefined = undefined;

    public constructor(params: { geometry: BufferGeometry; material: Material; opacity: number }) {
        super(params.geometry, params.material);
        this._styleOpacity = params.opacity;
        this.matrixAutoUpdate = false;
    }

    public set opacity(opacity: number) {
        this._featureOpacity = opacity;
        this.updateOpacity();
    }

    private updateOpacity(): void {
        this.material.opacity = this._featureOpacity * this._styleOpacity;
        this.material.transparent = this.material.opacity < 1;
    }

    public update(options: { material: Material; opacity: number; renderOrder: number }): void {
        this.material = options.material;
        this._styleOpacity = options.opacity;
        this.renderOrder = options.renderOrder;
        this.visible = true;
        this.updateOpacity();
    }

    public dispose(): void {
        this.geometry.dispose();
        // Don't dispose the material as it is not owned by this mesh.
        this.dispatchEvent({ type: 'dispose' });
    }
}

export function isSurfaceMesh<UserData extends DefaultUserData = DefaultUserData>(
    obj: unknown,
): obj is SurfaceMesh<UserData> {
    return (obj as SurfaceMesh)?.isSurfaceMesh ?? false;
}
