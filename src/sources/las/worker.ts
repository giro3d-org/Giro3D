/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import * as copc from 'copc';

import type { BaseMessageMap, Message, SuccessResponse } from '../../utils/WorkerPool';
import type { PointCloudAttribute } from '../PointCloudSource';
import type { DimensionFilter } from './filter';

import { createErrorResponse } from '../../utils/WorkerPool';
import { getLazPerf, setLazPerfWasmBinary } from './config';
import { getPerPointFilters } from './filter';
import { readColor, readPosition, readScalarAttribute } from './readers';

export interface Metadata {
    pointCount: number;
    pointDataRecordFormat: number;
    pointDataRecordLength: number;
}

async function decompressChunk(chunk: ArrayBufferLike, metadata: Metadata): Promise<copc.Binary> {
    const lazPerf = await getLazPerf();
    return copc.Las.PointData.decompressChunk(new Uint8Array(chunk), metadata, lazPerf);
}

async function decompressFile(chunk: ArrayBufferLike): Promise<copc.Binary> {
    const lazPerf = await getLazPerf();
    return copc.Las.PointData.decompressFile(new Uint8Array(chunk), lazPerf);
}

export type BoundingBox = [number, number, number, number, number, number];

export type MessageType = 'DecodeLazChunk' | 'DecodeLazFile' | 'ReadView' | 'SetWasmBinary';

interface TypedMessage<K extends MessageType, T> extends Message<T> {
    type: K;
}

type DecodeLazChunkMessage = TypedMessage<
    'DecodeLazChunk',
    { buffer: ArrayBufferLike; metadata: Metadata }
>;
export interface ReadViewResult {
    position?: {
        buffer: ArrayBuffer;
        localBoundingBox: BoundingBox;
    };
    attributes: ArrayBuffer[];
}

type ReadViewMessage = TypedMessage<
    'ReadView',
    {
        buffer: ArrayBufferLike;
        metadata: Metadata;
        header: copc.Las.Extractor.PartialHeader;
        origin: { x: number; y: number; z: number };
        eb?: copc.Las.ExtraBytes[];
        position: boolean;
        stride?: number;
        include?: string[];
        attributes: PointCloudAttribute[];
        filters?: DimensionFilter[];
        compressColors: boolean;
    }
>;
type DecodeLazFileMessage = TypedMessage<'DecodeLazFile', { buffer: ArrayBufferLike }>;
type DecodeLazChunkResponse = SuccessResponse<ArrayBufferLike>;
type DecodeLazFileResponse = SuccessResponse<ArrayBufferLike>;
type ReadViewResponse = SuccessResponse<ReadViewResult>;

export interface SetWasmBinaryMessage {
    type: 'SetWasmBinary';
    buffer: ArrayBuffer;
}

type Messages =
    | DecodeLazFileMessage
    | DecodeLazChunkMessage
    | SetWasmBinaryMessage
    | ReadViewMessage;

export interface MessageMap extends BaseMessageMap<MessageType> {
    DecodeLazChunk: {
        payload: DecodeLazChunkMessage['payload'];
        response: DecodeLazFileResponse['payload'];
    };
    DecodeLazFile: {
        payload: DecodeLazFileMessage['payload'];
        response: DecodeLazChunkResponse['payload'];
    };
    ReadView: {
        payload: ReadViewMessage['payload'];
        response: ReadViewResponse['payload'];
    };
}

export interface LazWorker extends Worker {
    postMessage(message: SetWasmBinaryMessage, options?: StructuredSerializeOptions): void;
    postMessage(message: SetWasmBinaryMessage, transfer: Transferable[]): void;
}

function processDecodeChunkMessage(msg: DecodeLazChunkMessage): void {
    decompressChunk(msg.payload.buffer, msg.payload.metadata)
        .then(buf => {
            const response: DecodeLazChunkResponse = {
                requestId: msg.id,
                payload: buf.buffer,
            };
            postMessage(response, { transfer: [buf.buffer] });
        })
        .catch(err => {
            postMessage(createErrorResponse(msg.id, err));
        });
}

function processDecodeFileMessage(msg: DecodeLazFileMessage): void {
    decompressFile(msg.payload.buffer)
        .then(buf => {
            const response: DecodeLazFileResponse = {
                requestId: msg.id,
                payload: buf.buffer,
            };
            postMessage(response, { transfer: [buf.buffer] });
        })
        .catch(err => {
            console.error(err);
            postMessage(createErrorResponse(msg.id, err));
        });
}

export function readView(options: {
    view: copc.View;
    origin: { x: number; y: number; z: number };
    stride?: number;
    position: boolean;
    attributes: PointCloudAttribute[];
    filters?: DimensionFilter[];
    compressColors: boolean;
}): ReadViewResult {
    const { view, filters, origin, attributes, compressColors } = options;

    const stride = options.stride ?? 1;
    const perPointFilters = getPerPointFilters(filters ?? [], view);

    let position: ReadViewResult['position'] | undefined = undefined;
    if (options.position) {
        const data = readPosition(view, origin, stride, perPointFilters);

        const localBoundingBox: BoundingBox = [
            data.localBoundingBox.min.x,
            data.localBoundingBox.min.y,
            data.localBoundingBox.min.z,
            data.localBoundingBox.max.x,
            data.localBoundingBox.max.y,
            data.localBoundingBox.max.z,
        ];

        position = {
            buffer: data.buffer,
            localBoundingBox,
        };
    }

    const attributesBuffers = attributes.map(attribute => {
        switch (attribute.interpretation) {
            case 'color':
                return readColor(view, stride, compressColors, perPointFilters);
                break;
            case 'classification':
            case 'unknown':
                return readScalarAttribute(view, attribute, stride, perPointFilters);
                break;
        }
    });

    return { position, attributes: attributesBuffers };
}

function processReadViewMessage(msg: ReadViewMessage): void {
    const { buffer, metadata, header, eb, include } = msg.payload;

    decompressChunk(buffer, metadata)
        .then(bin => {
            const view = copc.Las.View.create(bin, header, eb, include);

            const payload = readView({ ...msg.payload, view });

            const response: ReadViewResponse = {
                requestId: msg.id,
                payload,
            };

            const transfer: Transferable[] = [...payload.attributes];
            if (payload.position) {
                transfer.push(payload.position.buffer);
            }

            postMessage(response, { transfer });
        })
        .catch(err => {
            console.error(err);
            postMessage(createErrorResponse(msg.id, err));
        });
}

onmessage = (event: MessageEvent<Messages>): void => {
    const message = event.data;

    switch (message.type) {
        case 'DecodeLazChunk':
            processDecodeChunkMessage(message);
            break;
        case 'DecodeLazFile':
            processDecodeFileMessage(message);
            break;
        case 'ReadView':
            processReadViewMessage(message);
            break;
        case 'SetWasmBinary':
            setLazPerfWasmBinary(message.buffer);
            break;
    }
};
