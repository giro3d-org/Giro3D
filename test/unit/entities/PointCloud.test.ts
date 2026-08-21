/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Box3, MathUtils, Vector3 } from 'three';
import { describe, expect, it, vitest } from 'vitest';

import type View from '@giro3d/giro3d/renderer/View';
import type {
    PointCloudAttribute,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudSource,
} from '@giro3d/giro3d/sources/PointCloudSource';

import PointCloud from '@giro3d/giro3d/entities/PointCloud';

function mockSource(options?: {
    metadata?: PointCloudMetadata;
    root?: PointCloudNode;
}): PointCloudSource {
    const result = {
        id: MathUtils.generateUUID(),
        dispose: vitest.fn(),
        addEventListener: vitest.fn(),
        removeEventListener: vitest.fn(),
        initialize: vitest.fn(),
        getMetadata: () => Promise.resolve(options?.metadata ?? {}),
        getHierarchy: () => Promise.resolve(options?.root ?? {}),
    };

    // @ts-expect-error incomplete
    return result;
}

describe('constructor', () => {
    it('should clone the default colormap', async () => {
        const source = mockSource({
            metadata: {
                attributes: [
                    // @ts-expect-error incomplete
                    {
                        name: 'myattribute',
                        interpretation: 'color',
                    },
                ],
            },
        });
        const entity1 = new PointCloud({ source, cleanupDelay: 1234 });
        const entity2 = new PointCloud({ source, cleanupDelay: 1234 });

        expect(entity1.elevationColorMap).not.toBe(entity2.elevationColorMap);

        // @ts-expect-error incomplete
        const instance: Instance = { notifyChange: vitest.fn() };

        await Promise.all([entity1.initialize({ instance }), entity2.initialize({ instance })]);
        expect(entity1.getAttributeColorMap('myattribute')).not.toBe(
            entity2.getAttributeColorMap('myattribute'),
        );
    });

    it('should set properties', () => {
        const source = mockSource();
        const entity = new PointCloud({ source, cleanupDelay: 1234 });

        expect(entity.source).toBe(source);
        expect(entity.cleanupDelay).toBe(1234);

        expect(entity.brightness).toBe(0);
        expect(entity.contrast).toBe(1);
        expect(entity.saturation).toBe(1);
    });
});

describe('dispose', () => {
    it('should dispose the source', () => {
        const source = mockSource();

        const entity = new PointCloud({ source });

        expect(source.dispose).not.toHaveBeenCalled();

        entity.dispose();

        expect(source.dispose).toHaveBeenCalled();
    });
});

describe('initialize', () => {
    it('should initialize the source', async () => {
        const attributes: PointCloudAttribute[] = [
            { name: 'foo', dimension: 1, type: 'signed', size: 2, interpretation: 'unknown' },
            { name: 'bar', dimension: 1, type: 'signed', size: 2, interpretation: 'unknown' },
            { name: 'baz', dimension: 1, type: 'signed', size: 2, interpretation: 'unknown' },
        ];

        const metadata: PointCloudMetadata = {
            pointCount: 12345,
            volume: new Box3().setFromArray([0, 0, 0, 1, 1, 1]),
            attributes,
        };

        // @ts-expect-error incomplete
        const root: PointCloudNode = {};

        const source = mockSource({ metadata, root });

        const entity = new PointCloud({ source });

        // @ts-expect-error incomplete
        const instance: Instance = { notifyChange: vitest.fn() };

        expect(source.initialize).not.toHaveBeenCalled();

        await entity.initialize({ instance });

        expect(source.initialize).toHaveBeenCalled();

        expect(entity.getBoundingBox()).toEqual(metadata.volume);
        expect(entity.pointCount).toEqual(12345);
        expect(entity.getSupportedAttributes()).toEqual(attributes);
    });

    it('should take into account the world space', async () => {
        const metadata: PointCloudMetadata = {
            pointCount: 12345,
            volume: new Box3().setFromArray([0, 0, 0, 1, 1, 1]),
            attributes: [
                { name: 'foo', dimension: 1, type: 'signed', size: 2, interpretation: 'unknown' },
            ],
        };
        const volume3dSpace = new Box3().setFromArray([12, 34, 56, 13, 35, 57]);

        // @ts-expect-error incomplete
        const root: PointCloudNode = {};

        const source = mockSource({ metadata, root });

        const entity = new PointCloud({ source });
        entity.object3d.position.set(12, 34, 56);
        entity.object3d.updateMatrixWorld(true);

        // @ts-expect-error incomplete
        const instance: Instance = { notifyChange: vitest.fn() };

        expect(source.initialize).not.toHaveBeenCalled();

        await entity.initialize({ instance });

        expect(source.initialize).toHaveBeenCalled();

        expect(entity.getBoundingBox()).toEqual(volume3dSpace);
    });
});

