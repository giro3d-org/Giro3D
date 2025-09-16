/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Getter } from 'copc';

import * as process from 'process';
import { IntType } from 'three';
import { beforeAll, beforeEach, describe, expect, it, vitest } from 'vitest';

import type { DimensionFilter } from '@giro3d/giro3d/sources/las/filter';
import type { PointCloudAttribute } from '@giro3d/giro3d/sources/PointCloudSource';

import COPCSource from '@giro3d/giro3d/sources/COPCSource';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config';

import { readDataFileSync } from '../../data/utils';

const get: (filename: string) => Getter = filename => {
    const buf = readDataFileSync(filename);

    return (begin, end) => {
        const slice = buf.buffer.slice(begin, end);

        return Promise.resolve(new Uint8Array(slice));
    };
};

beforeAll(() => {
    // We want to use the local wasm file to avoid performing HTTP request for every single test.
    const cwd = process.cwd();
    setLazPerfPath(`${cwd}/node_modules/laz-perf/lib/node/`);
});

let source: COPCSource;
const url = get('las/autzen.copc.laz');

beforeEach(() => {
    // FIXME We have to disable workers because I couldn't find a way to
    // make them work in Node.js / vitest, as Node.js does not support the Worker
    // API (it uses a different implementation that is not compatible).
    // Ideally we want to test with workers enabled.
    source = new COPCSource({ url, enableWorkers: false });
});

describe('getHierarchy', () => {
    it('should return correct octree', async () => {
        await source.initialize();

        const root = await source.getHierarchy();

        expect(root.id).toEqual('0-0-0-0');
        expect(root.depth).toEqual(0);
        expect(root.parent).toBeUndefined();
        expect(root.sourceId).toEqual(source.id);
        expect(root.hasData).toEqual(true);
        expect(root.children).toHaveLength(8);
    });
});

describe('filters', () => {
    describe('set', () => {
        it('should raise the updated event', () => {
            const listener = vitest.fn();
            source.addEventListener('updated', listener);

            expect(listener).not.toHaveBeenCalled();

            source.filters = [];

            expect(listener).toHaveBeenCalled();
        });
    });
});

describe('getNodeData', () => {
    it('should honor color attribute', async () => {
        await source.initialize();

        const root = await source.getHierarchy();

        const metadata = await source.getMetadata();

        const data = await source.getNodeData({
            node: root,
            position: true,
            attribute: metadata.attributes.find(att => att.name === 'Color'),
        });

        expect(data.pointCount).toEqual(19190);
        expect(data.position).toBeDefined();
        expect(data.attribute).toBeDefined();

        expect(data.position!.count).toEqual(data.pointCount);
        expect(data.position!.array).toBeInstanceOf(Float32Array);
        expect(data.position!.itemSize).toEqual(3);

        expect(data.attribute!.count).toEqual(data.pointCount);
        expect(data.attribute!.array).toBeInstanceOf(Uint8Array);
        expect(data.attribute!.itemSize).toEqual(3);
    });

    it('should honor classification attribute', async () => {
        await source.initialize();

        const root = await source.getHierarchy();

        const metadata = await source.getMetadata();

        const data = await source.getNodeData({
            node: root,
            position: true,
            attribute: metadata.attributes.find(att => att.name === 'Classification'),
        });

        expect(data.pointCount).toEqual(19190);
        expect(data.position).toBeDefined();
        expect(data.attribute).toBeDefined();

        expect(data.position!.count).toEqual(data.pointCount);
        expect(data.position!.array).toBeInstanceOf(Float32Array);
        expect(data.position!.itemSize).toEqual(3);

        expect(data.attribute!.count).toEqual(data.pointCount);
        expect(data.attribute!.array).toBeInstanceOf(Uint8Array);
        expect(data.attribute!.itemSize).toEqual(1);
    });

    it('should honor scalar attribute', async () => {
        await source.initialize();

        const root = await source.getHierarchy();

        const metadata = await source.getMetadata();

        const data = await source.getNodeData({
            node: root,
            position: true,
            attribute: metadata.attributes.find(att => att.name === 'Intensity'),
        });

        expect(data.pointCount).toEqual(19190);
        expect(data.position).toBeDefined();
        expect(data.attribute).toBeDefined();

        expect(data.position!.count).toEqual(data.pointCount);
        expect(data.position!.array).toBeInstanceOf(Float32Array);
        expect(data.position!.itemSize).toEqual(3);

        expect(data.attribute!.count).toEqual(data.pointCount);
        expect(data.attribute!.array).toBeInstanceOf(Uint16Array);
        expect(data.attribute!.itemSize).toEqual(1);
        expect(data.attribute!.gpuType).toEqual(IntType);
    });

    it('should honor decimation parameter', async () => {
        const decimate = 10;

        source = new COPCSource({ url, enableWorkers: false, decimate });

        await source.initialize();

        const root = await source.getHierarchy();

        const metadata = await source.getMetadata();

        const data = await source.getNodeData({
            node: root,
            position: true,
            attribute: metadata.attributes.find(att => att.name === 'Intensity'),
        });

        expect(data.pointCount).toEqual(19190 / decimate);
        expect(data.position!.count).toEqual(19190 / decimate);
        expect(data.attribute!.count).toEqual(19190 / decimate);
    });

    it('should not load position buffers if position option is false', async () => {
        source = new COPCSource({ url, enableWorkers: false });

        await source.initialize();

        const root = await source.getHierarchy();

        const metadata = await source.getMetadata();

        const data = await source.getNodeData({
            node: root,
            position: false,
            attribute: metadata.attributes.find(att => att.name === 'Intensity'),
        });

        expect(data.pointCount).toEqual(19190);
        expect(data.position).toBeUndefined();
        expect(data.localBoundingBox).toBeUndefined();
        expect(data.attribute!.count).toEqual(19190);
    });

    it('should honor filters', async () => {
        const filteredClassification = 0;

        const filters: DimensionFilter[] = [
            {
                dimension: 'Classification',
                operator: 'equal',
                value: filteredClassification,
            },
        ];

        source = new COPCSource({ url, enableWorkers: false, filters });

        expect(source.filters).toEqual(filters);

        await source.initialize();

        const root = await source.getHierarchy();

        const metadata = await source.getMetadata();

        const data = await source.getNodeData({
            node: root,
            position: true,
            attribute: metadata.attributes.find(att => att.name === 'Classification'),
        });

        expect(data.pointCount).toEqual(698);
        expect(data.position!.count).toEqual(698);
        expect(data.attribute!.count).toEqual(698);

        for (let i = 0; i < data.attribute!.array.length; i++) {
            const value = data.attribute!.array[i];
            expect(value).toEqual(filteredClassification);
        }
    });

    it('should honor filters even if filtered dimension is not the requested attribute', async () => {
        const filters: DimensionFilter[] = [
            { dimension: 'Classification', operator: 'equal', value: 0 },
        ];

        source = new COPCSource({ url, enableWorkers: false });

        source.filters = filters;

        await source.initialize();

        const root = await source.getHierarchy();

        const data = await source.getNodeData({ node: root, position: true });

        expect(data.pointCount).toEqual(698);
    });
});

