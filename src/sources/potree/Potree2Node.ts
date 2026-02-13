/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { PointCloudNode } from '../PointCloudSource';

// TODO chheck values
export enum NodeType {
    Normal = 0,
    Leaf = 1,
    Proxy = 2,
}

export default interface Potree2Node extends PointCloudNode {
    nodeType: NodeType;

    children: Potree2Node[];

    hierarchyByteOffset: bigint;
    hierarchyByteSize: bigint;

    byteSize?: bigint;
    byteOffset: bigint;
}
