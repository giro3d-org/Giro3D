import {
    EventDispatcher,
    WebGLRenderTarget,
    type RenderTargetOptions,
    type WebGLRenderer,
} from 'three';
import type MemoryUsage from '../core/MemoryUsage';
import { type GetMemoryUsageContext } from '../core/MemoryUsage';
import NestedMap from '../utils/NestedMap';
import TextureGenerator from '../utils/TextureGenerator';

export interface RenderTargetPoolEvents {
    cleanup: unknown;
}

const createPool = () => [];

/**
 * A pool that manages {@link RenderTarget}s.
 */
export default class RenderTargetPool
    extends EventDispatcher<RenderTargetPoolEvents>
    implements MemoryUsage
{
    readonly isMemoryUsage = true as const;
    // Note that we cannot share render targets between instances are they are tied to a single WebGLRenderer.
    private readonly _globalPool: NestedMap<
        WebGLRenderer,
        RenderTargetOptions,
        WebGLRenderTarget[]
    > = new NestedMap();
    private readonly _renderTargets: Map<WebGLRenderTarget, RenderTargetOptions> = new Map();
    private readonly _cleanupTimeoutMs: number;
    private _timeout: NodeJS.Timeout | null = null;
    private _maxPoolSize: number;

    constructor(cleanupTimeoutMs: number, maxPoolSize: number) {
        super();
        this._cleanupTimeoutMs = cleanupTimeoutMs;
        this._maxPoolSize = maxPoolSize;
    }

    getMemoryUsage(context: GetMemoryUsageContext) {
        if (this._globalPool.size === 0) {
            return;
        }

        this._globalPool.forEach((targets, renderer) => {
            if (renderer === context.renderer) {
                targets.forEach(target => TextureGenerator.getMemoryUsage(context, target));
            }
        });
    }

    acquire(renderer: WebGLRenderer, width: number, height: number, options: RenderTargetOptions) {
        const pool = this._globalPool.getOrCreate(renderer, options, createPool);

        if (pool.length > 0) {
            const cached = pool.pop() as WebGLRenderTarget;
            cached.setSize(width, height);
            return cached;
        }

        const result = new WebGLRenderTarget(width, height, options);
        this._renderTargets.set(result, options);
        return result;
    }

    get count(): number {
        return this._renderTargets.size;
    }

    release(obj: WebGLRenderTarget, renderer: WebGLRenderer) {
        const options = this._renderTargets.get(obj);
        if (options) {
            const pool = this._globalPool.getOrCreate(renderer, options, createPool);

            if (pool.length < this._maxPoolSize) {
                pool.push(obj);
            } else {
                obj.dispose();
                this._renderTargets.delete(obj);
            }
        }

        if (this._timeout) {
            clearTimeout(this._timeout);
        }
        this._timeout = setTimeout(() => this.cleanup(), this._cleanupTimeoutMs);
    }

    cleanup() {
        this._timeout = null;

        this._globalPool.forEach(list => {
            list.forEach(renderTarget => {
                renderTarget.dispose();
                this._renderTargets.delete(renderTarget);
            });
        });
        this._globalPool.clear();

        this.dispatchEvent({ type: 'cleanup' });
    }
}

export const GlobalRenderTargetPool = new RenderTargetPool(50, 16);
