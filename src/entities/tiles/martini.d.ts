/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

// import type { Vector3 } from 'three';

declare module '@mapbox/martini' {
    export interface MartiniTile {
        getMesh(error: number): { vertices: Uint16Array; triangles: Uint32Array };
    }

    export default class Martini {
        public constructor(size: number);

        public createTile(terrain: ArrayLike<number>): MartiniTile;
    }
}
