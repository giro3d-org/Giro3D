import { Object3D } from 'three';
import type PolygonMesh from './PolygonMesh';
import { isPolygonMesh } from './PolygonMesh';
import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData, SimpleGeometryMeshEventMap } from './SimpleGeometryMesh';

export default class MultiPolygonMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Object3D<SimpleGeometryMeshEventMap>
    implements SimpleGeometryMesh<UserData>
{
    readonly isSimpleGeometryMesh = true as const;
    readonly isMultiPolygonMesh = true as const;
    readonly type = 'MultiPolygonMesh' as const;

    override userData: Partial<UserData> = {};

    set opacity(opacity: number) {
        this.traversePolygons(p => (p.opacity = opacity));
    }

    constructor(polygons: PolygonMesh[]) {
        super();
        this.matrixAutoUpdate = false;
        this.add(...polygons);
    }

    /**
     * Executes the callback on all the {@link PolygonMesh}es of this mesh.
     * @param callback - The callback to execute.
     */
    traversePolygons(callback: (polygon: PolygonMesh) => void) {
        this.traverse(obj => {
            if (isPolygonMesh(obj)) {
                callback(obj);
            }
        });
    }

    dispose() {
        this.traversePolygons(p => p.dispose());
        this.dispatchEvent({ type: 'dispose' });
    }
}

export function isMultiPolygonMesh(obj: unknown): obj is MultiPolygonMesh {
    return (obj as MultiPolygonMesh)?.isMultiPolygonMesh ?? false;
}
