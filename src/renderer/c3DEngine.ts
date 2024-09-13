import type {
    Camera,
    ColorRepresentation,
    Object3D,
    Scene,
    TextureDataType,
    WebGLRendererParameters,
} from 'three';
import {
    DepthTexture,
    LinearFilter,
    NearestFilter,
    RGBAFormat,
    UnsignedByteType,
    UnsignedShortType,
    Vector2,
    WebGLRenderer,
    WebGLRenderTarget,
} from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Capabilities from '../core/system/Capabilities';
import RenderingOptions from './RenderingOptions';
import RenderPipeline from './RenderPipeline';

import TextureGenerator from '../utils/TextureGenerator';
import registerChunks from './shader/chunk/registerChunks';

const tmpVec2 = new Vector2();

function createRenderTarget(
    width: number,
    height: number,
    type: TextureDataType,
    renderer: WebGLRenderer,
) {
    const result = new WebGLRenderTarget(width, height, {
        type,
        format: RGBAFormat,
    });
    result.texture.minFilter = TextureGenerator.getCompatibleTextureFilter(
        LinearFilter,
        type,
        renderer,
    );
    result.texture.magFilter = NearestFilter;
    result.texture.generateMipmaps = false;
    result.depthBuffer = true;
    result.depthTexture = new DepthTexture(width, height, UnsignedShortType);

    return result;
}

/**
 * @param options - The options.
 * @returns True if the options requires a custom pipeline.
 */
function requiresCustomPipeline(options: RenderingOptions) {
    return options.enableEDL || options.enableInpainting || options.enablePointCloudOcclusion;
}

function createErrorMessage() {
    // from Detector.js
    const element = document.createElement('div');
    element.id = 'webgl-error-message';
    element.style.fontFamily = 'monospace';
    element.style.fontSize = '13px';
    element.style.fontWeight = 'normal';
    element.style.textAlign = 'center';
    element.style.background = '#fff';
    element.style.color = '#000';
    element.style.padding = '1.5em';
    element.style.width = '400px';
    element.style.margin = '5em auto 0';
    element.innerHTML =
        window.WebGLRenderingContext != null
            ? [
                  'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br />',
                  'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.<br>',
                  'See also <a href="https://www.khronos.org/webgl/wiki/BlacklistsAndWhitelists">graphics card blacklisting</a>',
              ].join('\n')
            : [
                  'Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br/>',
                  'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.<br>',
                  'You can also try another browser like Firefox or Chrome.',
              ].join('\n');

    return element;
}

function createRenderer(target: HTMLDivElement, options?: WebGLRendererParameters): WebGLRenderer {
    // Create renderer
    try {
        const renderer = new WebGLRenderer({
            ...options,
            canvas: options?.canvas ?? document.createElement('canvas'),
            antialias: options?.antialias ?? true,
            alpha: options?.alpha ?? true,
            logarithmicDepthBuffer: options?.logarithmicDepthBuffer ?? false,
        });

        // Necessary to enable clipping planes per-entity or per-object, rather
        // than per-renderer (global) clipping planes.
        renderer.localClippingEnabled = true;

        return renderer;
    } catch (error) {
        const msg = 'Failed to create WebGLRenderer';
        console.error(msg, error);
        target.appendChild(createErrorMessage());
        if (error instanceof Error) {
            throw new Error(`${msg}: ${error.message}`);
        } else {
            throw new Error(msg);
        }
    }
}

export interface RenderToBufferZone {
    /** x (in instance coordinate) */
    x: number;
    /** y (in instance coordinate) */
    y: number;
    /** width of area to render (in pixels) */
    width: number;
    /** height of area to render (in pixels) */
    height: number;
}

export interface RenderToBufferOptions {
    /** The clear color to apply before rendering. */
    clearColor?: ColorRepresentation;
    /** The scene to render. */
    scene: Object3D;
    /** The camera to render. */
    camera: Camera;
    /**
     * The type of pixels in the buffer.
     *
     * @defaultvalue `UnsignedByteType`.
     */
    datatype?: TextureDataType;
    /** partial zone to render. If undefined, the whole viewport is used. */
    zone?: RenderToBufferZone;
}

type EngineOptions = {
    clearColor?: ColorRepresentation | null;
    renderer?: WebGLRenderer | WebGLRendererParameters;
};

