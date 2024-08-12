import {
    EventDispatcher,
    WebGLRenderTarget,
    type RenderTargetOptions,
    type WebGLRenderer,
} from 'three';
import type MemoryUsage from '../core/MemoryUsage';
import {
    createEmptyReport,
    type GetMemoryUsageContext,
    type MemoryUsageReport,
} from '../core/MemoryUsage';
import TextureGenerator from '../utils/TextureGenerator';

export interface RenderTargetPoolEvents {
    cleanup: {
        /** nothing */
    };
}

/**
 * A pool that manages {@link RenderTarget}s.
 */
export default class RenderTargetPool
    extends EventDispatcher<RenderTargetPoolEvents>
    implements MemoryUsage
{
    // Note that we cannot share render targets between instances are they are tied to a single WebGLRenderer.
    private readonly _perRendererPools: Map<
        WebGLRenderer,
        Map<RenderTargetOptions, WebGLRenderTarget[]>
    > = new Map();
    private readonly _renderTargets: Map<WebGLRenderTarget, RenderTargetOptions> = new Map();
    private readonly _cleanupTimeoutMs: number;
    private _timeout: NodeJS.Timeout;
    private _maxPoolSize: number;

    constructor(cleanupTimeoutMs: number, maxPoolSize: number) {
        super();
        this._cleanupTimeoutMs = cleanupTimeoutMs;
        this._maxPoolSize = maxPoolSize;
    }

    getMemoryUsage(context: GetMemoryUsageContext, target?: MemoryUsageReport): MemoryUsageReport {
        const result = target ?? createEmptyReport();

        if (this._perRendererPools.size === 0) {
            return result;
        }

        const pool = this._perRendererPools.get(context.renderer);

        if (pool) {
            pool.forEach(targets => {
                targets.forEach(target => TextureGenerator.getMemoryUsage(target, context, result));
            });
        }

        return result;
    }

    acquire(renderer: WebGLRenderer, width: number, height: number, options: RenderTargetOptions) {
        if (!this._perRendererPools.has(renderer)) {
            this._perRendererPools.set(renderer, new Map());
        }

        const rendererPool = this._perRendererPools.get(renderer);
        if (!rendererPool.has(options)) {
            rendererPool.set(options, []);
        }

        const pool = rendererPool.get(options);

        if (pool.length > 0) {
            const cached = pool.pop();
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
            let instancePool = this._perRendererPools.get(renderer);
            if (!instancePool) {
                instancePool = new Map();
                this._perRendererPools.set(renderer, instancePool);
            }

            let pool = instancePool.get(options);
            if (!pool) {
                pool = [];
                instancePool.set(options, pool);
            }

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

        this._perRendererPools.forEach(instancePool => {
            instancePool.forEach(list => {
                list.forEach(renderTarget => {
                    renderTarget.dispose();
                    this._renderTargets.delete(renderTarget);
                });
            });
        });
        this._perRendererPools.clear();

        this.dispatchEvent({ type: 'cleanup' });
    }
}

export const GlobalRenderTargetPool = new RenderTargetPool(50, 16);
