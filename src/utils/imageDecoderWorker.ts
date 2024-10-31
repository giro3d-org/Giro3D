import type { TextureDataType, TypedArray } from 'three';
import type { BaseMessageMap, Message, SuccessResponse } from './WorkerPool';
import { createErrorResponse } from './WorkerPool';

// Redeclare those constants to avoid importing them from three.js, since
// that would have a huge impact on bundling this file in an inlined worker,
// because three.js is notoriously un-tree-shakeable.
// (Importing types from three.js is fine, however).
const UnsignedByteType: TextureDataType = 1009;
const FloatType: TextureDataType = 1015;

export const OPAQUE_BYTE = 255;
export const OPAQUE_FLOAT = 1.0;
export const TRANSPARENT = 0;
export const DEFAULT_NODATA = 0;

export type TypedArrayType =
    | 'Float32Array'
    | 'Float64Array'
    | 'Uint8ClampedArray'
    | 'Uint8Array'
    | 'Uint16Array'
    | 'Uint32Array'
    | 'Int8Array'
    | 'Int16Array'
    | 'Int32Array';

export type CreatePixelBufferOptions = {
    input: ArrayBuffer[];
    bufferSize: number;
    inputType: TypedArrayType;
    dataType: TextureDataType;
    nodata?: number;
    opaqueValue: number;
};

export type CreatePixelBufferResult = {
    buffer: ArrayBuffer;
    min: number;
    max: number;
    isTransparent: boolean;
};

export function getTypedArrayType(array: TypedArray): TypedArrayType {
    if (array instanceof Float32Array) {
        return 'Float32Array';
    }
    if (array instanceof Float64Array) {
        return 'Float64Array';
    }
    if (array instanceof Uint32Array) {
        return 'Uint32Array';
    }
    if (array instanceof Uint16Array) {
        return 'Uint16Array';
    }
    if (array instanceof Int32Array) {
        return 'Int32Array';
    }
    if (array instanceof Int16Array) {
        return 'Int16Array';
    }
    if (array instanceof Uint8Array) {
        return 'Uint8Array';
    }
    if (array instanceof Int8Array) {
        return 'Int8Array';
    }
    if (array instanceof Uint8ClampedArray) {
        return 'Uint8ClampedArray';
    }

    throw new Error('unsupported type');
}

export function createTypedArrayFromBuffer(
    buf: ArrayBuffer,
    type: TypedArrayType | TextureDataType,
): TypedArray {
    // Case 1: a texture data type
    if (typeof type === 'number') {
        switch (type) {
            case UnsignedByteType:
                return new Uint8ClampedArray(buf);
            case FloatType:
                return new Float32Array(buf);
        }
    } else {
        // Case 2: a typed array type
        switch (type) {
            case 'Float32Array':
                return new Float32Array(buf);
            case 'Float64Array':
                return new Float64Array(buf);
            case 'Uint8ClampedArray':
                return new Uint8ClampedArray(buf);
            case 'Uint8Array':
                return new Uint8Array(buf);
            case 'Uint16Array':
                return new Uint16Array(buf);
            case 'Uint32Array':
                return new Uint32Array(buf);
            case 'Int8Array':
                return new Int8Array(buf);
            case 'Int16Array':
                return new Int16Array(buf);
            case 'Int32Array':
                return new Int32Array(buf);
        }
    }

    throw new Error('invalid state');
}

// Important note : a lot of code is duplicated to avoid putting
// conditional branches inside loops, as this can severely reduce performance.

