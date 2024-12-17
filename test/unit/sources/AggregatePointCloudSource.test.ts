import type { GetMemoryUsageContext } from '@giro3d/giro3d/core/MemoryUsage';
import AggregatePointCloudSource from '@giro3d/giro3d/sources/AggregatePointCloudSource';
import {
    traverseNode,
    type PointCloudAttribute,
    type PointCloudMetadata,
    type PointCloudNode,
    type PointCloudSource,
} from '@giro3d/giro3d/sources/PointCloudSource';
import { Box3, EventDispatcher, MathUtils } from 'three';

type AsyncFn<T> = () => Promise<T>;

function mock(params?: {
    id?: string;
    getMetadata?: AsyncFn<PointCloudMetadata>;
    getHierarchy?: AsyncFn<PointCloudNode>;
}): PointCloudSource {
    // @ts-expect-error incomplete type
    const result: PointCloudSource = {
        id: params?.id ?? MathUtils.generateUUID(),
        addEventListener: jest.fn(),
        initialize: jest.fn(),
        getMetadata: params?.getMetadata ?? jest.fn(),
        dispose: jest.fn(),
        getHierarchy: params?.getHierarchy ?? jest.fn(),
        getNodeData: jest.fn(),
        progress: 1,
        loading: false,
        getMemoryUsage: jest.fn(),
    };

    result.initialize = () => Promise.resolve(result);

    return result;
}

describe('constructor', () => {
    it('should throw if sources is empty / null', () => {
        // @ts-expect-error null
        const sources: PointCloudSource[] = null;

        expect(() => new AggregatePointCloudSource({ sources })).toThrow(/sources is required/);
        expect(() => new AggregatePointCloudSource({ sources: [] })).toThrow(/sources is required/);
    });

    it('should set the sources property', () => {
        // @ts-expect-error type not satisfied
        const source1: PointCloudSource = {
            id: 'source1',
            addEventListener: jest.fn(),
        };

        // @ts-expect-error type not satisfied
        const source2: PointCloudSource = {
            id: 'source2',
            addEventListener: jest.fn(),
        };

        const sources: PointCloudSource[] = [source1, source2];

        const source = new AggregatePointCloudSource({ sources });

        expect(source.sources).toEqual([source1, source2]);
    });

    it('should transmit progress event', () => {
        // @ts-expect-error type not satisfied
        const source1: PointCloudSource = new EventDispatcher();
        // @ts-expect-error readonly
        source1.id = 'source1';

        const sources: PointCloudSource[] = [source1];

        const source = new AggregatePointCloudSource({ sources });

        const listener = jest.fn();

        source.addEventListener('progress', listener);

        source.dispatchEvent({ type: 'progress' });

        expect(listener).toHaveBeenCalled();
    });
});

describe('dispose', () => {
    it('should call dispose() on sub-sources', () => {
        const s1 = mock();
        const s2 = mock();

        const source = new AggregatePointCloudSource({ sources: [s1, s2] });

        source.dispose();

        expect(s1.dispose).toHaveBeenCalled();
        expect(s2.dispose).toHaveBeenCalled();
    });
});

describe('getMemoryUsage', () => {
    it('should call getMemoryUsage() on sub-sources', () => {
        const s1 = mock();
        const s2 = mock();

        const source = new AggregatePointCloudSource({ sources: [s1, s2] });

        // @ts-expect-error incomplete definition
        const ctx: GetMemoryUsageContext = {};

        source.getMemoryUsage(ctx);

        expect(s1.getMemoryUsage).toHaveBeenCalledWith(ctx);
        expect(s2.getMemoryUsage).toHaveBeenCalledWith(ctx);
    });
});

describe('loading', () => {
    it('aggregate loading property', () => {
        const s1 = mock();
        const s2 = mock();

        const source = new AggregatePointCloudSource({ sources: [s1, s2] });

        expect(source.loading).toEqual(false);

        // @ts-expect-error readonly
        s1.loading = true;

        expect(source.loading).toEqual(true);
    });
});

describe('progress', () => {
    it('should compute the aggregate value ignoring idle sources', () => {
        const s1 = mock();
        const s2 = mock();
        const s3 = mock();
        const s4 = mock();

        const source = new AggregatePointCloudSource({ sources: [s1, s2, s3, s4] });

        // @ts-expect-error readonly
        s1.progress = 1;
        // @ts-expect-error readonly
        s2.progress = 0.01;
        // @ts-expect-error readonly
        s3.progress = 0.2;
        // @ts-expect-error readonly
        s4.progress = 0.56;

        const expected = (0.01 + 0.2 + 0.56) / 3;

        expect(source.progress).toEqual(expected);
    });
});

describe('initialize', () => {
    it('should initialize sub-sources idempotently', async () => {
        const s1 = mock();
        const s2 = mock();

        const source = new AggregatePointCloudSource({ sources: [s1, s2] });

        s1.initialize = jest.fn();
        s2.initialize = jest.fn();

        await source.initialize();
        await source.initialize();
        await source.initialize();

        expect(s1.initialize).toHaveBeenCalledTimes(1);
        expect(s2.initialize).toHaveBeenCalledTimes(1);
    });
});

