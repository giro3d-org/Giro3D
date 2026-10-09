/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { BufferGeometry, Material, Vector2 } from 'three';

import { Group, Mesh, WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { describe, expect, it, vitest } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Instance from '@giro3d/giro3d/core/Instance';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D';
import Fetcher from '@giro3d/giro3d/utils/Fetcher';

import { setupGlobalMocks } from '../mocks';

describe('initialize', () => {
    it('adds the entity to the scene when the root tileset loads', async ({ onTestFinished }) => {
        setupGlobalMocks();
        const renderer = new WebGLRenderer();
        const instance = new Instance({
            target: document.createElement('div'),
            crs: CoordinateSystem.epsg3857,
            renderer,
        });
        instance.renderer.getSize = vitest.fn((target: Vector2) => target.set(10, 10));
        const entity = new Tiles3D({ url: 'https://example.com/tileset.json' });

        const detectSupport = vitest.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis();
        onTestFinished(() => detectSupport.mockRestore());
        const fetch = vitest.spyOn(Fetcher, 'fetch');
        onTestFinished(() => fetch.mockRestore());
        fetch.mockResolvedValue(
            new Response(
                JSON.stringify({
                    asset: { version: '1.0' },
                    geometricError: 0,
                    root: {
                        boundingVolume: { box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
                        geometricError: 0,
                        refine: 'REPLACE',
                    },
                }),
            ),
        );

        await expect(instance.add(entity)).resolves.toBe(entity);
        expect(entity.object3d.parent).toBe(instance.scene);

        instance.dispose();
    });
});

describe('onObjectCreated', () => {
    it('should set the opacity of the created object and its descendants to the current opacity value when they have no original opacity', () => {
        const entity = new Tiles3D({ url: 'foo' });

        const o = new Group();
        o.add(new Mesh());
        o.add(new Mesh());
        o.add(new Mesh());
        // @ts-expect-error protected
        entity.onObjectCreated(o);
        for (const obj of o.children) {
            const mesh = obj as Mesh<BufferGeometry, Material>;
            expect(mesh.material.opacity).toBe(1);
            expect(mesh.material.transparent).toBe(false);
        }

        entity.opacity = 0.7;
        // @ts-expect-error protected
        entity.onObjectCreated(o);
        for (const obj of o.children) {
            const mesh = obj as Mesh<BufferGeometry, Material>;
            expect(mesh.material.opacity).toBe(0.7);
            expect(mesh.material.transparent).toBe(true);
        }
    });

    it('should correctly set the opacity of the created object and its descendants when they come with their own opacity', () => {
        const entity = new Tiles3D({ url: 'foo' });

        const o = new Group();
        const o1 = new Mesh<BufferGeometry, Material>();
        o.add(o1);
        const o2 = new Mesh<BufferGeometry, Material>();
        o2.material.opacity = 0.1;
        o.add(o2);
        const o3 = new Mesh<BufferGeometry, Material>();
        o3.material.opacity = 0.9;
        o.add(o3);

        // @ts-expect-error protected
        entity.onObjectCreated(o);

        expect(o1.material.opacity).toBe(1);
        expect(o1.material.transparent).toBe(false);
        expect(o2.material.opacity).toBe(0.1);
        expect(o2.material.transparent).toBe(true);
        expect(o3.material.opacity).toBe(0.9);
        expect(o3.material.transparent).toBe(true);
    });

    it('should correctly set the opacity of the created object and its descendants when they come with their own opacity and there is an opacity setup at the entity level', () => {
        const entity = new Tiles3D({ url: 'foo' });

        const o = new Group();
        const o1 = new Mesh<BufferGeometry, Material>();
        o.add(o1);
        const o2 = new Mesh<BufferGeometry, Material>();
        o2.material.opacity = 0.1;
        o.add(o2);
        const o3 = new Mesh<BufferGeometry, Material>();
        o3.material.opacity = 0.9;
        o.add(o3);

        entity.opacity = 0.5;
        // @ts-expect-error protected
        entity.onObjectCreated(o);
        expect(o1.material.opacity).toBe(0.5);
        expect(o1.material.transparent).toBe(true);
        expect(o2.material.opacity).toBe(0.05);
        expect(o2.material.transparent).toBe(true);
        expect(o3.material.opacity).toBe(0.45);
        expect(o3.material.transparent).toBe(true);
    });
});
