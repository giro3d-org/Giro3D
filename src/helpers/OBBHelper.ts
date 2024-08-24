import {
    BufferAttribute,
    BufferGeometry,
    LineBasicMaterial,
    LineSegments,
    Vector3,
    type Color,
} from 'three';
import type OBB from '../core/OBB';

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

/**
 * Displays an Oriented Bounding Box (OBB).
 *
 */
class OBBHelper extends LineSegments<BufferGeometry, LineBasicMaterial> {
    override readonly type = 'OBBHelper' as const;
    readonly isHelper = true as const;

    constructor(OBB: OBB | undefined, color: Color) {
        const indices = new Uint16Array([
            0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7,
        ]);
        const positions = new Float32Array(8 * 3);

        const geometry = new BufferGeometry();
        geometry.setIndex(new BufferAttribute(indices, 1));
        geometry.setAttribute('position', new BufferAttribute(positions, 3));

        super(
            geometry,
            new LineBasicMaterial({
                color: color.getHex(),
                linewidth: 3,
            }),
        );

        this.frustumCulled = false;

        if (OBB !== undefined) {
            this.update(OBB, color);
        }
    }

    dispose() {
        this.material.dispose();
        this.geometry.dispose();
    }

    setMaterialVisibility(show: boolean) {
        this.material.visible = show;
        // this.textMesh.material.visible = show;
    }

    update(OBB: OBB, color: Color) {
        const { position } = this.geometry.attributes;
        const { array } = position;

        this.material.setValues({ color: color.getHex() });
        OBB._points(points);
        let offset = 0;
        for (const pt of points) {
            pt.toArray(array, offset);
            offset += 3;
        }

        position.needsUpdate = true;

        this.updateMatrix();
        this.updateMatrixWorld(true);
    }
}

export default OBBHelper;
