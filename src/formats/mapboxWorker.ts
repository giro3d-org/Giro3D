import type { BaseMessageMap, SuccessResponse } from '../utils/WorkerPool';
import { createErrorResponse, type Message } from '../utils/WorkerPool';

/**
 * Utility functions and worker to process mapbox encoded terrain.
 */

export type DecodeMapboxTerrainResult = {
    min: number;
    max: number;
    width: number;
    height: number;
    /**
     * An array buffer that can be turned into a Float32Array.
     */
    data: ArrayBuffer;
};

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

export async function decodeMapboxTerrainImage(
    blob: Blob,
    noData?: number,
): Promise<DecodeMapboxTerrainResult> {
    const image = await createImageBitmap(blob);
    const pixelData = getPixels(image);

    return {
        ...decodeMapboxTerrainBuffer(pixelData, noData),
        width: image.width,
        height: image.height,
    };
}

function decodeMapboxTerrainBuffer(pixelData: Uint8ClampedArray, noData?: number) {
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

        const elevation = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;

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

export type DecodeMapboxTerrainMessage = Message<{ buffer: ArrayBuffer; noData?: number }>;

export type MessageType = 'DecodeMapboxTerrainMessage';

export interface MessageMap extends BaseMessageMap<MessageType> {
    DecodeMapboxTerrainMessage: {
        payload: DecodeMapboxTerrainMessage['payload'];
        response: DecodeMapboxTerrainResult;
    };
}

onmessage = async function onmessage(ev: MessageEvent<DecodeMapboxTerrainMessage>) {
    const message = ev.data;

    try {
        if (message.type === 'DecodeMapboxTerrainMessage') {
            const blob = new Blob([message.payload.buffer], { type: 'image/png' });
            const result = await decodeMapboxTerrainImage(blob, message.payload.noData);
            const response: SuccessResponse<DecodeMapboxTerrainResult> = {
                requestId: message.id,
                payload: result,
            };
            this.postMessage(response, { transfer: [response.payload.data] });
        }
    } catch (err) {
        this.postMessage(createErrorResponse(message.id, err));
    }
};
