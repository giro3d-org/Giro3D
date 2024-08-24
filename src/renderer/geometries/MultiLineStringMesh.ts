import { Object3D } from 'three';
import type LineStringMesh from './LineStringMesh';
import { isLineStringMesh } from './LineStringMesh';
import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData, SimpleGeometryMeshEventMap } from './SimpleGeometryMesh';

export default class MultiLineStringMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Object3D<SimpleGeometryMeshEventMap>
    implements SimpleGeometryMesh<UserData>
{
    readonly isSimpleGeometryMesh = true as const;
    readonly isMultiLineStringMesh = true as const;
    readonly type = 'MultiLineStringMesh' as const;

    override userData: Partial<UserData> = {};

    set opacity(opacity: number) {
        this.traverseLineStrings(ls => (ls.opacity = opacity));
    }

    constructor(lineStrings: LineStringMesh[]) {
        super();
        this.matrixAutoUpdate = false;
        this.add(...lineStrings);
    }

    dispose() {
        this.traverseLineStrings(ls => ls.dispose());
        this.dispatchEvent({ type: 'dispose' });
    }

    /**
     * Executes the callback on all the {@link LineStringMesh}es of this mesh.
     * @param callback - The callback to execute.
     */
    traverseLineStrings(callback: (obj: LineStringMesh) => void) {
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
