import type { ColorRepresentation } from 'three';
import { Box3, Box3Helper, Matrix4, Object3D, Vector3 } from 'three';
import type { OBB } from 'three/examples/jsm/Addons.js';

/**
 * Helper object to visualize an {@link OBB | Oriented Bounding Box}.
 */
export default class OBBHelper extends Object3D {
    private readonly _helper: Box3Helper;

    constructor(
        readonly obb: OBB,
        color: ColorRepresentation,
    ) {
        super();

        const helper = new Box3Helper(
            new Box3().setFromCenterAndSize(new Vector3(0, 0, 0), obb.getSize(new Vector3())),
            color,
        );

        this._helper = helper;
        helper.raycast = () => {};
        this.raycast = () => {};
        this.add(helper);

        this.setRotationFromMatrix(new Matrix4().setFromMatrix3(obb.rotation));
        this.position.copy(obb.center);
        this.updateMatrix();
        this.updateMatrixWorld(true);
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