// Note: we don't use Number.isNan(x) in the loops as it slows down the loop due to function
// invocation. Instead, we use x !== x, as a NaN is never equal to itself.
export function createPixelBuffer(options: CreatePixelBufferOptions): CreatePixelBufferResult {
    const pixelData = options.input.map(buf => createTypedArrayFromBuffer(buf, options.inputType));
    const opaqueValue = options.opaqueValue;
    let buf: TypedArray;
    if (options.bufferSize && options.dataType) {
        switch (options.dataType) {
            case FloatType:
                buf = new Float32Array(options.bufferSize);
                break;
            case UnsignedByteType:
                buf = new Uint8ClampedArray(options.bufferSize);
                break;
            default:
                throw new Error('unrecognized buffer type: ' + options.dataType);
        }
    } else {
        console.error('missing values');
        throw new Error('missing values');
    }

    let min = +Infinity;
    let max = -Infinity;

    let isTransparent = true;

    if (pixelData.length === 1) {
        const v = pixelData[0];
        const length = v.length;
        for (let i = 0; i < length; i++) {
            const idx = i * 2;
            let value: number;
            let a: number;
            const raw = v[i];
            if (raw !== raw || raw === options.nodata) {
                value = DEFAULT_NODATA;
                a = TRANSPARENT;
            } else {
                value = raw;
                a = opaqueValue;
                isTransparent = false;
            }
            min = Math.min(min, value);
            max = Math.max(max, value);

            buf[idx + 0] = value;
            buf[idx + 1] = a;
        }
    }
    if (pixelData.length === 2) {
        const v = pixelData[0];
        const a = pixelData[1];
        const length = v.length;
        for (let i = 0; i < length; i++) {
            const idx = i * 2;
            let value: number;
            const raw = v[i];
            const alpha = a[i];

            if (raw !== raw || raw === options.nodata) {
                value = DEFAULT_NODATA;
            } else {
                value = raw;
            }

            if (alpha > 0) {
                isTransparent = false;
            }

            min = Math.min(min, value);
            max = Math.max(max, value);

            buf[idx + 0] = value;
            buf[idx + 1] = a[i];
        }
    }
    if (pixelData.length === 3) {
        const rChannel = pixelData[0];
        const gChannel = pixelData[1];
        const bChannel = pixelData[2];
        const length = rChannel.length;
        let a;
        for (let i = 0; i < length; i++) {
            const idx = i * 4;

            let r = rChannel[i];
            let g = gChannel[i];
            let b = bChannel[i];

            if (
                (r !== r || r === options.nodata) &&
                (g !== g || g === options.nodata) &&
                (b !== b || b === options.nodata)
            ) {
                r = DEFAULT_NODATA;
                g = DEFAULT_NODATA;
                b = DEFAULT_NODATA;
                a = TRANSPARENT;
            } else {
                a = opaqueValue;
                isTransparent = false;
            }

            buf[idx + 0] = r;
            buf[idx + 1] = g;
            buf[idx + 2] = b;
            buf[idx + 3] = a;
        }
    }
    if (pixelData.length === 4) {
        const rChannel = pixelData[0];
        const gChannel = pixelData[1];
        const bChannel = pixelData[2];
        const aChannel = pixelData[3];
        const length = rChannel.length;
        for (let i = 0; i < length; i++) {
            const idx = i * 4;
            let r = rChannel[i];
            let g = gChannel[i];
            let b = bChannel[i];
            let a = aChannel[i];

            if (
                (r !== r || r === options.nodata) &&
                (g !== g || g === options.nodata) &&
                (b !== b || b === options.nodata)
            ) {
                r = DEFAULT_NODATA;
                g = DEFAULT_NODATA;
                b = DEFAULT_NODATA;
                a = TRANSPARENT;
            } else {
                if (a > 0) {
                    isTransparent = false;
                }
            }

            buf[idx + 0] = r;
            buf[idx + 1] = g;
            buf[idx + 2] = b;
            buf[idx + 3] = a;
        }
    }
    return {
        buffer: buf.buffer,
        min,
        max,
        isTransparent,
    };
}

// Web worker implementation
export type CreatePixelBufferMessage = Message<CreatePixelBufferOptions> & {
    type: 'CreatePixelBuffer';
};
export type CreatePixelBufferResponse = SuccessResponse<CreatePixelBufferResult>;

export type CreateImageBitmapMessage = Message<{
    buffer: ArrayBuffer;
    options?: ImageBitmapOptions;
}> & { type: 'CreateImageBitmap' };
export type CreateImageBitmapMessageResponse = SuccessResponse<ImageBitmap>;

export type MessageType = 'CreateImageBitmap' | 'CreatePixelBuffer';

export interface MessageMap extends BaseMessageMap<MessageType> {
    CreatePixelBuffer: {
        payload: CreatePixelBufferMessage['payload'];
        response: CreatePixelBufferResponse['payload'];
    };
    CreateImageBitmap: {
        payload: CreateImageBitmapMessage['payload'];
        response: CreateImageBitmapMessageResponse['payload'];
    };
}

export type Messages = CreateImageBitmapMessage | CreatePixelBufferMessage;

onmessage = async function onmessage(ev: MessageEvent<Messages>) {
    const message = ev.data;

    try {
        switch (message.type) {
            case 'CreatePixelBuffer':
                {
                    const result = createPixelBuffer(message.payload);
                    const response: CreatePixelBufferResponse = {
                        requestId: message.id,
                        payload: result,
                    };
                    this.postMessage(response, { transfer: [response.payload.buffer] });
                }
                break;
            case 'CreateImageBitmap':
                {
                    const blob = new Blob([message.payload.buffer]);
                    const bitmap = await createImageBitmap(blob, message.payload.options);
                    const response: CreateImageBitmapMessageResponse = {
                        requestId: message.id,
                        payload: bitmap,
                    };
                    this.postMessage(response, { transfer: [bitmap] });
                }
                break;
        }
    } catch (err) {
        this.postMessage(createErrorResponse(message.id, err));
    }
};
