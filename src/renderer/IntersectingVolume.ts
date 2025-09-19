/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Color, Matrix4 } from 'three';

export type IntersectingVolume = {
    worldToBoxNdc: Matrix4;
    color: Color;
};

export type IntersectingVolumeUniform = {
    viewToBoxNc: Matrix4;
    color: Color;
};

export type IntersectingVolumesUniform = {
    count: number;
    volumes: IntersectingVolumeUniform[];
};
