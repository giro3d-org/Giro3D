/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, Vector3 } from 'three';

interface BoundingBox {
    lx: number;
    ly: number;
    lz: number;

    ux: number;
    uy: number;
    uz: number;
}

export function toBox3(input: BoundingBox): Box3 {
    const box = new Box3(
        new Vector3(input.lx, input.ly, input.lz),
        new Vector3(input.ux, input.uy, input.uz),
    );

    return box;
}

export default BoundingBox;
