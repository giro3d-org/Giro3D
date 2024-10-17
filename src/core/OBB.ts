import { Box3, Object3D, Vector3 } from 'three';

class OBB extends Object3D {
    readonly isHelper = true as const;
    readonly type = 'OBB' as const;
    readonly box3D: Box3;
    readonly natBox: Box3;
    z: { min: number; max: number };
    topPointsWorld: Vector3[];

    constructor(min: Vector3, max: Vector3) {
        super();
        this.box3D = new Box3(min.clone(), max.clone());
        this.natBox = this.box3D.clone();
        this.z = { min: 0, max: 0 };
        this.topPointsWorld = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
        this.update();
    }

    clone(): this {
        const cOBB = new OBB(this.natBox.min, this.natBox.max);
        cOBB.position.copy(this.position);
        cOBB.quaternion.copy(this.quaternion);
        return cOBB as this;
    }

    updateMinMax(min: Vector3, max: Vector3) {
        this.box3D.min.copy(min);
        this.box3D.max.copy(max);
        this.natBox.copy(this.box3D);
        this.update();
    }

    update() {
        this.updateMatrixWorld(true);
        this._cPointsWorld(this._points(this.topPointsWorld));
    }

    updateZ(min: number, max: number) {
        this.z = { min, max };
        this.box3D.min.z = this.natBox.min.z + min;
        this.box3D.max.z = this.natBox.max.z + max;
        this.update();
    }

    _points(points: Vector3[]) {
        // top points of bounding box
        points[0].set(this.box3D.max.x, this.box3D.max.y, this.box3D.max.z);
        points[1].set(this.box3D.min.x, this.box3D.max.y, this.box3D.max.z);
        points[2].set(this.box3D.min.x, this.box3D.min.y, this.box3D.max.z);
        points[3].set(this.box3D.max.x, this.box3D.min.y, this.box3D.max.z);
        // bottom points of bounding box
        if (points.length > 4) {
            points[4].set(this.box3D.max.x, this.box3D.max.y, this.box3D.min.z);
            points[5].set(this.box3D.min.x, this.box3D.max.y, this.box3D.min.z);
            points[6].set(this.box3D.min.x, this.box3D.min.y, this.box3D.min.z);
            points[7].set(this.box3D.max.x, this.box3D.min.y, this.box3D.min.z);
        }

        return points;
    }

    _cPointsWorld(points: Vector3[]) {
        const m = this.matrixWorld;

        for (let i = 0, max = points.length; i < max; i++) {
            points[i].applyMatrix4(m);
        }

        return points;
    }
}
export default OBB;
