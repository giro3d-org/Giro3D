/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Polygon } from 'ol/geom';
import { BufferGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { LineGeometry, LineMaterial } from 'three/examples/jsm/Addons.js';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import LineStringMesh from '@giro3d/giro3d/renderer/geometries/LineStringMesh';
import PolygonMesh, { isPolygonMesh } from '@giro3d/giro3d/renderer/geometries/PolygonMesh';
import { isSimpleGeometryMesh } from '@giro3d/giro3d/renderer/geometries/SimpleGeometryMesh';
import SurfaceMesh from '@giro3d/giro3d/renderer/geometries/SurfaceMesh';

const DEFAULT_POLYGON = new Polygon([]);

export function makeSurfaceGeometry(options?: { vertexCount?: number }): BufferGeometry {
    const geometry = new BufferGeometry();

    const vertexCount = options?.vertexCount ?? 20;

    geometry.setIndex(new Array(vertexCount));
    geometry.setFromPoints(new Array<Vector3>(vertexCount).fill(new Vector3()));

    return geometry;
}

export function makeFlatSurface(options?: {
    vertexCount?: number;
    material?: MeshBasicMaterial;
    opacity?: number;
}): SurfaceMesh {
    const material = options?.material ?? new MeshBasicMaterial();

    const geometry = makeSurfaceGeometry(options);

    return new SurfaceMesh({ geometry, material, opacity: options?.opacity ?? 1 });
}

export function makeRings(options?: {
    count?: number;
    vertexCount?: number;
    material?: LineMaterial;
    opacity?: number;
}) {
    const result = [];
    const count = options?.count ?? 3;

    const material = options?.material ?? new LineMaterial();
    for (let i = 0; i < count; i++) {
        const geometry = new LineGeometry();
        if (options?.vertexCount != null) {
            geometry.setFromPoints(new Array<Vector3>(options.vertexCount).fill(new Vector3()));
        }
        result.push(new LineStringMesh(geometry, material, options?.opacity ?? 1));
    }

    return result;
}

export function makePolygonMesh(options?: {
    surfaceMaterial?: MeshBasicMaterial;
    ringMaterial?: LineMaterial;
    opacity?: number;
}) {
    return new PolygonMesh({
        source: DEFAULT_POLYGON,
        surface: makeFlatSurface({ material: options?.surfaceMaterial, opacity: options?.opacity }),
        linearRings: makeRings({ material: options?.ringMaterial, opacity: options?.opacity }),
    });
}

describe('constructor', () => {
    it('should assign properties', () => {
        const surface = makeFlatSurface();
        const linearRings = makeRings();
        const mesh = new PolygonMesh({ source: DEFAULT_POLYGON, surface, linearRings });

        expect(mesh.surface).toBe(surface);
        expect(mesh.linearRings).toBe(linearRings);
        expect(mesh.isPolygonMesh).toEqual(true);
        expect(mesh.isSimpleGeometryMesh).toEqual(true);
        expect(mesh.type).toEqual('PolygonMesh');
    });
});

describe('dispose', () => {
    it('should call dispose on surface and linear rings', () => {
        const surface = makeFlatSurface();
        const linearRings = makeRings({ count: 10 });

        surface.dispose = vitest.fn();
        linearRings.forEach(r => (r.dispose = vitest.fn()));

        const mesh = new PolygonMesh({ source: DEFAULT_POLYGON, surface, linearRings });
        mesh.dispose();

        expect(surface.dispose).toHaveBeenCalledTimes(1);
        linearRings.forEach(r => expect(r.dispose).toHaveBeenCalledTimes(1));
    });

    it('should dispatch dispose event', () => {
        const surface = makeFlatSurface();
        const linearRings = makeRings({ count: 10 });

        const mesh = new PolygonMesh({ source: DEFAULT_POLYGON, surface, linearRings });

        let called = false;
        mesh.addEventListener('dispose', () => (called = true));

        mesh.dispose();

        expect(called).toEqual(true);
    });
});

describe('surface', () => {
    let mesh: PolygonMesh;

    beforeEach(() => {
        const surface = makeFlatSurface();
        const linearRings = makeRings();
        mesh = new PolygonMesh({ source: DEFAULT_POLYGON, surface, linearRings });
    });

    describe('set', () => {
        it('should replace the current surface', () => {
            const oldSurface = mesh.surface!;
            oldSurface.dispose = vitest.fn();
            const newSurface = makeFlatSurface();

            mesh.opacity = 0.33;
            mesh.surface = newSurface;

            expect(oldSurface.dispose).toHaveBeenCalled();
            expect(oldSurface.parent).toBeNull();
            expect(newSurface.parent).toBe(mesh);

            expect(mesh.children).toContain(newSurface);
            expect(mesh.surface.material.opacity).toEqual(0.33);
        });

        it('should handle setting to null', () => {
            mesh.surface = null;

            expect(mesh.surface).toBeNull();
        });
    });
});

describe('linearRings', () => {
    describe('set', () => {
        let mesh: PolygonMesh;

        beforeEach(() => {
            const surface = makeFlatSurface();
            const linearRings = makeRings();
            mesh = new PolygonMesh({ source: DEFAULT_POLYGON, surface, linearRings });
        });

        it('should handle setting to null', () => {
            mesh.linearRings = null;

            expect(mesh.linearRings).toBeNull();
        });

        it('should remove current rings', () => {
            const currentRings = mesh.linearRings!;
            currentRings.forEach(ring => (ring.dispose = vitest.fn()));

            const newRings = makeRings();

            mesh.linearRings = newRings;

            currentRings.forEach(ring => {
                expect(ring.dispose).toHaveBeenCalled();
                expect(ring.parent).toBeNull();
            });
        });

        it('should set linearRings to new rings', () => {
            const currentRings = mesh.linearRings!;
            currentRings.forEach(ring => (ring.dispose = vitest.fn()));

            const newRings = makeRings();

            mesh.linearRings = newRings;

            expect(mesh.linearRings).toBe(newRings);
            newRings.forEach(ring => expect(mesh.children).toContain(ring));
        });

        it('should update the opacity of new rings', () => {
            const currentRings = mesh.linearRings!;
            currentRings.forEach(ring => (ring.dispose = vitest.fn()));

            const newRings = makeRings();

            mesh.opacity = 0.5;
            mesh.linearRings = newRings;

            newRings.forEach(ring => expect(ring.material.opacity).toEqual(0.5));
        });
    });
});

describe('isPolygonMesh', () => {
    it('should return true if obj is PolygonMesh', () => {
        const mesh = new PolygonMesh({ source: DEFAULT_POLYGON });
        expect(isPolygonMesh(mesh)).toEqual(true);
        expect(isPolygonMesh('foo')).toEqual(false);
        expect(isPolygonMesh(undefined)).toEqual(false);
    });
});

describe('isSimpleGeometryMesh', () => {
    it('should return true if obj is PolygonMesh', () => {
        const mesh = new PolygonMesh({ source: DEFAULT_POLYGON });
        expect(isSimpleGeometryMesh(mesh)).toEqual(true);
        expect(isSimpleGeometryMesh('foo')).toEqual(false);
        expect(isSimpleGeometryMesh(undefined)).toEqual(false);
    });
});

describe('opacity', () => {
    it('(surface only) should call opacity on surface', () => {
        const surfaceMaterial = new MeshBasicMaterial();
        const surface = makeFlatSurface({ material: surfaceMaterial, opacity: 0.7 });
        const mesh = new PolygonMesh({ source: DEFAULT_POLYGON, surface, linearRings: undefined });

        mesh.opacity = 0.33;

        expect(surfaceMaterial.opacity).toEqual(0.7 * 0.33);
    });

    it('(linear rings only) should call opacity linear rings', () => {
        const ringMaterial = new LineMaterial();
        const linearRings = makeRings({ material: ringMaterial, opacity: 0.22 });

        const mesh = new PolygonMesh({ source: DEFAULT_POLYGON, surface: undefined, linearRings });

        mesh.opacity = 0.33;

        expect(ringMaterial.opacity).toEqual(0.22 * 0.33);
    });

    it('should call opacity on surface and linear rings', () => {
        const surfaceMaterial = new MeshBasicMaterial();
        const surface = makeFlatSurface({ material: surfaceMaterial, opacity: 0.7 });
        const ringMaterial = new LineMaterial();
        const linearRings = makeRings({ material: ringMaterial, opacity: 0.22 });

        const mesh = new PolygonMesh({ source: DEFAULT_POLYGON, surface, linearRings });

        mesh.opacity = 0.33;

        expect(surfaceMaterial.opacity).toEqual(0.7 * 0.33);
        expect(ringMaterial.opacity).toEqual(0.22 * 0.33);
    });
});
