/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Texture } from 'three';

import { describe, expect, it } from 'vitest';

import GeoTIFFFormat from '@giro3d/giro3d/formats/GeoTIFFFormat';

import { readDataFileSync } from '../../data/utils';

const decoder = new GeoTIFFFormat();

describe('constructor', () => {
    it('should set flipY to true', () => {
        expect(decoder.flipY).toBeTruthy();
    });
});

describe('decode', () => {
    function readFile(dataPath: string) {
        const buf = readDataFileSync(dataPath);
        return new Blob([buf], { type: 'image/tiff' });
    }

    function verifyRGBA(
        texture: Texture,
        pixelIndex: number,
        r: number,
        g: number,
        b: number,
        a: number,
    ) {
        const pixels = texture.image.data;
        const offset = pixelIndex * 4;
        expect(pixels[offset + 0]).toEqual(r);
        expect(pixels[offset + 1]).toEqual(g);
        expect(pixels[offset + 2]).toEqual(b);
        expect(pixels[offset + 3]).toEqual(a);
    }

    function verifyRG(texture: Texture, pixelIndex: number, r: number, g: number) {
        const pixels = texture.image.data;
        const offset = pixelIndex * 2;
        expect(pixels[offset + 0]).toEqual(r);
        expect(pixels[offset + 1]).toEqual(g);
    }

    describe('should return the correct pixels', () => {
        describe('grayscale', () => {
            it('8-bit pixels', async () => {
                const blob = readFile('tiff/2x2_grayscale.tiff');

                const { texture } = await decoder.decode(blob);

                expect(texture.image.width).toEqual(2);
                expect(texture.image.height).toEqual(2);

                verifyRG(texture, 0, 255, 255);
                verifyRG(texture, 1, 50, 255);
                verifyRG(texture, 2, 127, 255);
                verifyRG(texture, 3, 0, 255);
            });

            it.each([
                'tiff/2x2_grayscale_UInt16.tiff',
                'tiff/2x2_grayscale_UInt32.tiff',
                'tiff/2x2_grayscale_Float32.tiff',
            ])('non 8-bit pixels', async file => {
                const blob = readFile(file);

                const { texture } = await decoder.decode(blob);

                expect(texture.image.width).toEqual(2);
                expect(texture.image.height).toEqual(2);

                verifyRG(texture, 0, 255, 1);
                verifyRG(texture, 1, 50, 1);
                verifyRG(texture, 2, 127, 1);
                verifyRG(texture, 3, 0, 1);
            });
        });

        it('RGBA', async () => {
            const blob = readFile('tiff/2x2_rgba.tiff');

            const { texture } = await decoder.decode(blob);

            expect(texture.image.width).toEqual(2);
            expect(texture.image.height).toEqual(2);

            // Colors are premultiplied, so a 50% transparent
            // blue is (0, 0, 128) instead of (0, 0, 255)
            verifyRGBA(texture, 0, 128, 128, 128, 128);
            verifyRGBA(texture, 1, 0, 0, 0, 0);
            verifyRGBA(texture, 2, 0, 0, 128, 128);
            verifyRGBA(texture, 3, 255, 255, 255, 255);
        });

        it('RGB', async () => {
            const blob = readFile('tiff/2x2_rgb.tiff');

            const { texture } = await decoder.decode(blob);

            expect(texture.image.width).toEqual(2);
            expect(texture.image.height).toEqual(2);

            verifyRGBA(texture, 0, 255, 0, 0, 255);
            verifyRGBA(texture, 1, 0, 255, 0, 255);
            verifyRGBA(texture, 2, 0, 0, 255, 255);
            verifyRGBA(texture, 3, 255, 255, 255, 255);
        });
    });
});