describe('getMetadata', () => {
    it('should return correct metadata', async () => {
        expect(source.loading).toEqual(false);
        expect(source.progress).toEqual(1);

        await source.initialize();

        const metadata = await source.getMetadata();

        expect(metadata.pointCount).toEqual(53267);

        const volume = metadata.volume!;

        expect(volume.min.x).toBeCloseTo(635584.57, 4);
        expect(volume.min.y).toBeCloseTo(848887.07, 4);
        expect(volume.min.z).toBeCloseTo(406.43, 4);

        expect(volume.max.x).toBeCloseTo(638999.8, 4);
        expect(volume.max.y).toBeCloseTo(853533.33, 4);
        expect(volume.max.z).toBeCloseTo(591.66, 4);

        const attributes = metadata.attributes;

        expect(attributes).toHaveLength(20);

        const map = new Map();

        for (const attr of attributes) {
            map.set(attr.name, attr);
        }

        function check(
            attr: PointCloudAttribute,
            name: string,
            type: PointCloudAttribute['type'],
            size: PointCloudAttribute['size'],
            dim: PointCloudAttribute['dimension'],
            usage: PointCloudAttribute['interpretation'],
        ) {
            if (attr == null) {
                throw new Error('missing attribute: ' + name);
            }
            expect(attr.name).toEqual(name);
            expect(attr.type).toEqual(type);
            expect(attr.size).toEqual(size);
            expect(attr.dimension).toEqual(dim);
            expect(attr.interpretation).toEqual(usage);
        }

        check(map.get('Z'), 'Z', 'float', 4, 1, 'unknown');
        check(map.get('Intensity'), 'Intensity', 'unsigned', 2, 1, 'unknown');
        check(map.get('ReturnNumber'), 'ReturnNumber', 'unsigned', 1, 1, 'unknown');
        check(map.get('NumberOfReturns'), 'NumberOfReturns', 'unsigned', 1, 1, 'unknown');
        check(map.get('ScanDirectionFlag'), 'ScanDirectionFlag', 'unsigned', 1, 1, 'unknown');
        check(map.get('EdgeOfFlightLine'), 'EdgeOfFlightLine', 'unsigned', 1, 1, 'unknown');
        check(map.get('Classification'), 'Classification', 'unsigned', 1, 1, 'classification');
        check(map.get('ScanAngle'), 'ScanAngle', 'float', 4, 1, 'unknown');
        check(map.get('UserData'), 'UserData', 'unsigned', 1, 1, 'unknown');
        check(map.get('Color'), 'Color', 'unsigned', 1, 3, 'color');
        check(map.get('Red'), 'Red', 'unsigned', 2, 1, 'unknown');
        check(map.get('Green'), 'Green', 'unsigned', 2, 1, 'unknown');
        check(map.get('Blue'), 'Blue', 'unsigned', 2, 1, 'unknown');
        check(map.get('GpsTime'), 'GpsTime', 'float', 4, 1, 'unknown');
        check(map.get('ScannerChannel'), 'ScannerChannel', 'unsigned', 1, 1, 'unknown');
        check(map.get('Synthetic'), 'Synthetic', 'unsigned', 1, 1, 'unknown');
        check(map.get('KeyPoint'), 'KeyPoint', 'unsigned', 1, 1, 'unknown');
        check(map.get('Withheld'), 'Withheld', 'unsigned', 1, 1, 'unknown');
        check(map.get('Overlap'), 'Overlap', 'unsigned', 1, 1, 'unknown');
    });
});
