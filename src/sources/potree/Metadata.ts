/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { AttributeName } from './attributes';
import type BoundingBox from './BoundingBox';

export interface Metadata {
    version: string;
    octreeDir: string;
    points?: number;
    projection?: string;
    boundingBox: BoundingBox;
    tightBoundingBox?: BoundingBox;
    pointAttributes: AttributeName[] | 'LAZ';
    spacing: number;
    scale: number;
    hierarchyStepSize: number;
}
