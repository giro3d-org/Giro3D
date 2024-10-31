import type { BaseMessageMap, Message, SuccessResponse } from './WorkerPool';
import { createErrorResponse } from './WorkerPool';

// Web worker implementation

export type CreateImageBitmapMessage = Message<{
    buffer: ArrayBuffer;
    options?: ImageBitmapOptions;
}> & { type: 'CreateImageBitmap' };
export type CreateImageBitmapMessageResponse = SuccessResponse<ImageBitmap>;

export type MessageType = 'CreateImageBitmap';

export interface MessageMap extends BaseMessageMap<MessageType> {
    CreateImageBitmap: {
        payload: CreateImageBitmapMessage['payload'];
        response: CreateImageBitmapMessageResponse['payload'];
    };
}

export type Messages = CreateImageBitmapMessage;

onmessage = async function onmessage(ev: MessageEvent<Messages>) {
    const message = ev.data;

    try {
        switch (message.type) {
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
