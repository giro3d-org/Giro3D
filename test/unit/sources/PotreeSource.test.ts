/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import type { PointCloudAttribute } from '@giro3d/giro3d/sources/PointCloudSource';

import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config';
import { traverseNode } from '@giro3d/giro3d/sources/PointCloudSource';
import PotreeSource from '@giro3d/giro3d/sources/PotreeSource';
import Fetcher from '@giro3d/giro3d/utils/Fetcher';

import { getDataFileUrl, readDataFileSync } from '../../data/utils';

beforeAll(() => {
    Fetcher.json = url => {
        const result = readDataFileSync(url.toString());
        const json = JSON.parse(result.toString('utf-8'));
        return Promise.resolve(json);
    };
    Fetcher.arrayBuffer = url => {
        const result = readDataFileSync(url.toString());
        const arrayBuffer = result.buffer;
        return Promise.resolve(arrayBuffer);
    };

    // We want to use the local wasm file to avoid performing HTTP request for every single test.
    const cwd = process.cwd();
    setLazPerfPath(`${cwd}/node_modules/laz-perf/lib/node/`);
});

describe('constructor', () => {
    it('should assign basic properties', () => {
        const source = new PotreeSource({ url: 'foo' });

        expect(source.isPotreeSource).toEqual(true);
        expect(source.type).toEqual('PotreeSource');
    });

    it('should throw if URL is undefined', () => {
        // @ts-expect-error missing parameter
        expect(() => new PotreeSource()).toThrow();
        // @ts-expect-error missing parameter
        expect(() => new PotreeSource({ url: undefined })).toThrow();
    });
});

describe('getMetadata', () => {
    describe('BIN dataset', () => {
        it('should return the correct metadata', async () => {
            const url = getDataFileUrl('potree/bin/cloud.js');
            const source = new PotreeSource({ url });

            await source.initialize();

            const metadata = await source.getMetadata();

            expect(metadata.pointCount).toBeUndefined();
            expect(metadata.crs!.name).toBe('unknown');
            expect(metadata.crs!.srid).toBeUndefined();
            expect(metadata.volume).toBeDefined();

            const volume = metadata.volume!;

            const precision = 1;

            expect(volume.min.x).toBeCloseTo(-3158.35525, precision);
            expect(volume.min.y).toBeCloseTo(-3040.36129, precision);
            expect(volume.min.z).toBeCloseTo(-4535.583, precision);

            expect(volume.max.x).toBeCloseTo(2522.18675, precision);
            expect(volume.max.y).toBeCloseTo(2272.03471, precision);
            expect(volume.max.z).toBeCloseTo(1058.471, precision);

            const attributes = metadata.attributes;

            // The 'POSITION_CARTESIAN' attribute is not exposed to the API
            // because it would not be useable as an attribute.
            expect(attributes).toHaveLength(1);

            const first = attributes[0];

            expect(first.name).toEqual('COLOR_PACKED');
            expect(first.dimension).toEqual(3);
            expect(first.interpretation).toEqual('color');
            expect(first.type).toEqual('unsigned');
            expect(first.size).toEqual(1);
            expect(first.min).toEqual(0);
            expect(first.max).toEqual(255);
        });
    });
    describe('LAZ dataset', () => {
        it('should return correct metadata', async () => {
            const url = getDataFileUrl('potree/laz/cloud.js');
            const source = new PotreeSource({ url });

            await source.initialize();

            const metadata = await source.getMetadata();

            expect(metadata.pointCount).toEqual(17716478347);
            expect(metadata.crs?.definition).toEqual(
                '+proj=utm +zone=10 +ellps=GRS80 +datum=NAD83 +units=m +no_defs',
            );
            expect(metadata.crs?.name).toEqual(`potree:${source.id}`);

            expect(metadata.volume).toBeDefined();

            const volume = metadata.volume!;

            const precision = 1;

            expect(volume.min.x).toBeCloseTo(643431.76, precision);
            expect(volume.min.y).toBeCloseTo(3889087.89, precision);
            expect(volume.min.z).toBeCloseTo(-2.72, precision);

            expect(volume.max.x).toBeCloseTo(736910.93, precision);
            expect(volume.max.y).toBeCloseTo(3971486.41, precision);
            expect(volume.max.z).toBeCloseTo(1093.6, precision);

            expect(metadata.attributes).toBeDefined();

            const attributeMap = new Map<string, PointCloudAttribute>();
            metadata.attributes.forEach(a => attributeMap.set(a.name, a));

            expect(attributeMap.get('Color')).toEqual({
                name: 'Color',
                size: 1,
                dimension: 3,
                interpretation: 'color',
                type: 'unsigned',
                min: 0,
                max: 255,
            });
            expect(attributeMap.get('Intensity')).toEqual({
                name: 'Intensity',
                size: 2,
                dimension: 1,
                interpretation: 'unknown',
                type: 'unsigned',
                min: 0,
                max: 65536,
            });
            expect(attributeMap.get('Classification')).toEqual({
                name: 'Classification',
                size: 1,
                dimension: 1,
                interpretation: 'classification',
                type: 'unsigned',
                min: 0,
                max: 255,
            });
            expect(attributeMap.get('GpsTime')).toEqual({
                name: 'GpsTime',
                size: 4,
                dimension: 1,
                interpretation: 'unknown',
                type: 'float',
                min: 0,
                max: 9999,
            });
            expect(attributeMap.get('NumberOfReturns')).toEqual({
                name: 'NumberOfReturns',
                size: 1,
                dimension: 1,
                interpretation: 'unknown',
                type: 'unsigned',
                min: 0,
                max: 7,
            });
            expect(attributeMap.get('ReturnNumber')).toEqual({
                name: 'ReturnNumber',
                size: 1,
                dimension: 1,
                interpretation: 'unknown',
                type: 'unsigned',
                min: 0,
                max: 7,
            });
            expect(attributeMap.get('PointSourceId')).toEqual({
                name: 'PointSourceId',
                size: 2,
                dimension: 1,
                interpretation: 'unknown',
                type: 'unsigned',
                min: 0,
                max: 65536,
            });
        });
    });
});

