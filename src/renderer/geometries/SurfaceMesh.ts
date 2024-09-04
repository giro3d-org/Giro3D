import type { BufferGeometry, Material } from 'three';
import { Mesh } from 'three';
import type PolygonMesh from './PolygonMesh';
import { type DefaultUserData, type SimpleGeometryMeshEventMap } from './SimpleGeometryMesh';

export default class SurfaceMesh<UserData extends DefaultUserData = DefaultUserData> extends Mesh<
    BufferGeometry,
    Material,
    SimpleGeometryMeshEventMap
> {
    readonly isSurfaceMesh = true as const;
    readonly type = 'SurfaceMesh' as const;

    private _featureOpacity = 1;
    private _styleOpacity = 1;

    override userData: Partial<UserData> = {};

    parent: PolygonMesh<UserData> | null = null;

    constructor(params: { geometry: BufferGeometry; material: Material; opacity: number }) {
        super(params.geometry, params.material);
        this._styleOpacity = params.opacity;
        this.matrixAutoUpdate = false;
    }

    set opacity(opacity: number) {
        this._featureOpacity = opacity;
        this.updateOpacity();
    }

    private updateOpacity() {
        this.material.opacity = this._featureOpacity * this._styleOpacity;
        this.material.transparent = this.material.opacity < 1;
    }

    update(options: { material: Material; opacity: number; renderOrder: number }) {
        this.material = options.material;
        this._styleOpacity = options.opacity;
        this.renderOrder = options.renderOrder;
        this.visible = true;
        this.updateOpacity();
    }

    dispose() {
        this.geometry.dispose();
        // Don't dispose the material as it is not owned by this mesh.
        this.dispatchEvent({ type: 'dispose' });
    }
}

export function isSurfaceMesh<UserData extends DefaultUserData = DefaultUserData>(
    obj: unknown,
): obj is SurfaceMesh<UserData> {
    return (obj as SurfaceMesh)?.isSurfaceMesh ?? false;
}
