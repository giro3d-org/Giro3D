/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, Vector3 } from 'three';

const tmpVec3 = new Vector3();

// Adapted from Potree
export default function createChildAABB(aabb: Box3, index: number): Box3 {
    const min = aabb.min.clone();
    const max = aabb.max.clone();
    const size = tmpVec3.subVectors(max, min);

    if ((index & 0b0001) > 0) {
        min.z += size.z / 2;
    } else {
        max.z -= size.z / 2;
    }

    if ((index & 0b0010) > 0) {
        min.y += size.y / 2;
    } else {
        max.y -= size.y / 2;
    }

    if ((index & 0b0100) > 0) {
        min.x += size.x / 2;
    } else {
        max.x -= size.x / 2;
    }

    return new Box3(min, max);
}
