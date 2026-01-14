/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Object3D } from 'three';

import type LineStringMesh from './LineStringMesh';
import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData, SimpleGeometryMeshEventMap } from './SimpleGeometryMesh';

import { isLineStringMesh } from './LineStringMesh';

export default class MultiLineStringMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Object3D<SimpleGeometryMeshEventMap>
    implements SimpleGeometryMesh<UserData>
{
    public readonly isSimpleGeometryMesh = true as const;
    public readonly isMultiLineStringMesh = true as const;
    public override readonly type = 'MultiLineStringMesh' as const;

    public override userData: Partial<UserData> = {};

    public set opacity(opacity: number) {
        this.traverseLineStrings(ls => (ls.opacity = opacity));
    }

    public constructor(lineStrings: LineStringMesh[]) {
        super();
        this.matrixAutoUpdate = false;
        this.add(...lineStrings);
    }

    public dispose(): void {
        this.traverseLineStrings(ls => ls.dispose());
        this.dispatchEvent({ type: 'dispose' });
    }

    /**
     * Executes the callback on all the {@link LineStringMesh}es of this mesh.
     * @param callback - The callback to execute.
     */
    public traverseLineStrings(callback: (obj: LineStringMesh) => void): void {
        this.traverse(obj => {
            if (isLineStringMesh(obj)) {
                callback(obj);
            }
        });
    }
}

export function isMultiLineStringMesh(obj: unknown): obj is MultiLineStringMesh {
    return (obj as MultiLineStringMesh)?.isMultiLineStringMesh ?? false;
}
