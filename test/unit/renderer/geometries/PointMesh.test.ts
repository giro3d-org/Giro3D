/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { SpriteMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import PointMesh, { isPointMesh } from '@giro3d/giro3d/renderer/geometries/PointMesh';
import { isSimpleGeometryMesh } from '@giro3d/giro3d/renderer/geometries/SimpleGeometryMesh';

describe('constructor', () => {
    it('should assign properties', () => {
        const material = new SpriteMaterial();
        const mesh = new PointMesh({ material });
        expect(mesh.material).toBe(material);
        expect(mesh.geometry).toBeDefined();
        expect(mesh.userData).toBeDefined();
        expect(mesh.isSimpleGeometryMesh).toEqual(true);
        expect(mesh.isPointMesh).toEqual(true);
        expect(mesh.type).toEqual('PointMesh');
    });
});

describe('update', () => {
    it('should update material and visibility', () => {
        const oldMaterial = new SpriteMaterial();
        const mesh = new PointMesh({ material: oldMaterial });

        mesh.update({ material: null, opacity: 1, pointSize: 10 });

        expect(mesh.material).toBe(oldMaterial);
        expect(mesh.visible).toEqual(false);

        const newMaterial = new SpriteMaterial();
        mesh.update({ material: newMaterial, opacity: 1, pointSize: 10 });

        expect(mesh.material).toBe(newMaterial);
        expect(mesh.visible).toBe(true);
    });
});

describe('dispose', () => {
    it('should dispose the geometry but NOT the material', () => {
        const material = new SpriteMaterial();
        let materialDisposed = false;
        let geometryDisposed = false;
        const mesh = new PointMesh({ material });
        mesh.geometry.addEventListener('dispose', () => (geometryDisposed = true));
        mesh.material.addEventListener('dispose', () => (materialDisposed = true));
        mesh.dispose();

        expect(materialDisposed).toEqual(false);
        expect(geometryDisposed).toEqual(true);
    });

    it('should dispatch dispose event', () => {
        const mesh = new PointMesh({ material: new SpriteMaterial() });

        let called = false;
        mesh.addEventListener('dispose', () => (called = true));

        mesh.dispose();

        expect(called).toEqual(true);
    });
});

describe('isPointMesh', () => {
    it('should return true if obj is PointMesh', () => {
        const mesh = new PointMesh({ material: new SpriteMaterial() });
        expect(isPointMesh(mesh)).toEqual(true);
        expect(isPointMesh('foo')).toEqual(false);
        expect(isPointMesh(undefined)).toEqual(false);
    });
});

describe('isSimpleGeometryMesh', () => {
    it('should return true if obj is PointMesh', () => {
        const mesh = new PointMesh({ material: new SpriteMaterial() });
        expect(isSimpleGeometryMesh(mesh)).toEqual(true);
        expect(isSimpleGeometryMesh('foo')).toEqual(false);
        expect(isSimpleGeometryMesh(undefined)).toEqual(false);
    });
});

describe('opacity', () => {
    it('should combine opacity and material opacity', () => {
        const material = new SpriteMaterial();

        const mesh = new PointMesh({ material, opacity: 0.7 });

        mesh.opacity = 0.33;

        expect(material.opacity).toEqual(0.7 * 0.33);
    });
});
