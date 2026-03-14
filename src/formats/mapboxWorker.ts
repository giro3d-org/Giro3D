/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { BaseMessageMap, SuccessResponse } from '../utils/WorkerPool';

import { createErrorResponse, type Message } from '../utils/WorkerPool';

/**
 * Utility functions and worker to process mapbox encoded terrain.
 */

export interface DecodeTerrainResult {
    min: number;
    max: number;
    width: number;
    height: number;
    /**
     * An array buffer that can be turned into a Float32Array.
     */
    data: ArrayBuffer;
}

function getPixels(image: ImageBitmap): Uint8ClampedArray {
    const canvas = new OffscreenCanvas(image.width, image.height);
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
        console.error('could not acquire 2D context on canvas');
        throw new Error('could not acquire 2D context on canvas');
    }

    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.width, image.height).data;
}

export async function decodeTerrainImage(
    blob: Blob,
    encoding: Encoding,
    noData?: number,
): Promise<DecodeTerrainResult> {
    const image = await createImageBitmap(blob);
    const pixelData = getPixels(image);

    return {
        ...decodeTerrainBuffer(pixelData, encoding, noData),
        width: image.width,
        height: image.height,
    };
}

export type Encoding = 'MapboxTerrainRGB' | 'MapzenTerrarium';

function decodeMapboxTerrainRGBPixel(r: number, g: number, b: number): number {
    return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

function decodeMapzenTerrariumRGBPixel(r: number, g: number, b: number): number {
    return r * 256 + g + b / 256 - 32768;
}

function decodeTerrainBuffer(
    pixelData: Uint8ClampedArray,
    encoding: Encoding,
    noData?: number,
): Pick<DecodeTerrainResult, 'data' | 'min' | 'max'> {
    const stride = pixelData.length % 3 === 0 ? 3 : 4;

    const length = pixelData.length / stride;
    const array = new Float32Array(length * 2); // To store the alpha component

    let k = 0;

    let min = +Infinity;
    let max = -Infinity;

    for (let i = 0; i < pixelData.length; i += stride) {
        const r = pixelData[i + 0];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];

        let elevation: number;

        switch (encoding) {
            case 'MapboxTerrainRGB':
                elevation = decodeMapboxTerrainRGBPixel(r, g, b);
                break;
            case 'MapzenTerrarium':
                elevation = decodeMapzenTerrariumRGBPixel(r, g, b);
                break;
        }

        array[k * 2 + 0] = elevation;

        if (noData != null && noData === elevation) {
            array[k * 2 + 1] = 0;
        } else {
            array[k * 2 + 1] = 1;
            min = Math.min(min, elevation);
            max = Math.max(max, elevation);
        }

        k += 1;
    }

    return { data: array.buffer, min, max };
}

// Web worker implementation

export type DecodeTerrainMessage = Message<{
    buffer: ArrayBuffer;
    encoding: Encoding;
    noData?: number;
}>;

export type MessageType = 'DecodeTerrainMessage';

export interface MessageMap extends BaseMessageMap<MessageType> {
    DecodeTerrainMessage: {
        payload: DecodeTerrainMessage['payload'];
        response: DecodeTerrainResult;
    };
}

onmessage = async function onmessage(ev: MessageEvent<DecodeTerrainMessage>): Promise<void> {
    const message = ev.data;

    try {
        if (message.type === 'DecodeTerrainMessage') {
            const blob = new Blob([message.payload.buffer], { type: 'image/png' });
            const result = await decodeTerrainImage(
                blob,
                message.payload.encoding,
                message.payload.noData,
            );
            const response: SuccessResponse<DecodeTerrainResult> = {
                requestId: message.id,
                payload: result,
            };
            this.postMessage(response, { transfer: [response.payload.data] });
        }
    } catch (err) {
        this.postMessage(createErrorResponse(message.id, err));
    }
};
