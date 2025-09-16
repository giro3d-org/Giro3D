/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Object3D } from 'three';

import type PointMesh from './PointMesh';
import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData, SimpleGeometryMeshEventMap } from './SimpleGeometryMesh';

import { isPointMesh } from './PointMesh';

export default class MultiPointMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Object3D<SimpleGeometryMeshEventMap>
    implements SimpleGeometryMesh<UserData>
{
    public readonly isSimpleGeometryMesh = true as const;
    public readonly isMultiPointMesh = true as const;
    public override readonly type = 'MultiPointMesh' as const;

    public override userData: Partial<UserData> = {};

    public constructor(points: PointMesh[]) {
        super();
        this.add(...points);
    }

    public set opacity(opacity: number) {
        this.traversePoints(p => (p.opacity = opacity));
    }

    /**
     * Executes the callback on all the {@link PointMesh}es of this mesh.
     * @param callback - The callback to execute.
     */
    public traversePoints(callback: (polygon: PointMesh) => void): void {
        this.traverse(obj => {
            if (isPointMesh(obj)) {
                callback(obj);
            }
        });
    }

    public dispose(): void {
        this.traversePoints(p => p.dispose());
        this.dispatchEvent({ type: 'dispose' });
    }
}

export function isMultiPointMesh(obj: unknown): obj is MultiPointMesh {
    return (obj as MultiPointMesh)?.isMultiPointMesh ?? false;
}
