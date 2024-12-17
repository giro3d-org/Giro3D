import { Box3, Vector3 } from 'three';

type BoundingBox = {
    lx: number;
    ly: number;
    lz: number;

    ux: number;
    uy: number;
    uz: number;
};

export function toBox3(input: BoundingBox): Box3 {
    const box = new Box3(
        new Vector3(input.lx, input.ly, input.lz),
        new Vector3(input.ux, input.uy, input.uz),
    );

    return box;
}

export default BoundingBox;
