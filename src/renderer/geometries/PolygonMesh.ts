/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Polygon } from 'ol/geom';
import type { Vector3 } from 'three';

import { Object3D } from 'three';

import type LineStringMesh from './LineStringMesh';
import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData, SimpleGeometryMeshEventMap } from './SimpleGeometryMesh';
import type SurfaceMesh from './SurfaceMesh';

/**
 * Represents a single polygon geometry, including the surface and the rings.
 */
export default class PolygonMesh<UserData extends DefaultUserData = DefaultUserData>
    extends Object3D<SimpleGeometryMeshEventMap>
    implements SimpleGeometryMesh
{
    public readonly isSimpleGeometryMesh = true as const;
    public readonly isPolygonMesh = true as const;
    public override readonly type = 'PolygonMesh' as const;
    public geometryOrigin: Vector3 | undefined;

    public readonly isExtruded: boolean = false;

    private _featureOpacity = 1;
    private _surface: SurfaceMesh | null = null;
    private _linearRings: LineStringMesh<UserData>[] | null = null;
    public readonly source: Polygon;

    public override userData: Partial<UserData> = {};

    public get surface(): SurfaceMesh | null {
        return this._surface;
    }

    public set surface(newSurface: SurfaceMesh | null) {
        this._surface?.dispose();
        this._surface?.removeFromParent();
        this._surface = newSurface;

        if (newSurface) {
            newSurface.opacity = this._featureOpacity;
            this.add(newSurface);
            this.updateMatrixWorld(true);
        }
    }

    public get linearRings(): LineStringMesh<UserData>[] | null {
        return this._linearRings;
    }

    public set linearRings(newRings: LineStringMesh<UserData>[] | null) {
        this._linearRings?.forEach(ring => {
            ring.removeFromParent();
            ring.dispose();
        });
        this._linearRings = newRings;
        if (newRings) {
            newRings.forEach(ring => (ring.opacity = this._featureOpacity));
            this.add(...newRings);
            this.updateMatrixWorld(true);
        }
    }

    public set opacity(opacity: number) {
        this._featureOpacity = opacity;
        if (this._surface) {
            this._surface.opacity = opacity;
        }
        if (this.linearRings) {
            this.linearRings.forEach(ring => (ring.opacity = opacity));
        }
    }

    public constructor(options: {
        source: Polygon;
        surface?: SurfaceMesh;
        linearRings?: LineStringMesh<UserData>[];
        isExtruded?: boolean;
    }) {
        super();

        this.matrixAutoUpdate = false;

        this.source = options.source;
        this._surface = options.surface ?? null;
        this._linearRings = options.linearRings ?? null;
        this.isExtruded = options.isExtruded ?? false;

        if (this._surface) {
            this.add(this._surface);
        }
        if (this._linearRings) {
            this.add(...this._linearRings);
        }
    }

    public dispose(): void {
        this._surface?.dispose();
        this._linearRings?.forEach(ring => ring.dispose());
        this.dispatchEvent({ type: 'dispose' });
    }
}

export function isPolygonMesh(obj: unknown): obj is PolygonMesh {
    return (obj as PolygonMesh)?.isPolygonMesh ?? false;
}
