/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { LineGeometry, LineMaterial } from 'three/examples/jsm/Addons.js';
import { describe, expect, it } from 'vitest';

import LineStringMesh from '@giro3d/giro3d/renderer/geometries/LineStringMesh';
import MultiLineStringMesh, {
    isMultiLineStringMesh,
} from '@giro3d/giro3d/renderer/geometries/MultiLineStringMesh';
import { isSimpleGeometryMesh } from '@giro3d/giro3d/renderer/geometries/SimpleGeometryMesh';

function makeDefaultObjects() {
    const material = new LineMaterial();
    const geometry = new LineGeometry();
    const a = new LineStringMesh(geometry, material, 1);
    const b = new LineStringMesh(geometry, material, 1);
    const c = new LineStringMesh(geometry, material, 1);
    const lineStrings = [a, b, c];
    const mesh = new MultiLineStringMesh(lineStrings);

    return { mesh, geometry, material, lineStrings };
}

describe('constructor', () => {
    it('should assign properties', () => {
        const { mesh, lineStrings } = makeDefaultObjects();

        expect(mesh.isMultiLineStringMesh).toEqual(true);
        expect(mesh.isSimpleGeometryMesh).toEqual(true);
        expect(mesh.type).toEqual('MultiLineStringMesh');
        expect(mesh.children).toEqual(lineStrings);
    });
});

describe('traverseLineStrings', () => {
    it('should visit every LineStringMesh once', () => {
        const { mesh, lineStrings } = makeDefaultObjects();

        const traversed: LineStringMesh[] = [];

        mesh.traverseLineStrings(ls => traversed.push(ls));

        expect(traversed).toHaveLength(3);
        expect(traversed).toEqual(lineStrings);
    });
});

describe('dispose', () => {
    it('should call dispose on underlying LineStringMeshes', () => {
        const { mesh, material, geometry, lineStrings } = makeDefaultObjects();

        let materialDisposed = false;
        let geometryDisposed = false;

        material.addEventListener('dispose', () => (materialDisposed = true));
        geometry.addEventListener('dispose', () => (geometryDisposed = true));

        let ls0Disposed = false;
        let ls1Disposed = false;
        let ls2Disposed = false;
        lineStrings[0].addEventListener('dispose', () => (ls0Disposed = true));
        lineStrings[1].addEventListener('dispose', () => (ls1Disposed = true));
        lineStrings[2].addEventListener('dispose', () => (ls2Disposed = true));

        mesh.dispose();

        expect(materialDisposed).toEqual(false);
        expect(geometryDisposed).toEqual(true);
        expect(ls0Disposed).toEqual(true);
        expect(ls1Disposed).toEqual(true);
        expect(ls2Disposed).toEqual(true);
    });

    it('should dispatch dispose event', () => {
        const material = new LineMaterial();
        const geometry = new LineGeometry();
        const a = new LineStringMesh(geometry, material, 1);
        const b = new LineStringMesh(geometry, material, 1);
        const c = new LineStringMesh(geometry, material, 1);
        const lineStrings = [a, b, c];
        const mesh = new MultiLineStringMesh(lineStrings);

        let called = false;
        mesh.addEventListener('dispose', () => (called = true));

        mesh.dispose();

        expect(called).toEqual(true);
    });
});

describe('isMultiLineStringMesh', () => {
    it('should return true if obj is MultiLineStringMesh', () => {
        const { mesh } = makeDefaultObjects();
        expect(isMultiLineStringMesh(mesh)).toEqual(true);
        expect(isMultiLineStringMesh('foo')).toEqual(false);
        expect(isMultiLineStringMesh(undefined)).toEqual(false);
    });
});

describe('isSimpleGeometryMesh', () => {
    it('should return true if obj is MultiLineStringMesh', () => {
        const { mesh } = makeDefaultObjects();
        expect(isSimpleGeometryMesh(mesh)).toEqual(true);
        expect(isSimpleGeometryMesh('foo')).toEqual(false);
        expect(isSimpleGeometryMesh(undefined)).toEqual(false);
    });
});

describe('opacity', () => {
    it('should combine opacity and material opacity', () => {
        const materialA = new LineMaterial();

        const materialB = new LineMaterial();

        const materialC = new LineMaterial();

        const geometry = new LineGeometry();
        const a = new LineStringMesh(geometry, materialA, 0.7);
        const b = new LineStringMesh(geometry, materialB, 0.3);
        const c = new LineStringMesh(geometry, materialC, 0.9);
        const lineStrings = [a, b, c];
        const mesh = new MultiLineStringMesh(lineStrings);

        mesh.opacity = 0.33;

        expect(materialA.opacity).toEqual(0.7 * 0.33);
        expect(materialB.opacity).toEqual(0.3 * 0.33);
        expect(materialC.opacity).toEqual(0.9 * 0.33);
    });
});