describe('getHierarchy & getNodeData', () => {
    it('dispatch the getNodeData() call to the correct sub-source', async () => {
        const s1 = mock();
        const s2 = mock();

        // @ts-expect-error incomplete definition
        const node1: PointCloudNode = {
            sourceId: s1.id,
            volume: new Box3().setFromArray([-1, -1, -1, 0, 0, 0]),
        };
        s1.getHierarchy = () => Promise.resolve(node1);

        // @ts-expect-error incomplete definition
        const node2: PointCloudNode = {
            sourceId: s2.id,
            volume: new Box3().setFromArray([0, 0, 0, 1, 1, 1]),
        };
        s2.getHierarchy = () => Promise.resolve(node2);

        const source = new AggregatePointCloudSource({ sources: [s1, s2] });

        await source.initialize();

        const hierarchy = await source.getHierarchy();

        expect(hierarchy.children).toEqual([node1, node2]);
        expect(hierarchy.depth).toEqual(-1);
        expect(hierarchy.volume).toEqual(new Box3().setFromArray([-1, -1, -1, 1, 1, 1]));
        expect(hierarchy.hasData).toEqual(false);
        expect(hierarchy.sourceId).toEqual(source.id);

        traverseNode(hierarchy, () => true);

        source.getNodeData({ node: node1 });

        expect(s1.getNodeData).toHaveBeenCalledTimes(1);
        expect(s2.getNodeData).toHaveBeenCalledTimes(0);

        source.getNodeData({ node: node2 });

        expect(s1.getNodeData).toHaveBeenCalledTimes(1);
        expect(s2.getNodeData).toHaveBeenCalledTimes(1);
    });
});

describe('getMetadata', () => {
    it('should sum pointCounts', async () => {
        const metadata1: PointCloudMetadata = {
            pointCount: 101,
            attributes: [],
            // attributes: [{ name: 'foo', type: 'f32', dimension: 1, usage: 'unknown' }],
        };

        const metadata2: PointCloudMetadata = {
            pointCount: 400,
            attributes: [],
            // attributes: [{ name: 'foo', type: 'f32', dimension: 1, usage: 'unknown' }],
        };

        const s1 = mock({ getMetadata: () => Promise.resolve(metadata1) });
        const s2 = mock({ getMetadata: () => Promise.resolve(metadata2) });

        const source = new AggregatePointCloudSource({ sources: [s1, s2] });

        await source.initialize();

        const metadata = await source.getMetadata();

        expect(metadata.pointCount).toEqual(501);
    });

    it('should union volumes', async () => {
        const metadata1: PointCloudMetadata = {
            attributes: [],
            volume: new Box3().setFromArray([0, 0, 0, 1, 1, 1]),
        };

        const metadata2: PointCloudMetadata = {
            attributes: [],
            volume: new Box3().setFromArray([-1, -1, -1, 0, 0, 0]),
        };

        const s1 = mock({ getMetadata: () => Promise.resolve(metadata1) });
        const s2 = mock({ getMetadata: () => Promise.resolve(metadata2) });

        const source = new AggregatePointCloudSource({ sources: [s1, s2] });

        await source.initialize();

        const metadata = await source.getMetadata();

        expect(metadata.volume).toEqual(new Box3().setFromArray([-1, -1, -1, 1, 1, 1]));
    });

    it('should get the intersection of attributes and aggregate their min/max', async () => {
        const common1: PointCloudAttribute = {
            name: 'common1',
            type: 'float',
            size: 4,
            dimension: 1,
            interpretation: 'unknown',
        };

        const common2: PointCloudAttribute = {
            name: 'common2',
            type: 'float',
            size: 4,
            dimension: 3,
            interpretation: 'unknown',
        };

        const common3: PointCloudAttribute = {
            name: 'common2',
            type: 'signed',
            size: 2,
            dimension: 1,
            interpretation: 'unknown',
        };

        const metadata1: PointCloudMetadata = {
            attributes: [
                {
                    name: 'specific1',
                    type: 'float',
                    size: 4,
                    dimension: 1,
                    interpretation: 'unknown',
                },
                { ...common1, min: -123, max: -100 },
                common2,
                common3,
            ],
        };

        const metadata2: PointCloudMetadata = {
            attributes: [
                {
                    name: 'specific2',
                    type: 'float',
                    dimension: 1,
                    size: 4,
                    interpretation: 'unknown',
                },
                { ...common1, min: 0, max: 989 },
                common2,
                common3,
            ],
        };

        const s1 = mock({ getMetadata: () => Promise.resolve(metadata1) });
        const s2 = mock({ getMetadata: () => Promise.resolve(metadata2) });

        const source = new AggregatePointCloudSource({ sources: [s1, s2] });

        await source.initialize();

        const metadata = await source.getMetadata();

        expect(metadata.attributes).toHaveLength(3);

        const c1 = metadata.attributes.find(x => x.name === 'common1')!;

        expect(c1.dimension).toEqual(1);
        expect(c1.type).toEqual('float');

        expect(c1.min).toEqual(-123);
        expect(c1.max).toEqual(989);
    });
});