class C3DEngine {
    private readonly _renderTargets: Map<number, WebGLRenderTarget> = new Map();

    readonly renderer: WebGLRenderer;
    readonly labelRenderer: CSS2DRenderer;
    private _renderPipeline: RenderPipeline | null;

    width: number;
    height: number;
    renderingOptions: RenderingOptions;

    clearAlpha = 1;
    clearColor: ColorRepresentation = 0x030508;

    /**
     * @param target - The parent div that will contain the canvas.
     * @param options - The options.
     */
    constructor(target: HTMLDivElement, options?: EngineOptions) {
        registerChunks();

        this.width = target.clientWidth;
        this.height = target.clientHeight;

        if (options?.renderer instanceof WebGLRenderer) {
            this.renderer = options?.renderer;
        } else {
            this.renderer = createRenderer(target, {
                ...options?.renderer,
            });
        }

        // Don't verify shaders by default (it is very costly)
        this.renderer.debug.checkShaderErrors = false;

        this.labelRenderer = new CSS2DRenderer();

        // Let's allow our canvas to take focus
        // The condition below looks weird, but it's correct: querying tabIndex
        // returns -1 if not set, but we still need to explicitly set it to force
        // the tabindex focus flag to true (see
        // https://www.w3.org/TR/html5/editing.html#specially-focusable)
        if (this.renderer.domElement.tabIndex === -1) {
            this.renderer.domElement.tabIndex = -1;
        }

        Capabilities.updateCapabilities(this.renderer);

        let clearColor = options?.clearColor;

        if (clearColor === undefined) {
            clearColor = 0x030508;
        } else if (clearColor === null) {
            this.clearAlpha = 0;
            clearColor = 0;
        }

        this.clearColor = clearColor;
        this.renderer.setClearColor(this.clearColor, this.clearAlpha);

        this.renderer.clear();

        this.renderer.autoClear = false;

        // Finalize DOM insertion:
        // Ensure display is OK whatever the page layout is
        // - By default canvas has `display: inline-block`, which makes it affected by
        // its parent's line-height, so it will take more space than it's actual size
        // - Setting `display: block` is not enough in flex displays
        this.renderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        // Make sure labelRenderer starts a new stacking context, so the labels don't
        // stay on top of other components (e.g. inspector, etc.)
        this.labelRenderer.domElement.style.zIndex = '0';

        // Set default size
        this.renderer.setSize(this.width, this.height);
        this.labelRenderer.setSize(this.width, this.height);

        // Append renderer to the DOM
        target.appendChild(this.renderer.domElement);
        target.appendChild(this.labelRenderer.domElement);

        this._renderPipeline = null;

        this.renderingOptions = new RenderingOptions();
    }

    dispose() {
        for (const rt of this._renderTargets.values()) {
            rt.dispose();
        }
        this._renderTargets.clear();
        this.labelRenderer.domElement.remove();
        this.renderer.domElement.remove();
        this.renderer.dispose();
    }

    onWindowResize(w: number, h: number) {
        this.width = w;
        this.height = h;
        for (const rt of this._renderTargets.values()) {
            rt.setSize(this.width, this.height);
        }
        this.renderer.setSize(this.width, this.height);
        this.labelRenderer.setSize(this.width, this.height);
    }

    /**
     * Gets the viewport size, in pixels.
     *
     * @returns The viewport size, in pixels.
     */
    getWindowSize(target?: Vector2) {
        target = target ?? new Vector2();
        return target.set(this.width, this.height);
    }

    /**
     * Renders the scene.
     *
     * @param scene - The scene to render.
     * @param camera - The camera.
     */
    render(scene: Scene, camera: Camera) {
        this.renderer.setRenderTarget(null);
        const size = this.renderer.getDrawingBufferSize(tmpVec2);

        // Rendering into a zero-sized buffer is useless and will lead to WebGL warnings.
        if (size.width === 0 || size.height === 0) {
            return;
        }

        this.renderer.setClearColor(this.clearColor, this.clearAlpha);

        this.renderer.clear();

        if (requiresCustomPipeline(this.renderingOptions)) {
            this.renderUsingCustomPipeline(scene, camera);
        } else {
            this.renderer.render(scene, camera);
        }

        this.labelRenderer.render(scene, camera);
    }

