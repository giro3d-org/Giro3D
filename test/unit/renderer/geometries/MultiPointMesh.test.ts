/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { SpriteMaterial } from 'three';
import { describe, expect, it, vitest } from 'vitest';

import MultiPointMesh, {
    isMultiPointMesh,
} from '@giro3d/giro3d/renderer/geometries/MultiPointMesh';
import PointMesh from '@giro3d/giro3d/renderer/geometries/PointMesh';
import { isSimpleGeometryMesh } from '@giro3d/giro3d/renderer/geometries/SimpleGeometryMesh';

function makeDefaultObjects(options?: { material?: SpriteMaterial; opacity?: number }) {
    const material = options?.material ?? new SpriteMaterial();
    const a = new PointMesh({ material, opacity: options?.opacity ?? 1 });
    const b = new PointMesh({ material, opacity: options?.opacity ?? 1 });
    const c = new PointMesh({ material, opacity: options?.opacity ?? 1 });
    const points = [a, b, c];
    const mesh = new MultiPointMesh(points);

    return { mesh, material, points };
}

describe('constructor', () => {
    it('should assign properties', () => {
        const { mesh, points } = makeDefaultObjects();

        expect(mesh.isMultiPointMesh).toEqual(true);
        expect(mesh.isSimpleGeometryMesh).toEqual(true);
        expect(mesh.type).toEqual('MultiPointMesh');
        expect(mesh.children).toEqual(points);
    });
});

describe('traversePoints', () => {
    it('should visit every point once', () => {
        const { mesh, points } = makeDefaultObjects();

        const traversed: PointMesh[] = [];

        mesh.traversePoints(obj => traversed.push(obj));

        expect(traversed).toHaveLength(3);
        expect(traversed).toEqual(points);
    });
});

describe('dispose', () => {
    it('should call dispose on underlying points', () => {
        const { mesh, points } = makeDefaultObjects();

        function mockDispose(obj: PointMesh) {
            obj.dispose = vitest.fn();
        }

        mockDispose(points[0]);
        mockDispose(points[1]);
        mockDispose(points[2]);

        mesh.dispose();

        expect(points[0].dispose).toHaveBeenCalledTimes(1);
        expect(points[1].dispose).toHaveBeenCalledTimes(1);
        expect(points[2].dispose).toHaveBeenCalledTimes(1);
    });

    it('should dispatch dispose event', () => {
        const { mesh } = makeDefaultObjects();

        let called = false;
        mesh.addEventListener('dispose', () => (called = true));

        mesh.dispose();

        expect(called).toEqual(true);
    });
});

describe('isMultiPointMesh', () => {
    it('should return true if obj is MultiPolygonMesh', () => {
        const { mesh } = makeDefaultObjects();
        expect(isMultiPointMesh(mesh)).toEqual(true);
        expect(isMultiPointMesh('foo')).toEqual(false);
        expect(isMultiPointMesh(undefined)).toEqual(false);
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
        const material = new SpriteMaterial();

        const { mesh } = makeDefaultObjects({ material, opacity: 0.3 });

        mesh.opacity = 0.33;

        expect(material.opacity).toEqual(0.3 * 0.33);
    });
});
