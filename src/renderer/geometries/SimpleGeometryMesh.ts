import type { Object3D, Object3DEventMap } from 'three';

export type DefaultUserData = Record<string, unknown>;

export interface SimpleGeometryMeshEventMap extends Object3DEventMap {
    dispose: unknown;
}

export type SimpleGeometryMeshTypes =
    | 'PointMesh'
    | 'MultiPointMesh'
    | 'PolygonMesh'
    | 'MultiPolygonMesh'
    | 'LineStringMesh'
    | 'MultiLineStringMesh';

/**
 * Interface for meshes that represent a single OpenLayers Geometry.
 */
interface SimpleGeometryMesh<
    UserData extends DefaultUserData = DefaultUserData,
    TEvents extends SimpleGeometryMeshEventMap = SimpleGeometryMeshEventMap,
> extends Object3D<TEvents> {
    isSimpleGeometryMesh: true;
    type: SimpleGeometryMeshTypes;
    /**
     * Disposes the resources owned by this mesh.
     */
    dispose(): void;

    userData: Partial<UserData>;

    /**
     * Sets the opacity of the mesh. This opacity is combined with the opacity of the material.
     */
    set opacity(opacity: number);
}

export default SimpleGeometryMesh;

export function isSimpleGeometryMesh<T extends DefaultUserData = DefaultUserData>(
    obj: unknown,
): obj is SimpleGeometryMesh<T> {
    return (obj as SimpleGeometryMesh)?.isSimpleGeometryMesh ?? false;
}