describe('testNodeSSE', () => {
    it('should work if pointcloud is at 0,0,0', async () => {
        const metadata: PointCloudMetadata = {
            pointCount: 12345,
            volume: new Box3().setFromArray([0, 0, 0, 1, 1, 1]),
            attributes: [
                {
                    name: 'foo',
                    dimension: 1,
                    type: 'signed',
                    size: 2,
                    interpretation: 'unknown',
                },
            ],
        };

        // @ts-expect-error incomplete
        const root: PointCloudNode = {
            center: new Vector3(0.5, 0.5, 0.5),
            depth: 0,
            volume: new Box3().setFromArray([0, 0, 0, 1, 1, 1]),
            geometricError: 1,
        };
        // @ts-expect-error incomplete
        const child: PointCloudNode = {
            center: new Vector3(0.25, 0.25, 0.25),
            depth: 1,
            volume: new Box3().setFromArray([0, 0, 0, 0.5, 0.5, 0.5]),
            geometricError: 1,
        };
        const view: View = {
            // @ts-expect-error mock
            camera: {
                position: new Vector3(10, 10, 10),
            },
        };
        const view2: View = {
            // @ts-expect-error mock
            camera: {
                position: new Vector3(0.5, 0.5, 0.5),
            },
        };

        const source = mockSource({ metadata, root });

        const entity = new PointCloud({ source });

        // @ts-expect-error incomplete
        const instance: Instance = { notifyChange: vitest.fn() };

        await entity.initialize({ instance });

        // @ts-expect-error private method
        expect(entity.testNodeSSE(view, root, 1)).toBe(true);
        // @ts-expect-error private method
        expect(entity.testNodeSSE(view, child, 1)).toBe(false);

        // @ts-expect-error private method
        expect(entity.testNodeSSE(view2, child, 1)).toBe(true);
    });

    it('should work if pointcloud has position', async () => {
        const metadata: PointCloudMetadata = {
            pointCount: 12345,
            volume: new Box3().setFromArray([0, 0, 0, 1, 1, 1]),
            attributes: [
                {
                    name: 'foo',
                    dimension: 1,
                    type: 'signed',
                    size: 2,
                    interpretation: 'unknown',
                },
            ],
        };
        const offset = new Vector3(12, 34, 56);

        // @ts-expect-error incomplete
        const root: PointCloudNode = {
            center: new Vector3(0.5, 0.5, 0.5),
            depth: 0,
            volume: new Box3().setFromArray([0, 0, 0, 1, 1, 1]),
            geometricError: 1,
        };
        // @ts-expect-error incomplete
        const child: PointCloudNode = {
            center: new Vector3(0.25, 0.25, 0.25),
            depth: 1,
            volume: new Box3().setFromArray([0, 0, 0, 0.5, 0.5, 0.5]),
            geometricError: 1,
        };
        const view: View = {
            // @ts-expect-error mock
            camera: {
                position: new Vector3(offset.x + 10, offset.y + 10, offset.z + 10),
            },
        };
        const view2: View = {
            // @ts-expect-error mock
            camera: {
                position: new Vector3(offset.x + 0.5, offset.y + 0.5, offset.z + 0.5),
            },
        };

        const source = mockSource({ metadata, root });

        const entity = new PointCloud({ source });
        entity.object3d.position.copy(offset);
        entity.object3d.updateMatrixWorld(true);

        // @ts-expect-error incomplete
        const instance: Instance = { notifyChange: vitest.fn() };

        await entity.initialize({ instance });

        // @ts-expect-error private method
        expect(entity.testNodeSSE(view, root, 1)).toBe(true);
        // @ts-expect-error private method
        expect(entity.testNodeSSE(view, child, 1)).toBe(false);

        // @ts-expect-error private method
        expect(entity.testNodeSSE(view2, child, 1)).toBe(true);
    });
});
