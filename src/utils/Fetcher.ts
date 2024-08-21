import { EventDispatcher, type EventListener, type Texture } from 'three';
import HttpConfiguration from './HttpConfiguration';
import HttpQueue from './HttpQueue';
import PromiseUtils from './PromiseUtils';
import TextureGenerator from './TextureGenerator';

const DEFAULT_RETRY_DELAY_MS = 1000;

export interface FetcherEventMap {
    /**
     * Fires when a Network or HTTP error occured during fetch
     * ```js
     * Fetcher.addEventListener('error', (error) => {
     *     if (error.response && error.response.status === 401) {
     *        console.error(
     *            `Unauthorized to access resource ${error.response.url}: ${error.message}`,
     *            error,
     *        );
     *    } else {
     *        console.error('Got an error while fetching resource', error);
     *    }
     * });
     * ```
     */
    error: { error: Error };
}

export class FetcherEventDispatcher extends EventDispatcher<FetcherEventMap> {}

const eventTarget = new FetcherEventDispatcher();

/**
 * Adds a listener to an event type on fetch operations.
 *
 * @param type - The type of event to listen to - only `error` is supported.
 * @param listener - The function that gets called when the event is fired.
 */
function addEventListener<T extends keyof FetcherEventMap>(
    type: T,
    listener: EventListener<FetcherEventMap[T], T, FetcherEventDispatcher>,
) {
    eventTarget.addEventListener(type, listener);
}

/**
 * Checks if listener is added to an event type.
 *
 * @param type - The type of event to listen to - only `error` is supported.
 * @param listener - The function that gets called when the event is fired.
 * @returns `true` if the listener is added to this event type.
 */
function hasEventListener<T extends keyof FetcherEventMap>(
    type: T,
    listener: EventListener<FetcherEventMap[T], T, FetcherEventDispatcher>,
): boolean {
    return eventTarget.hasEventListener(type, listener);
}

/**
 * Removes a listener from an event type on fetch operations.
 *
 * @param type - The type of the listener that gets removed.
 * @param listener - The listener function that gets removed.
 */
function removeEventListener<T extends keyof FetcherEventMap>(
    type: T,
    listener: EventListener<FetcherEventMap[T], T, FetcherEventDispatcher>,
) {
    eventTarget.removeEventListener(type, listener);
}

const hostQueues: Map<string, HttpQueue> = new Map();

/**
 * Queue an HTTP request.
 *
 * @param req - The request to queue.
 */
function enqueue(req: Request) {
    const url = new URL(req.url);

    let queue = hostQueues.get(url.hostname);
    if (!queue) {
        queue = new HttpQueue();
        hostQueues.set(url.hostname, queue);
    }
    return queue.enqueue(req);
}

/**
 * @internal
 */
function getInfo() {
    let pending = 0;
    let running = 0;
    let complete = 0;
    hostQueues.forEach(queue => {
        pending += queue.size;
        running += queue.concurrentRequests;
        complete += queue.completedRequests;
    });
    return { pending, running, complete };
}

/**
 * An error raised whenever the received response does not have a 2XX status.
 */
export class HttpError extends Error {
    readonly response: Response;

    constructor(response: Response) {
        super(`${response.status} ${response.statusText} - ${response.url}`);

        this.response = response;
    }
}

export type FetchOptions = RequestInit & {
    /**
     * The number of retries if the initial requests fails with an HTTP error code.
     * @defaultValue undefined
     */
    retries?: number;
    /**
     * The delay to wait (in milliseconds) before a new try is attempted. Only if {@link retries} is defined.
     * @defaultValue 1000
     */
    retryDelay?: number;
};

/**
 * Wrapper over [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/fetch).
 *
 * Use this function instead of calling directly the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
 * to benefit from automatic configuration from the {@link HttpConfiguration} module.
 *
 * fires `error` event On Network/HTTP error.
 * @param url - the URL to fetch
 * @param options - fetch options (passed directly to `fetch()`)
 * @returns The response object.
 */