    /**
     * Use a custom pipeline when post-processing is required.
     *
     * @param scene - The scene to render.
     * @param camera - The camera.
     */
    renderUsingCustomPipeline(scene: Object3D, camera: Camera) {
        if (!this._renderPipeline) {
            this._renderPipeline = new RenderPipeline(this.renderer);
        }

        this._renderPipeline.render(scene, camera, this.width, this.height, this.renderingOptions);
    }

    private acquireRenderTarget(datatype: TextureDataType) {
        let renderTarget = this._renderTargets.get(datatype);

        if (!renderTarget) {
            const newRenderTarget = createRenderTarget(
                this.width,
                this.height,
                datatype,
                this.renderer,
            );
            this._renderTargets.set(datatype, newRenderTarget);
            renderTarget = newRenderTarget;
        }

        return renderTarget;
    }

    /**
     * Renders the scene into a readable buffer.
     *
     * @param options - Options.
     * @returns The buffer. The first pixel in the buffer is the bottom-left pixel.
     */
    renderToBuffer(options: RenderToBufferOptions): Uint8Array | Float32Array {
        const zone = options.zone || {
            x: 0,
            y: 0,
            width: this.width,
            height: this.height,
        };

        const { scene, camera } = options;

        if (options.clearColor != null) {
            this.renderer.setClearColor(options.clearColor, 1);
        }

        const datatype = options.datatype ?? UnsignedByteType;

        const renderTarget = this.acquireRenderTarget(datatype);
        this.renderToRenderTarget(scene, camera, renderTarget, zone);

        // Restore previous value
        this.renderer.setClearColor(this.clearColor, this.clearAlpha);

        zone.x = Math.max(0, Math.min(zone.x, this.width));
        zone.y = Math.max(0, Math.min(zone.y, this.height));

        const size = 4 * zone.width * zone.height;
        const pixelBuffer =
            datatype === UnsignedByteType ? new Uint8Array(size) : new Float32Array(size);
        this.renderer.readRenderTargetPixels(
            renderTarget,
            zone.x,
            this.height - (zone.y + zone.height),
            zone.width,
            zone.height,
            pixelBuffer,
        );

        return pixelBuffer;
    }

    /**
     * Render the scene to a render target.
     *
     * @param scene - The scene root.
     * @param camera - The camera to render.
     * @param target - destination render target. Default value: full size
     * render target owned by C3DEngine.
     * @param zone - partial zone to render (zone x/y uses canvas coordinates)
     * Note: target must contain complete zone
     * @returns the destination render target
     */
    private renderToRenderTarget(
        scene: Object3D,
        camera: Camera,
        target: WebGLRenderTarget,
        zone: RenderToBufferZone,
    ): WebGLRenderTarget {
        if (target == null) {
            target = this.acquireRenderTarget(UnsignedByteType);
        }

        const current = this.renderer.getRenderTarget();

        // Don't use setViewport / setScissor on renderer because they would affect
        // on screen rendering as well. Instead set them on the render target.
        target.viewport.set(0, 0, target.width, target.height);
        if (zone != null) {
            target.scissor.set(
                Math.max(0, zone.x),
                Math.max(target.height - (zone.y + zone.height)),
                zone.width,
                zone.height,
            );
            target.scissorTest = true;
        }

        this.renderer.setRenderTarget(target);
        this.renderer.clear();
        this.renderer.render(scene, camera);
        this.renderer.setRenderTarget(current);

        target.scissorTest = false;
        return target;
    }

    /**
     * Converts the pixel buffer into an image element.
     *
     * @param pixelBuffer - The 8-bit RGBA buffer.
     * @param width - The width of the buffer, in pixels.
     * @param height - The height of the buffer, in pixels.
     * @returns The image.
     */
    static bufferToImage(
        pixelBuffer: ArrayLike<number>,
        width: number,
        height: number,
    ): HTMLImageElement {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('could not acquire 2D rendering context on canvas');
        }

        // size the canvas to your desired image
        canvas.width = width;
        canvas.height = height;

        const imgData = ctx.getImageData(0, 0, width, height);
        imgData.data.set(pixelBuffer);

        ctx.putImageData(imgData, 0, 0);

        // create a new img object
        const image = new Image();

        // set the img.src to the canvas data url
        image.src = canvas.toDataURL();

        return image;
    }
}

export default C3DEngine;
