/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2, type WebGLRenderer } from 'three';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { describe, expect, it, vitest } from 'vitest';

import LineStringMesh, {
    isLineStringMesh,
} from '@giro3d/giro3d/renderer/geometries/LineStringMesh';
import { isSimpleGeometryMesh } from '@giro3d/giro3d/renderer/geometries/SimpleGeometryMesh';

describe('constructor', () => {
    it('should assign properties', () => {
        const material = new LineMaterial();
        const geometry = new LineGeometry();
        const mesh = new LineStringMesh(geometry, material, 1);
        expect(mesh.material).toBe(material);
        expect(mesh.geometry).toBe(geometry);
        expect(mesh.userData).toBeDefined();
        expect(mesh.isSimpleGeometryMesh).toEqual(true);
        expect(mesh.isLineStringMesh).toEqual(true);
        expect(mesh.type).toEqual('LineStringMesh');
    });
});

describe('update', () => {
    it('should replace the material without disposing it', () => {
        const oldMaterial = new LineMaterial();
        const geometry = new LineGeometry();
        const mesh = new LineStringMesh(geometry, oldMaterial, 1);

        oldMaterial.dispose = vitest.fn();
        const newMaterial = new LineMaterial();

        mesh.update({ material: newMaterial, opacity: 1, renderOrder: 0 });

        expect(mesh.material).toBe(newMaterial);
        expect(oldMaterial.dispose).not.toHaveBeenCalled();
    });

    it('should update the visibility of the mesh according to the presence of the new material', () => {
        const oldMaterial = new LineMaterial();
        const geometry = new LineGeometry();
        const mesh = new LineStringMesh(geometry, oldMaterial, 1);

        mesh.visible = false;

        mesh.update({ material: new LineMaterial(), opacity: 1, renderOrder: 0 });
        expect(mesh.visible).toEqual(true);

        mesh.update({ material: null, opacity: 1, renderOrder: 0 });
        expect(mesh.visible).toEqual(false);
    });

    it('should update material opacity', () => {
        const oldMaterial = new LineMaterial();
        const geometry = new LineGeometry();
        const mesh = new LineStringMesh(geometry, oldMaterial, 1);

        oldMaterial.dispose = vitest.fn();
        mesh.opacity = 0.2;
        const newMaterial = new LineMaterial();

        mesh.update({ material: newMaterial, opacity: 0.5, renderOrder: 0 });

        expect(newMaterial.opacity).toEqual(0.2 * 0.5);
    });
});

describe('onBeforeRender', () => {
    it('should update the material resolution with the render target (if any) or canvas pixel size', () => {
        const material = new LineMaterial();
        const geometry = new LineGeometry();
        const mesh = new LineStringMesh(geometry, material, 1);

        const renderer = {
            getRenderTarget: () => ({
                width: 109,
                height: 224,
            }),
            getContext: () => ({
                canvas: {
                    width: 299,
                    height: 878,
                },
            }),
        } as WebGLRenderer;

        mesh.onBeforeRender(renderer);
        expect(mesh.material.resolution).toEqual(new Vector2(109, 224));

        renderer.getRenderTarget = () => null;

        mesh.onBeforeRender(renderer);
        expect(mesh.material.resolution).toEqual(new Vector2(299, 878));
    });
});

describe('dispose', () => {
    it('should dispose the geometry but NOT the material', () => {
        const material = new LineMaterial();
        const geometry = new LineGeometry();
        const mesh = new LineStringMesh(geometry, material, 1);
        let materialDisposed = false;
        let geometryDisposed = false;

        material.addEventListener('dispose', () => (materialDisposed = true));
        geometry.addEventListener('dispose', () => (geometryDisposed = true));
        mesh.dispose();

        expect(materialDisposed).toEqual(false);
        expect(geometryDisposed).toEqual(true);
    });
});

describe('isLineStringMesh', () => {
    it('should return true if obj is MultiLineStringMesh', () => {
        const mesh = new LineStringMesh(new LineGeometry(), new LineMaterial(), 1);
        expect(isLineStringMesh(mesh)).toEqual(true);
        expect(isLineStringMesh('foo')).toEqual(false);
        expect(isLineStringMesh(undefined)).toEqual(false);
    });
});

describe('isSimpleGeometryMesh', () => {
    it('should return true if obj is MultiLineStringMesh', () => {
        const mesh = new LineStringMesh(new LineGeometry(), new LineMaterial(), 1);
        expect(isSimpleGeometryMesh(mesh)).toEqual(true);
        expect(isSimpleGeometryMesh('foo')).toEqual(false);
        expect(isSimpleGeometryMesh(undefined)).toEqual(false);
    });
});

describe('opacity', () => {
    it('should combine opacity and material opacity', () => {
        const material = new LineMaterial({
            opacity: 0.7,
        });

        const geometry = new LineGeometry();
        const mesh = new LineStringMesh(geometry, material, 0.7);

        mesh.opacity = 0.33;

        expect(material.opacity).toEqual(0.7 * 0.33);
    });
});
