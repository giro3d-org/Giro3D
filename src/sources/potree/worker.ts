/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { BaseMessageMap, Message, SuccessResponse } from '../../utils/WorkerPool';
import type { PotreePointCloudAttribute } from './attributes';
import type { BufferAttributeDescriptor } from './bin';

import { createErrorResponse } from '../../utils/WorkerPool';
import { readBinFile } from './bin';

export type MessageType = 'ReadBinFile';
export interface TypedMessage<K extends MessageType, T> extends Message<T> {
    type: K;
}

type ReadBinFileMessage = TypedMessage<
    'ReadBinFile',
    {
        buffer: ArrayBuffer;
        info: {
            positionAttribute: PotreePointCloudAttribute;
            attributes: PotreePointCloudAttribute[];
            pointByteSize: number;
        };
    }
>;

type ReadBinFileResponse = SuccessResponse<{
    position: BufferAttributeDescriptor;
    attributes: BufferAttributeDescriptor[];
}>;

type Messages = ReadBinFileMessage;

export interface MessageMap extends BaseMessageMap<MessageType> {
    ReadBinFile: {
        payload: ReadBinFileMessage['payload'];
        response: ReadBinFileResponse['payload'];
    };
}

function processReadBinMessage(msg: ReadBinFileMessage): void {
    try {
        const { buffer, info } = msg.payload;
        const result = readBinFile(
            buffer,
            info.pointByteSize,
            info.positionAttribute,
            info.attributes,
        );

        const response: ReadBinFileResponse = {
            requestId: msg.id,
            payload: {
                position: result.positionBuffer,
                attributes: result.attributeBuffers,
            },
        };

        const transfer = [result.positionBuffer, ...result.attributeBuffers].map(
            bufferToTransfer => bufferToTransfer.array,
        );

        postMessage(response, { transfer });
    } catch (err) {
        postMessage(createErrorResponse(msg.id, err));
    }
}

onmessage = (e: MessageEvent<Messages>): void => {
    const message = e.data;

    switch (message.type) {
        case 'ReadBinFile':
            processReadBinMessage(message);
            break;
    }
};
