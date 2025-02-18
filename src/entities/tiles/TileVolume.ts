import type { Matrix4, Sphere, Vector3 } from 'three';
import { Box3 } from 'three';
import type ElevationRange from '../../core/ElevationRange';

const tmpBox = new Box3();

/**
 * Provides an approximated volume taken by a {@link TileGeometry}
 * used for culling and LOD computation.
 */
export default abstract class TileVolume {
    protected _localBox: Box3 | null = null;

    get localBox(): Readonly<Box3> {
        if (!this._localBox) {
            this._localBox = this.computeLocalBox();
        }
        return this._localBox;
    }

    abstract getWorldSpaceCorners(matrix: Matrix4): Vector3[];

    protected abstract computeLocalBox(): Box3;

    abstract setElevationRange(range: ElevationRange): void;

    /**
     * Returns the local size of this volume.
     */
    getLocalSize(target: Vector3): Vector3 {
        return this.localBox.getSize(target);
    }

    /**
     * Returns the local bounding box.
     */
    getLocalBoundingBox(target?: Box3): Box3 {
        const result = target ?? new Box3();

        result.copy(this.localBox);

        return result;
    }

    /**
     * Gets the world bounding box, taking into account world transformation.
     */
    getWorldSpaceBoundingBox(target: Box3, matrix: Matrix4): Box3 {
        const result = target ?? new Box3();

        result.copy(this.localBox);

        result.applyMatrix4(matrix);

        return result;
    }

    getWorldSpaceBoundingSphere(target: Sphere, matrix: Matrix4): Sphere {
        return this.getWorldSpaceBoundingBox(tmpBox, matrix).getBoundingSphere(target);
    }
}
