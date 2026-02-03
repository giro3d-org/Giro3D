/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Color, Matrix4 } from 'three';

export interface IntersectingVolume {
    worldToBoxNdc: Matrix4;
    color: Color;
}

export interface IntersectingVolumeUniform {
    viewToBoxNc: Matrix4;
    color: Color;
}

export interface IntersectingVolumesUniform {
    count: number;
    volumes: IntersectingVolumeUniform[];
}
