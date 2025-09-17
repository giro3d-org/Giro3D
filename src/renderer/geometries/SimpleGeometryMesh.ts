/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Object3D, Object3DEventMap, Vector3 } from 'three';

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
    geometryOrigin: Vector3 | undefined;
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
