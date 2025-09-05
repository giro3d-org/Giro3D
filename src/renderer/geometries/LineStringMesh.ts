/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { WebGLRenderer } from 'three';
import type { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import { Line2 } from 'three/examples/jsm/lines/Line2.js';

import type SimpleGeometryMesh from './SimpleGeometryMesh';

import { type DefaultUserData } from './SimpleGeometryMesh';

export default class LineStringMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Line2
    implements SimpleGeometryMesh<UserData>
{
    public readonly isSimpleGeometryMesh = true as const;
    public readonly isLineStringMesh = true as const;
    public override readonly type = 'LineStringMesh' as const;

    private _featureOpacity = 1;
    private _styleOpacity = 1;

    public override userData: Partial<UserData> = {};

    public constructor(geometry: LineGeometry, material: LineMaterial, opacity: number) {
        super(geometry, material);
        this.matrixAutoUpdate = false;
        this._styleOpacity = opacity;
    }

    public dispose(): void {
        this.geometry.dispose();
        // Don't dispose the material as it is not owned by this mesh.

        // @ts-expect-error dispose is not known because the types for three.js
        // "forget" to expose event map to subclasses.
        this.dispatchEvent({ type: 'dispose' });
    }

    public update(options: {
        material: LineMaterial | null;
        opacity: number;
        renderOrder: number;
    }): void {
        if (options.material) {
            this.material = options.material;
            this._styleOpacity = options.opacity;
            this.updateOpacity();
            this.visible = true;
        } else {
            this.visible = false;
        }
        this.renderOrder = options.renderOrder;
    }

    private updateOpacity(): void {
        this.material.opacity = this._styleOpacity * this._featureOpacity;
        this.material.transparent = this.material.opacity < 1;
    }

    public override onBeforeRender(renderer: WebGLRenderer): void {
        // We have to specify the screen size to be able to properly render
        // lines that have a width in pixels. Note that this should be automatically done
        // by three.js in the future, but for now we have to do it manually.
        const { width, height } = renderer.getRenderTarget() ?? renderer.getContext().canvas;
        this.material.resolution.set(width, height);
    }

    public set opacity(opacity: number) {
        this._featureOpacity = opacity;
        this.updateOpacity();
    }
}

export function isLineStringMesh<UserData extends DefaultUserData = DefaultUserData>(
    obj: unknown,
): obj is LineStringMesh<UserData> {
    return (obj as LineStringMesh)?.isLineStringMesh ?? false;
}