async function fetchInternal(url: string, options?: FetchOptions): Promise<Response> {
    const augmentedOptions = HttpConfiguration.applyConfiguration(url, options);
    const req = new Request(url, augmentedOptions);
    const response = await enqueue(req).catch(error => {
        eventTarget.dispatchEvent({ type: 'error', error });
        throw error;
    });
    if (!response.ok) {
        const retries = options?.retries ?? 0;

        if (retries > 0) {
            const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
            if (retryDelay > 0) {
                await PromiseUtils.delay(retryDelay);
            }

            return fetchInternal(url, {
                ...options,
                retries: retries - 1,
            });
        } else {
            const error = new HttpError(response);
            eventTarget.dispatchEvent({ type: 'error', error });
            throw error;
        }
    }
    return response;
}

/**
 * Wrapper over `fetch`, then returns the blob of the response.
 *
 * fires `error` event On Network/HTTP error.
 * @param url - the URL to fetch
 * @param options - fetch options (passed directly to `fetch()`)
 * @returns The response blob.
 */
async function blob(url: string, options?: RequestInit): Promise<Blob> {
    const response = await fetchInternal(url, options);
    return response.blob();
}

/**
 * Wrapper over `fetch` to get some text
 *
 * fires `error` event On Network/HTTP error.
 * @param url - the URL to fetch
 * @param options - fetch options (passed directly to `fetch()`)
 * @returns the promise containing the text
 */
async function text(url: string, options?: RequestInit): Promise<string> {
    const response = await fetchInternal(url, options);
    return response.text();
}

/**
 * Wrapper over `fetch` to get some JSON
 *
 * fires `error` event On Network/HTTP error.
 * @param url - the URL to fetch
 * @param options - fetch options (passed directly to `fetch()`)
 * @returns the promise containing the JSON
 */
async function json<T = unknown>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetchInternal(url, options);
    return response.json();
}

/**
 * Wrapper over `fetch` to get some XML.
 *
 * fires `error` event On Network/HTTP error.
 * @param url - the URL to fetch
 * @param options - fetch options (passed directly to `fetch()`)
 * @returns the promise containing the XML
 */
async function xml(url: string, options?: RequestInit): Promise<Document> {
    const response = await fetchInternal(url, options);
    const txt = await response.text();
    return new window.DOMParser().parseFromString(txt, 'text/xml');
}

/**
 * Wrapper over `fetch` to get some `ArrayBuffer`
 *
 * fires `error` event On Network/HTTP error.
 * @param url - the URL to fetch
 * @param options - fetch options (passed directly to `fetch()`)
 * @returns the promise containing the ArrayBuffer
 */
async function arrayBuffer(url: string, options?: RequestInit): Promise<ArrayBuffer> {
    const response = await fetchInternal(url, options);
    return response.arrayBuffer();
}

/**
 * Downloads a remote image and converts it into a texture.
 *
 * fires `error` event On Network/HTTP error.
 * @param url - the URL to fetch
 * @param options - Texture creation options and fetch options (passed directly to `fetch()`)
 * @returns the promise containing the texture
 */
async function texture(
    url: string,
    options?: RequestInit & { createDataTexture?: boolean; flipY?: boolean },
): Promise<Texture> {
    const data = await blob(url, options);
    return TextureGenerator.decodeBlob(data, options);
}

/**
 * Exposes an API to perform HTTP requests.
 * This should be used instead of the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
 * in order to benefit from some error-checking, automatic configuration (from the
 * {@link HttpConfiguration} module), etc.
 *
 */
export default {
    fetch: fetchInternal,
    xml,
    json,
    blob,
    texture,
    arrayBuffer,
    text,
    /** @internal */
    getInfo,
    addEventListener,
    hasEventListener,
    removeEventListener,
    /** @internal */
    _eventTarget: eventTarget, // Used for testing
};
