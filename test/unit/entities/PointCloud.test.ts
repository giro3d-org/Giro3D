import type Instance from '@giro3d/giro3d/core/Instance';
import PointCloud from '@giro3d/giro3d/entities/PointCloud';
import type {
    PointCloudAttribute,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudSource,
} from '@giro3d/giro3d/sources/PointCloudSource';
import { Box3, MathUtils } from 'three';

function mockSource(options?: {
    metadata?: PointCloudMetadata;
    root?: PointCloudNode;
}): PointCloudSource {
    const result = {
        id: MathUtils.generateUUID(),
        dispose: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        initialize: jest.fn(),
        getMetadata: () => Promise.resolve(options?.metadata ?? {}),
        getHierarchy: () => Promise.resolve(options?.root ?? {}),
    };

    // @ts-expect-error incomplete
    return result;
}

describe('PointCloud', () => {
    describe('constructor', () => {
        it('should clone the default colormap', () => {
            const source = mockSource();
            const entity1 = new PointCloud({ source, cleanupDelay: 1234 });
            const entity2 = new PointCloud({ source, cleanupDelay: 1234 });

            expect(entity1.colorMap).not.toBe(entity2.colorMap);
        });

        it('should set properties', () => {
            const source = mockSource();
            const entity = new PointCloud({ source, cleanupDelay: 1234 });

            expect(entity.source).toBe(source);
            expect(entity.cleanupDelay).toBe(1234);
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
            const instance: Instance = { notifyChange: jest.fn() };

            expect(source.initialize).not.toHaveBeenCalled();

            await entity.initialize({ instance });

            expect(source.initialize).toHaveBeenCalled();

            expect(entity.getBoundingBox()).toEqual(metadata.volume);
            expect(entity.pointCount).toEqual(12345);
            expect(entity.getSupportedAttributes()).toEqual(attributes);
        });
    });
});
