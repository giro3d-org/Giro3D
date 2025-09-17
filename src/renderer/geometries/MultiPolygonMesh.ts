/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Vector3 } from 'three';

import { Object3D } from 'three';

import type PolygonMesh from './PolygonMesh';
import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData, SimpleGeometryMeshEventMap } from './SimpleGeometryMesh';

import { isPolygonMesh } from './PolygonMesh';

export default class MultiPolygonMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Object3D<SimpleGeometryMeshEventMap>
    implements SimpleGeometryMesh<UserData>
{
    public readonly isSimpleGeometryMesh = true as const;
    public readonly isMultiPolygonMesh = true as const;
    public override readonly type = 'MultiPolygonMesh' as const;

    public geometryOrigin: Vector3 | undefined;

    public override userData: Partial<UserData> = {};

    public set opacity(opacity: number) {
        this.traversePolygons(p => (p.opacity = opacity));
    }

    public constructor(polygons: PolygonMesh[]) {
        super();
        this.matrixAutoUpdate = false;
        this.add(...polygons);
    }

    /**
     * Executes the callback on all the {@link PolygonMesh}es of this mesh.
     * @param callback - The callback to execute.
     */
    public traversePolygons(callback: (polygon: PolygonMesh) => void): void {
        this.traverse(obj => {
            if (isPolygonMesh(obj)) {
                callback(obj);
            }
        });
    }

    public dispose(): void {
        this.traversePolygons(p => p.dispose());
        this.dispatchEvent({ type: 'dispose' });
    }
}

export function isMultiPolygonMesh(obj: unknown): obj is MultiPolygonMesh {
    return (obj as MultiPolygonMesh)?.isMultiPolygonMesh ?? false;
}
