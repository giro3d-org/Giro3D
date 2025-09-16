/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { ColorRepresentation } from 'three';
import { Box3, Box3Helper, Color, Matrix4, Object3D, Vector3 } from 'three';
import type { OBB } from 'three/examples/jsm/Addons.js';

/**
 * Helper object to visualize an {@link OBB | Oriented Bounding Box}.
 */
export default class OBBHelper extends Object3D {
    override readonly type = 'OBBHelper' as const;
    readonly isOBBHelper = true as const;

    private _helper: Box3Helper;
    private _color: Color;

    constructor(
        readonly obb: OBB,
        color: ColorRepresentation,
    ) {
        super();

        this._color = new Color(color);

        this._helper = this.buildHelper();
        this.setRotationFromMatrix(new Matrix4().setFromMatrix3(this.obb.rotation));
        this.position.copy(this.obb.center);
        this.updateMatrix();
        this.updateMatrixWorld(true);
    }

    private buildHelper() {
        const helper = new Box3Helper(
            new Box3().setFromCenterAndSize(new Vector3(0, 0, 0), this.obb.getSize(new Vector3())),
            this._color,
        );

        helper.raycast = () => {};
        this.raycast = () => {};
        this.add(helper);

        return helper;
    }

    set color(v: ColorRepresentation) {
        const newColor = new Color(v);

        if (!newColor.equals(this._color)) {
            this._color = newColor;
            this._helper.dispose();
            this._helper.removeFromParent();
            this._helper = this.buildHelper();
            this.updateMatrixWorld(true);
        }
    }

    /**
     * Frees the GPU-related resources allocated by this instance
     * @remarks
     * Call this method whenever this instance is no longer used in your app.
     */
    dispose() {
        this._helper.dispose();
    }
}
