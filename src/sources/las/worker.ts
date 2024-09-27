import * as copc from 'copc';
import type { BaseMessageMap, Message, SuccessResponse } from '../../utils/WorkerPool';
import { createErrorResponse } from '../../utils/WorkerPool';
import type { PointCloudAttribute } from '../PointCloudSource';
import { getLazPerf, setLazPerfPath } from './config';
import type { DimensionFilter } from './filter';
import { getPerPointFilters } from './filter';
import { readColor, readPosition, readScalarAttribute } from './readers';

export type Metadata = {
    pointCount: number;
    pointDataRecordFormat: number;
    pointDataRecordLength: number;
};

async function decompressChunk(chunk: ArrayBuffer, metadata: Metadata) {
    const lazPerf = await getLazPerf();
    return await copc.Las.PointData.decompressChunk(new Uint8Array(chunk), metadata, lazPerf);
}

async function decompressFile(chunk: ArrayBuffer) {
    const lazPerf = await getLazPerf();
    return await copc.Las.PointData.decompressFile(new Uint8Array(chunk), lazPerf);
}

export type BoundingBox = [number, number, number, number, number, number];

export type MessageType = 'DecodeLazChunk' | 'DecodeLazFile' | 'ReadView';

type TypedMessage<K extends MessageType, T> = Message<T> & { type: K };

type DecodeLazChunkMessage = TypedMessage<
    'DecodeLazChunk',
    { buffer: ArrayBuffer; metadata: Metadata }
>;
export type ReadViewResult = {
    position?: {
        buffer: ArrayBuffer;
        localBoundingBox: BoundingBox;
    };
    attribute?: ArrayBuffer;
};
type ReadViewMessage = TypedMessage<
    'ReadView',
    {
        buffer: ArrayBuffer;
        metadata: Metadata;
        header: copc.Las.Extractor.PartialHeader;
        origin: { x: number; y: number; z: number };
        eb?: copc.Las.ExtraBytes[];
        position: boolean;
        stride?: number;
        include?: string[];
        optionalAttribute?: PointCloudAttribute;
        filters?: DimensionFilter[];
        compressColors: boolean;
    }
>;
type DecodeLazFileMessage = TypedMessage<'DecodeLazFile', { buffer: ArrayBuffer }>;
type DecodeLazChunkResponse = SuccessResponse<ArrayBuffer>;
type DecodeLazFileResponse = SuccessResponse<ArrayBuffer>;
type ReadViewResponse = SuccessResponse<ReadViewResult>;

export type SetWasmPathMessage = { type: 'SetWasmPath'; path: string };

type Messages = DecodeLazFileMessage | DecodeLazChunkMessage | SetWasmPathMessage | ReadViewMessage;

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
    postMessage(message: SetWasmPathMessage, options?: StructuredSerializeOptions): void;
    postMessage(message: SetWasmPathMessage, transfer: Transferable[]): void;
}

function processDecodeChunkMessage(msg: DecodeLazChunkMessage) {
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

function processDecodeFileMessage(msg: DecodeLazFileMessage) {
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
    optionalAttribute?: PointCloudAttribute;
    filters?: DimensionFilter[];
    compressColors: boolean;
}): ReadViewResult {
    const { view, filters, origin, optionalAttribute, compressColors } = options;

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

    let attribute: ArrayBuffer | undefined = undefined;

    if (optionalAttribute != null) {
        switch (optionalAttribute.interpretation) {
            case 'color':
                attribute = readColor(view, stride, compressColors, perPointFilters);
                break;
            case 'classification':
            case 'unknown':
                attribute = readScalarAttribute(view, optionalAttribute, stride, perPointFilters);
                break;
        }
    }

    return { position, attribute };
}

function processReadViewMessage(msg: ReadViewMessage) {
    const { buffer, metadata, header, eb, include } = msg.payload;

    decompressChunk(buffer, metadata)
        .then(bin => {
            const view = copc.Las.View.create(bin, header, eb, include);

            const payload = readView({ ...msg.payload, view });

            const response: ReadViewResponse = {
                requestId: msg.id,
                payload,
            };

            const transfer: Transferable[] = [];
            if (payload.attribute) {
                transfer.push(payload.attribute);
            }
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

onmessage = (event: MessageEvent<Messages>) => {
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
        case 'SetWasmPath':
            setLazPerfPath(message.path);
            break;
    }
};
