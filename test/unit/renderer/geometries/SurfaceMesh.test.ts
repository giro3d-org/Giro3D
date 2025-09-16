/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import SurfaceMesh, { isSurfaceMesh } from '@giro3d/giro3d/renderer/geometries/SurfaceMesh';
import { MeshLambertMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { makeSurfaceGeometry } from './PolygonMesh.test';

const DEFAULT_GEOMETRY = makeSurfaceGeometry();

describe('constructor', () => {
    it('should assign properties', () => {
        const material = new MeshLambertMaterial();
        const geometry = makeSurfaceGeometry();
        const mesh = new SurfaceMesh({ geometry, material, opacity: 1 });
        expect(mesh.material).toBe(material);
        expect(mesh.geometry).toBe(geometry);
        expect(mesh.userData).toBeDefined();
        expect(mesh.isSurfaceMesh).toEqual(true);
        expect(mesh.type).toEqual('SurfaceMesh');
    });
});

describe('update', () => {
    it('should update the material and opacity', () => {
        const oldMaterial = new MeshLambertMaterial();
        const mesh = new SurfaceMesh({
            geometry: DEFAULT_GEOMETRY,
            material: oldMaterial,
            opacity: 1,
        });
        mesh.opacity = 0.5;

        expect(mesh.renderOrder).toEqual(0);

        const newMaterial = new MeshLambertMaterial();

        mesh.update({ material: newMaterial, opacity: 0.2 });

        expect(mesh.material).toBe(newMaterial);
        expect(mesh.material.opacity).toEqual(0.5 * 0.2);
    });
});

describe('dispose', () => {
    it('should dispose the geometry but NOT the material', () => {
        const material = new MeshLambertMaterial();
        const geometry = makeSurfaceGeometry();
        let materialDisposed = false;
        let geometryDisposed = false;
        const mesh = new SurfaceMesh({ geometry, material, opacity: 1 });
        mesh.geometry.addEventListener('dispose', () => (geometryDisposed = true));
        mesh.material.addEventListener('dispose', () => (materialDisposed = true));
        mesh.dispose();

        expect(materialDisposed).toEqual(false);
        expect(geometryDisposed).toEqual(true);
    });

    it('should dispatch dispose event', () => {
        const mesh = new SurfaceMesh({
            geometry: DEFAULT_GEOMETRY,
            material: new MeshLambertMaterial(),
            opacity: 1,
        });

        let called = false;
        mesh.addEventListener('dispose', () => (called = true));

        mesh.dispose();

        expect(called).toEqual(true);
    });
});

describe('isSurfaceMesh', () => {
    it('should return true if obj is PointMesh', () => {
        const mesh = new SurfaceMesh({
            geometry: DEFAULT_GEOMETRY,
            material: new MeshLambertMaterial(),
            opacity: 1,
        });
        expect(isSurfaceMesh(mesh)).toEqual(true);
        expect(isSurfaceMesh('foo')).toEqual(false);
        expect(isSurfaceMesh(undefined)).toEqual(false);
    });
});

describe('opacity', () => {
    it('should combine opacity and material opacity', () => {
        const material = new MeshLambertMaterial();

        const mesh = new SurfaceMesh({ geometry: DEFAULT_GEOMETRY, material, opacity: 0.7 });

        mesh.opacity = 0.33;

        expect(material.opacity).toEqual(0.7 * 0.33);
    });
});
