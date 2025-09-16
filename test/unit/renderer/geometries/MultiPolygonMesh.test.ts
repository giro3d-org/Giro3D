/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MeshBasicMaterial } from 'three';
import { LineMaterial } from 'three/examples/jsm/Addons.js';
import { describe, expect, it, vitest } from 'vitest';

import type PolygonMesh from '@giro3d/giro3d/renderer/geometries/PolygonMesh';

import MultiPolygonMesh, {
    isMultiPolygonMesh,
} from '@giro3d/giro3d/renderer/geometries/MultiPolygonMesh';
import { isSimpleGeometryMesh } from '@giro3d/giro3d/renderer/geometries/SimpleGeometryMesh';

import { makePolygonMesh } from './PolygonMesh.test';

function makeDefaultObjects(options?: {
    surfaceMaterial?: MeshBasicMaterial;
    ringMaterial?: LineMaterial;
    opacity?: number;
}) {
    const surfaceMaterial = options?.surfaceMaterial ?? new MeshBasicMaterial();
    const ringMaterial = options?.ringMaterial ?? new LineMaterial();
    const a = makePolygonMesh({ surfaceMaterial, ringMaterial, opacity: options?.opacity });
    const b = makePolygonMesh({ surfaceMaterial, ringMaterial, opacity: options?.opacity });
    const c = makePolygonMesh({ surfaceMaterial, ringMaterial, opacity: options?.opacity });
    const polygons = [a, b, c];
    const mesh = new MultiPolygonMesh(polygons);

    return { mesh, surfaceMaterial, polygons };
}

describe('constructor', () => {
    it('should assign properties', () => {
        const { mesh, polygons } = makeDefaultObjects();

        expect(mesh.isMultiPolygonMesh).toEqual(true);
        expect(mesh.isSimpleGeometryMesh).toEqual(true);
        expect(mesh.type).toEqual('MultiPolygonMesh');
        expect(mesh.children).toEqual(polygons);
    });
});

describe('traversePolygons', () => {
    it('should visit every polygon once', () => {
        const { mesh, polygons } = makeDefaultObjects();

        const traversed: PolygonMesh[] = [];

        mesh.traversePolygons(obj => traversed.push(obj));

        expect(traversed).toHaveLength(3);
        expect(traversed).toEqual(polygons);
    });
});

describe('dispose', () => {
    it('should call dispose on underlying polygons', () => {
        const { mesh, polygons } = makeDefaultObjects();

        function mockDispose(obj: PolygonMesh) {
            obj.dispose = vitest.fn();
        }

        mockDispose(polygons[0]);
        mockDispose(polygons[1]);
        mockDispose(polygons[2]);

        mesh.dispose();

        expect(polygons[0].dispose).toHaveBeenCalledTimes(1);
        expect(polygons[1].dispose).toHaveBeenCalledTimes(1);
        expect(polygons[2].dispose).toHaveBeenCalledTimes(1);
    });

    it('should dispatch dispose event', () => {
        const { mesh } = makeDefaultObjects();

        let called = false;
        mesh.addEventListener('dispose', () => (called = true));

        mesh.dispose();

        expect(called).toEqual(true);
    });
});

describe('isMultiPolygonMesh', () => {
    it('should return true if obj is MultiPolygonMesh', () => {
        const { mesh } = makeDefaultObjects();
        expect(isMultiPolygonMesh(mesh)).toEqual(true);
        expect(isMultiPolygonMesh('foo')).toEqual(false);
        expect(isMultiPolygonMesh(undefined)).toEqual(false);
    });
});

describe('isSimpleGeometryMesh', () => {
    it('should return true if obj is PolygonMesh', () => {
        const { mesh } = makeDefaultObjects();
        expect(isSimpleGeometryMesh(mesh)).toEqual(true);
        expect(isSimpleGeometryMesh('foo')).toEqual(false);
        expect(isSimpleGeometryMesh(undefined)).toEqual(false);
    });
});

describe('opacity', () => {
    it('should combine opacity and material opacity', () => {
        const ringMaterial = new LineMaterial();

        const surfaceMaterial = new MeshBasicMaterial();

        const { mesh } = makeDefaultObjects({ surfaceMaterial, ringMaterial, opacity: 0.7 });

        mesh.opacity = 0.33;

        expect(ringMaterial.opacity).toEqual(0.7 * 0.33);
        expect(surfaceMaterial.opacity).toEqual(0.7 * 0.33);
    });
});
