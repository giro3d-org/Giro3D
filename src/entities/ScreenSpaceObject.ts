/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Object3D } from 'three';

import { Box3, PerspectiveCamera, Sphere, Vector2, Vector3 } from 'three';

import type Context from '../core/Context';

import Entity3D from './Entity3D';

export interface ScreenSpaceObjectOptions {
    object: Object3D;
    /**
     * The location of the origin of the object in normalized device coordinates
     * (i.e [-1, -1] is bottom left, and [1, 1] is top-right).
     * @defaultValue [0.5, 0.5]
     */
    location?: Vector2;
}

class ScreenSpaceObject extends Entity3D {
    public override type = 'ScreenSpaceObject' as const;
    public readonly isScreenSpaceObject = true as const;

    private _location: Vector2 = new Vector2(0.5, 0.5);
    private _boundingSphere: Sphere = new Sphere();

    public constructor(options: ScreenSpaceObjectOptions) {
        super();

        this.object3d.add(options.object);

        if (options.location != null) {
            this._location.copy(options.location);
        }

        const boundingBox = new Box3().setFromObject(this.object3d);
        boundingBox.getBoundingSphere(this._boundingSphere);
    }

    public override postUpdate(context: Context): void {
        const camera = context.view.camera;

        const depth = this._boundingSphere.radius * 2;
        const z = depth / (camera.far - camera.near) + 0.01;
        const ndc = new Vector3(this._location.x, this._location.y, z);
        const worldPosition = ndc.unproject(camera);

        this.object3d.position.copy(worldPosition);
        this.object3d.updateMatrixWorld(true);
    }
}

export default ScreenSpaceObject;
