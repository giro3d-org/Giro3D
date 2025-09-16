/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Blob } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { cwd } from 'process';
import { describe, expect, it } from 'vitest';

import BilFormat from '@giro3d/giro3d/formats/BilFormat';

// Workers do not exist in Node.js
const format = new BilFormat({ enableWorkers: false });

describe('constructor', () => {
    it('should set flipY to true', () => {
        expect(format.flipY).toBeTruthy();
    });
});

describe('decode', () => {
    it('should return a correctly constructed texture', async () => {
        // NOTE: file generated with
        // with open(r'./example.bil', mode='wb') as f:
        //    f.write(struct.pack(''.join(['f' for i in range(0, 16)]),
        //                        *[1+i*1.5 for i in range(0, 16)]))
        const buf = fs.readFileSync(path.join(cwd(), 'test/data/example.bil'));
        const blob = new Blob([buf], { type: 'image/x-bil;bits=32' });
        // create a mock layer
        const options = {
            noDataValue: -99999,
            width: 4,
            height: 4,
        };
        // @ts-expect-error not the same Blob type
        const { texture } = await format.decode(blob, options);

        expect(texture.image.data).toEqual(
            new Float32Array([
                1.0, 1, 2.5, 1, 4.0, 1, 5.5, 1, 7.0, 1, 8.5, 1, 10.0, 1, 11.5, 1, 13.0, 1, 14.5, 1,
                16.0, 1, 17.5, 1, 19.0, 1, 20.5, 1, 22.0, 1, 23.5, 1,
            ]),
        );
    });
    it('should interpret noDataValue as less or equal than layer.noDataValue', async () => {
        // NOTE: file generated with
        // with open(r'./example.bil', mode='wb') as f:
        //    f.write(struct.pack(''.join(['f' for i in range(0, 16)]),
        //                        *[1+i*1.5 for i in range(0, 16)]))
        const buf = fs.readFileSync(path.join(cwd(), 'test/data/example.bil'));
        const blob = new Blob([buf], { type: 'image/x-bil;bits=32' });
        // create a mock layer
        const options = {
            noDataValue: 10.0,
            width: 4,
            height: 4,
        };
        // @ts-expect-error not the same Blob type
        const { texture } = await format.decode(blob, options);

        expect(texture.image.data).toEqual(
            new Float32Array([
                0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 11.5, 1, 13.0, 1, 14.5, 1,
                16.0, 1, 17.5, 1, 19.0, 1, 20.5, 1, 22.0, 1, 23.5, 1,
            ]),
        );
    });
});