describe('getHierarchy', () => {
    describe('BIN dataset', () => {
        it('should return correct octree', async () => {
            const url = getDataFileUrl('potree/bin/cloud.js');
            const source = new PotreeSource({ url });

            await source.initialize();

            const root = await source.getHierarchy();

            const volume = root.volume;

            expect(volume.min.x).toBeCloseTo(-3158.35525);
            expect(volume.min.y).toBeCloseTo(-3040.36129);
            expect(volume.min.z).toBeCloseTo(-4535.583);

            expect(volume.max.x).toBeCloseTo(2522.18675);
            expect(volume.max.y).toBeCloseTo(2640.18071);
            expect(volume.max.z).toBeCloseTo(1144.959);

            expect(root.center).toEqual(root.volume.getCenter(new Vector3()));
            expect(root.geometricError).toBeCloseTo(38.3214912414551);
            expect(root.sourceId).toEqual(source.id);
            expect(root.depth).toEqual(0);
            expect(root.hasData).toEqual(true);
            expect(root.id).toEqual('');
            expect(root.parent).toBeUndefined();

            traverseNode(root, n => {
                if (n !== root) {
                    expect(n.parent).toBeDefined();
                    expect(n.depth).toEqual(n.parent!.depth + 1);
                    expect(n.geometricError).toEqual(root.geometricError / 2 ** n.depth);
                }
                expect(n.volume).toBeDefined();
                expect(n.hasData).toEqual(true);
                return true;
            });
        });
    });
    describe('LAZ dataset', () => {
        it('should return correct octree', async () => {
            const url = getDataFileUrl('potree/laz/cloud.js');
            const source = new PotreeSource({ url });

            await source.initialize();

            const root = await source.getHierarchy();

            const volume = root.volume;

            expect(volume.min.x).toBeCloseTo(643431.76);
            expect(volume.min.y).toBeCloseTo(3889087.89);
            expect(volume.min.z).toBeCloseTo(-2.72);

            expect(volume.max.x).toBeCloseTo(736910.93);
            expect(volume.max.y).toBeCloseTo(3982567.06);
            expect(volume.max.z).toBeCloseTo(93476.45);

            expect(root.center).toEqual(root.volume.getCenter(new Vector3()));
            expect(root.geometricError).toBeCloseTo(647.64);
            expect(root.sourceId).toEqual(source.id);
            expect(root.depth).toEqual(0);
            expect(root.hasData).toEqual(true);
            expect(root.id).toEqual('');
            expect(root.parent).toBeUndefined();

            traverseNode(root, n => {
                if (n !== root) {
                    expect(n.parent).toBeDefined();
                    expect(n.depth).toEqual(n.parent!.depth + 1);
                    expect(n.geometricError).toEqual(root.geometricError / 2 ** n.depth);
                }
                expect(n.volume).toBeDefined();
                expect(n.hasData).toEqual(true);
                return true;
            });
        });
    });
});

describe('getNodeData', () => {
    describe('BIN dataset', () => {
        it('should return correct values for root node', async () => {
            const url = getDataFileUrl('potree/bin/cloud.js');
            const source = new PotreeSource({ url, enableWorkers: false });

            await source.initialize();

            const root = await source.getHierarchy();

            const data = await source.getNodeData({ node: root });

            expect(data.origin).toEqual(root.volume.min);
        });
    });

    describe('LAZ dataset', () => {
        it('should return correct values for root node', async () => {
            const url = getDataFileUrl('potree/laz/cloud.js');
            const source = new PotreeSource({ url, enableWorkers: false });

            await source.initialize();

            const root = await source.getHierarchy();

            const data = await source.getNodeData({ node: root });

            expect(data.origin).toEqual(root.volume.min);
        });
    });
});
