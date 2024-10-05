import type { BaseMessageMap, Message, SuccessResponse } from '../../utils/WorkerPool';
import { createErrorResponse } from '../../utils/WorkerPool';
import type { PotreePointCloudAttribute } from './attributes';
import type { BufferAttributeDescriptor } from './bin';
import { readBinFile } from './bin';

export type MessageType = 'ReadBinFile';
export type TypedMessage<K extends MessageType, T> = Message<T> & { type: K };

type ReadBinFileMessage = TypedMessage<
    'ReadBinFile',
    {
        buffer: ArrayBuffer;
        info: {
            positionAttribute: PotreePointCloudAttribute;
            optionalAttribute?: PotreePointCloudAttribute;
            pointByteSize: number;
        };
    }
>;

type ReadBinFileResponse = SuccessResponse<{
    position: BufferAttributeDescriptor;
    attribute?: BufferAttributeDescriptor;
}>;

type Messages = ReadBinFileMessage;

export interface MessageMap extends BaseMessageMap<MessageType> {
    ReadBinFile: {
        payload: ReadBinFileMessage['payload'];
        response: ReadBinFileResponse['payload'];
    };
}

function processReadBinMessage(msg: ReadBinFileMessage) {
    try {
        const { buffer, info } = msg.payload;
        const result = readBinFile(
            buffer,
            info.pointByteSize,
            info.positionAttribute,
            info.optionalAttribute,
        );

        const response: ReadBinFileResponse = {
            requestId: msg.id,
            payload: {
                position: result.positionBuffer,
                attribute: result.attributeBuffer,
            },
        };

        const position = result.positionBuffer.array;
        const attribute = result.attributeBuffer?.array;

        const transfer = [position];
        if (attribute) {
            transfer.push(attribute);
        }
        postMessage(response, { transfer });
    } catch (err) {
        postMessage(createErrorResponse(msg.id, err));
    }
}

onmessage = (e: MessageEvent<Messages>) => {
    const message = e.data;

    switch (message.type) {
        case 'ReadBinFile':
            processReadBinMessage(message);
            break;
    }
};
