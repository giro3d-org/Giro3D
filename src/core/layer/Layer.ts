/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    Color,
    type ColorRepresentation,
    EventDispatcher,
    LinearFilter,
    type MagnificationTextureFilter,
    type Material,
    MathUtils,
    type MinificationTextureFilter,
    type Object3D,
    type Object3DEventMap,
    type PixelFormat,
    type RenderTargetOptions,
    type Texture,
    type TextureDataType,
    UnsignedByteType,
    Vector2,
    type WebGLRenderTarget,
} from 'three';

import type RenderingContextHandler from '../../renderer/RenderingContextHandler';
import type ImageSource from '../../sources/ImageSource';
import type ColorMap from '../ColorMap';
import type Context from '../Context';
import type Disposable from '../Disposable';
import type ElevationRange from '../ElevationRange';
import type Coordinates from '../geographic/Coordinates';
import type CoordinateSystem from '../geographic/CoordinateSystem';
import type { GridExtent } from '../geographic/Extent';
import type Instance from '../Instance';
import type MemoryUsage from '../MemoryUsage';
import type OffsetScale from '../OffsetScale';
import type Progress from '../Progress';
import type RequestQueue from '../RequestQueue';
import type ColorLayer from './ColorLayer';
import type NoDataOptions from './NoDataOptions';

import MemoryTracker from '../../renderer/MemoryTracker';
import { GlobalRenderTargetPool } from '../../renderer/RenderTargetPool';
import { type ImageResult, isImageSource } from '../../sources/ImageSource';
import PromiseUtils, { PromiseStatus } from '../../utils/PromiseUtils';
import TextureGenerator from '../../utils/TextureGenerator';
import { nonNull } from '../../utils/tsutils';
import Extent from '../geographic/Extent';
import { type GetMemoryUsageContext } from '../MemoryUsage';
import OperationCounter from '../OperationCounter';
import { DefaultQueue } from '../RequestQueue';
import Shared from '../Shared';
import Interpretation from './Interpretation';
import LayerComposer from './LayerComposer';

export interface TextureAndPitch {
    texture: Texture;
    pitch: OffsetScale;
}

const tmpDims = new Vector2();

/**
 * Events for nodes.
 */
export interface LayerNodeEventMap extends Object3DEventMap {
    dispose: unknown;
    'visibility-changed': unknown;
}

/**
 * A node material.
 */
export interface LayerNodeMaterial extends Material {
    setColorTextures(layer: ColorLayer, textureAndPitch: TextureAndPitch): void;
    setLayerVisibility(layer: ColorLayer, visible: boolean): void;
    setLayerOpacity(layer: ColorLayer, opacity: number): void;
    setLayerElevationRange(layer: ColorLayer, range: ElevationRange | null): void;
    setColorimetry(
        layer: ColorLayer,
        brightness: number,
        contrast: number,
        saturation: number,
    ): void;
    hasColorLayer(layer: ColorLayer): boolean;
    indexOfColorLayer(layer: ColorLayer): number;
    removeColorLayer(layer: ColorLayer): void;
    pushColorLayer(layer: ColorLayer, extent: Extent): void;
}

/**
 * Represents an object that can be painted by this layer.
 * Nodes might be map tiles or anything else that matches the interface definition.
 */
export interface LayerNode extends Object3D<LayerNodeEventMap> {
    /**
     * Is this node disposed ?
     */
    disposed: boolean;
    /**
     * The node material.
     */
    material: LayerNodeMaterial;
    /**
     * The node texture size, in pixels.
     */
    textureSize: Vector2;
    /**
     * Gets whether this node can accept a color layer texture.
     */
    canProcessColorLayer(): boolean;
    /**
     * The node's extent.
     */
    getExtent(): Extent;
    /**
     * The LOD or depth level of this node in the hierarchy (the root node is level zero).
     */
    lod: number;
}

enum TargetState {
    Pending = 0,
    Processing = 1,
    Complete = 2,
}

function shouldCancel(node: LayerNode): boolean {
    if (node.disposed) {
        return true;
    }

    if (node.parent == null || node.material == null) {
        return true;
    }

    return !node.material.visible;
}

export class Target implements MemoryUsage {
    public readonly isMemoryUsage = true as const;
    public node: LayerNode;
    public pitch: OffsetScale;
    public extent: Extent;
    public width: number;
    public height: number;
    public renderTarget: Shared<WebGLRenderTarget, this> | null = null;
    public imageIds: Set<string>;
    public controller: AbortController;
    public state: TargetState;
    public textureIsFinal: boolean;
    public geometryExtent: Extent;
    public paintCount = 0;
    private _disposed = false;
    private _onVisibilityChanged: () => void;

    public isDisposed(): boolean {
        return this.node.disposed || this._disposed;
    }

    public getMemoryUsage(context: GetMemoryUsageContext): void {
        if (this.renderTarget && this.renderTarget.owner === this) {
            return TextureGenerator.getMemoryUsage(context, this.renderTarget.object);
        }
    }

    public constructor(options: {
        node: LayerNode;
        extent: Extent;
        geometryExtent: Extent;
        pitch: OffsetScale;
        width: number;
        height: number;
    }) {
        this.node = options.node;
        this.pitch = options.pitch;
        this.extent = options.extent;
        this.geometryExtent = options.geometryExtent;
        this.width = options.width;
        this.height = options.height;
        this.imageIds = new Set();
        this.controller = new AbortController();
        this.state = TargetState.Pending;
        this.textureIsFinal = false;

        this._onVisibilityChanged = this.onVisibilityChanged.bind(this);

        this.node.addEventListener('visibility-changed', this._onVisibilityChanged);
    }

    public dispose(): void {
        this._disposed = true;
        this.node.removeEventListener('visibility-changed', this._onVisibilityChanged);
        this.abort();
    }

    private onVisibilityChanged(): void {
        if (shouldCancel(this.node)) {
            // If the node became invisible before we could complete the processing, cancel it.
            if (this.state !== TargetState.Complete) {
                this.abort();
                this.state = TargetState.Pending;
            }
        }
    }

    public reset(): void {
        this.abort();
        this.state = TargetState.Pending;
        this.imageIds.clear();
    }

    public abort(): void {
        this.controller.abort(PromiseUtils.abortError());
        this.controller = new AbortController();
    }

    public abortAndThrow(): void {
        const signal = this.controller.signal;
        this.abort();
        signal.throwIfAborted();
    }
}

interface FetchImagesOptions {
    /** The request extent. */
    extent: Extent;
    /** The request width, in pixels. */
    width: number;
    /** The request height, in pixels. */
    height: number;
    /** The target of the images. */
    target: Target;
}

export interface LayerEvents {
    /**
     * Fires when layer visibility changes.
     */
    'visible-property-changed': { visible: boolean };
    /**
     * Fires when the layer is disposed.
     */
    dispose: unknown;
    /**
     * Fires when a node has been completed.
     */
    'node-complete': { node: LayerNode };
}

export interface LayerOptions {
    /**
     * An optional name for this layer.
     */
    name?: string;
    /**
     * The source of the layer.
     */
    source: ImageSource;
    /**
     * The optional extent to use for this layer. If none is provided, then the extent from the
     * source is used instead. The layer will not be visible outside this extent.
     */
    extent?: Extent;
    /**
     * How to interpret the pixel data of the source.
     */
    interpretation?: Interpretation;
    /**
     * Displays the border of source images.
     */
    showTileBorders?: boolean;
    /**
     * Displays empty textures as colored rectangles.
     */
    showEmptyTextures?: boolean;
    /**
     * How to treat no-data values.
     */
    noDataOptions?: NoDataOptions;
    /**
     * Enables min/max computation of source images. Mainly used for elevation data.
     */
    computeMinMax?: boolean;
    /**
     * The optional color map to use.
     */
    colorMap?: ColorMap;
    /**
     * Enables or disable preloading of low resolution fallback images. Those fallback images
     * are used when no data is available yet on a particular region of the layer.
     */
    preloadImages?: boolean;
    /**
     * The optional background color of the layer.
     */
    backgroundColor?: ColorRepresentation;
    /**
     * The resolution factor applied to textures generated by this layer, compared to the pixel size
     * of the targets. Default is `1`. A value greater than one will create textures with a higher
     * resolution than what is asked by the targets. For example, if a map tile has a texture size
     * of 256\*256, and a layer has a resolution factor of 2, the generated textures will have a
     * size of 512\*512 pixels.
     */
    resolutionFactor?: number;
    /**
     * The optional texture filter for minification.
     * @defaultValue Generally bilinear filtering, but some sources might provide different defaults.
     */
    minFilter?: MinificationTextureFilter;
    /**
     * The optional texture filter for magnification.
     * @defaultValue Generally bilinear filtering, but some sources might provide different defaults.
     */
    magFilter?: MagnificationTextureFilter;
}

export type LayerUserData = Record<string, unknown>;

/**
 * Base class of layers. Layers are components of maps or any compatible entity.
 *
 * The same layer can be added to multiple entities. Don't forget to call {@link dispose} when the
 * layer should be destroyed, as removing a layer from an entity will not release memory associated
 * with the layer (such as textures).
 *
 * ## Layer nodes
 *
 * Layers generate textures to be applied to {@link LayerNode | nodes}. Nodes might be map tiles, point
 * cloud tiles or any object that matches the definition of the interface.
 *
 * ## Types of layers
 *
 * `Layer` is an abstract class. See subclasses for specific information. Main subclasses:
 *
 * - `ColorLayer` for color information, such as satellite imagery, vector data, etc.
 * - `ElevationLayer` for elevation and terrain data.
 * - `MaskLayer`: a special kind of layer that applies a mask on its host map.
 *
 * ## The `userData` property
 *
 * The `userData` property can be used to attach custom data to the layer, in a type safe manner.
 * It is recommended to use this property instead of attaching arbitrary properties to the object:
 *
 * ```ts
 * type MyCustomUserData = {
 *   creationDate: Date;
 *   owner: string;
 * };
 * const newLayer = new ColorLayer<MyCustomUserData>({ ... });
 *
 * newLayer.userData.creationDate = Date.now();
 * newLayer.userData.owner = 'John Doe';
 * ```
 *
 * ## Reprojection capabilities
 *
 * When the {@link source} of the layer has a different coordinate system (CRS) than the instance,
 * the images from the source will be reprojected to the instance CRS.
 *
 * Note that doing so will have a performance cost in both CPU and memory.
 *
 * ```js
 * // Add and create a new Layer to an existing map.
 * const newLayer = new ColorLayer({ ... });
 *
 * await map.addLayer(newLayer);
 *
 * // Change layer's visibilty
 * newLayer.visible = false;
 * instance.notifyChange(); // update instance
 *
 * // Change layer's opacity
 * newLayer.opacity = 0.5;
 * instance.notifyChange(); // update instance
 *
 * // Listen to properties
 * newLayer.addEventListener('visible-property-changed', (event) => console.log(event));
 * ```
 * @typeParam TEvents - The event map of the layer.
 * @typeParam TUserData - The type of the `userData` property.
 */
abstract class Layer<
    TEvents extends LayerEvents = LayerEvents,
    TUserData extends LayerUserData = LayerUserData,
>
    extends EventDispatcher<TEvents & LayerEvents>
    implements Progress, MemoryUsage, RenderingContextHandler, Disposable
{
    public readonly isMemoryUsage = true as const;

    /**
     * Optional name of this layer.
     */
    public readonly name: string | undefined;
    /**
     * The unique identifier of this layer.
     */
    public readonly id: string;
    /**
     * Read-only flag to check if a given object is of type Layer.
     */
    public readonly isLayer: boolean = true;
    public type: string;
    public readonly interpretation: Interpretation;
    public readonly showTileBorders: boolean;
    public readonly showEmptyTextures: boolean;
    public readonly noDataOptions: NoDataOptions;
    public readonly computeMinMax: boolean;
    private _visible: boolean;
    /** The colormap of this layer */
    public readonly colorMap: ColorMap | null = null;
    /** The extent of this layer */
    public readonly extent: Extent | null = null;
    /** The source of this layer */
    public readonly source: ImageSource;
    /** @internal */
    protected _composer: LayerComposer | null = null;
    private readonly _targets: Map<number, Target>;
    private readonly _targetsToDestroy: Target[] = [];
    private readonly _filter: (id: string) => boolean;
    /** @internal */
    protected readonly _queue: RequestQueue;
    private readonly _opCounter: OperationCounter;
    private _sortedTargets: Target[] | null = null;
    private _instance: Instance | null = null;
    private _composerProjection: CoordinateSystem | null = null;
    private readonly _createReadableTextures: boolean;
    private readonly _preloadImages: boolean;
    private readonly _minFilter?: MinificationTextureFilter;
    private readonly _magFilter?: MagnificationTextureFilter;
    private _fallbackImagesPromise: Promise<void> | null;
    /** The resolution factor applied to the textures generated by this layer. */
    public readonly resolutionFactor: number;
    private _preprocessOnce: Promise<this> | null = null;
    private _onNodeDisposed: (options: { target: LayerNode }) => void;
    private _ready = false;

    public backgroundColor: Color;

    /**
     * An object that can be used to store custom data about the {@link Layer}.
     */
    public readonly userData: TUserData;

    /**
     * Disables automatic updates of this layer. Useful for debugging purposes.
     */
    public frozen = false;

    public get ready(): boolean {
        return this._ready;
    }

    public getMemoryUsage(context: GetMemoryUsageContext): void {
        this._targets.forEach(target => target.getMemoryUsage(context));

        if (this.composer) {
            this.composer.getMemoryUsage(context);
        }

        this.source.getMemoryUsage(context);
    }

    /**
     * Creates a layer.
     *
     * @param options - The layer options.
     */
    public constructor(options: LayerOptions) {
        super();
        this.name = options.name;

        // @ts-expect-error {} is not assignable to TUserData in the case when the initial
        // value is not provided. However, we have no way to initialize the userData to a
        // correct default value. Instead of assigning to null/undefined, the compromise is
        // to assign to the empty object.
        this.userData = {};

        this._onNodeDisposed = (e): void => this.unregisterNode(e.target);

        // We need a globally unique ID for this layer, to avoid collisions in the request queue.
        this.id = MathUtils.generateUUID();

        this.type = 'Layer';
        this._minFilter = options.minFilter;
        this._magFilter = options.magFilter;
        this.interpretation = options.interpretation ?? Interpretation.Raw;
        this.showTileBorders = options.showTileBorders ?? false;
        this.showEmptyTextures = options.showEmptyTextures ?? false;

        this._preloadImages = options.preloadImages ?? false;
        this._fallbackImagesPromise = null;

        this.noDataOptions = options.noDataOptions ?? { replaceNoData: false };
        this.computeMinMax = options.computeMinMax ?? false;
        this._createReadableTextures = this.computeMinMax != null && this.computeMinMax !== false;
        this._visible = true;

        this.colorMap = options.colorMap ?? null;

        this.extent = options.extent ?? null;
        this.resolutionFactor = options.resolutionFactor ?? 1;

        if (options.source == null || !isImageSource(options.source)) {
            throw new Error('missing or invalid source');
        }
        this.source = options.source;

        this.source.addEventListener('updated', ({ extent }) => this.onSourceUpdated(extent));

        this.backgroundColor = new Color(options.backgroundColor);

        this._targets = new Map();

        // We only fetch images that we don't already have.
        this._filter = (imageId: string): boolean => !nonNull(this._composer).has(imageId);

        this._queue = DefaultQueue;

        this._opCounter = new OperationCounter();
        this._sortedTargets = null;
    }

    private shouldCancelRequest(node: LayerNode): boolean {
        return shouldCancel(node);
    }

    private onSourceUpdated(extent?: Extent): void {
        this.clear(extent);
    }

    public onRenderingContextLost(): void {
        /* Nothing to do */
    }

    public onRenderingContextRestored(): void {
        this.clear();
    }

    /**
     * Resets all render targets to a blank state and repaint all the targets.
     * @param extent - An optional extent to limit the region to clear.
     */
    public clear(extent?: Extent): void {
        if (!this.ready) {
            return;
        }

        nonNull(this._composer).clear(extent);

        this._fallbackImagesPromise = null;

        const reset = (): void => {
            for (const target of this._targets.values()) {
                if (!extent || extent.intersectsExtent(target.extent)) {
                    target.reset();
                }
            }

            this.instance.notifyChange(this, { immediate: true });
        };

        if (this._preloadImages) {
            this.loadFallbackImages().then(reset);
        } else {
            reset();
        }
    }

    /**
     * Gets or sets the visibility of this layer.
     */
    public get visible(): boolean {
        return this._visible;
    }

    public set visible(v: boolean) {
        if (this._visible !== v) {
            this._visible = v;
            this.dispatchEvent({ type: 'visible-property-changed', visible: v });
            this._targets.forEach(t => this.updateMaterial(t.node.material));
        }
    }

    public get loading(): boolean {
        return this._opCounter.loading;
    }

    public get progress(): number {
        return this._opCounter.progress;
    }

    /**
     * Initializes this layer. Note: this method is automatically called when the layer is added
     * to an entity.
     *
     * @param options - Initialization options.
     * @returns A promise that resolves when the initialization is complete.
     * @internal
     */
    public initialize(options: {
        /**
         * The instance to associate this layer.
         * Once set, the layer cannot be used with any other instance.
         */
        instance: Instance;
        composerProjection: CoordinateSystem;
    }): Promise<this> {
        const { instance } = options;
        if (this._instance != null && instance !== this._instance) {
            throw new Error('This layer has already been initialized for another instance.');
        }

        this._instance = instance;
        this._composerProjection = options.composerProjection;

        if (this.extent && !this.extent.crs.equals(this._composerProjection)) {
            throw new Error(
                `the extent of the layer was defined in a different CRS (${this.extent.crs.id}) than the composer projection (${this._composerProjection.id}). Please convert the extent to the proper CRS before creating the layer.`,
            );
        }

        if (!this._preprocessOnce) {
            this._preprocessOnce = this.initializeOnce().then(() => {
                this._ready = true;
                return this;
            });
        }

        return this._preprocessOnce;
    }

    protected get instance(): Instance {
        return nonNull(this._instance, 'This layer is not initialized');
    }

    /**
     * Perform the initialization. This should be called exactly once in the lifetime of the layer.
     */
    private async initializeOnce(): Promise<this> {
        this._opCounter.increment();
        const targetProjection = nonNull(this._composerProjection);

        try {
            await this.source.initialize({
                targetProjection,
            });

            this._composer = new LayerComposer({
                transparent: this.source.transparent,
                renderer: this.instance.renderer,
                showImageOutlines: this.showTileBorders,
                showEmptyTextures: this.showEmptyTextures,
                extent: this.extent ?? undefined,
                dimensions: this.getExtent()?.dimensions(),
                computeMinMax: this.computeMinMax,
                sourceCrs: this.source.getCrs(),
                targetCrs: targetProjection,
                interpretation: this.interpretation,
                fillNoData: this.noDataOptions.replaceNoData,
                fillNoDataAlphaReplacement: this.noDataOptions.alpha,
                fillNoDataRadius: this.noDataOptions.maxSearchDistance,
                textureDataType: this.getRenderTargetDataType(),
                pixelFormat: this.getRenderTargetPixelFormat(),
                minFilter: this._minFilter,
                magFilter: this._magFilter,
            });

            if (this._preloadImages) {
                await this.loadFallbackImages();
            }

            this.instance.notifyChange(this);
        } finally {
            this._opCounter.decrement();
        }

        return this;
    }

    /**
     * Returns the final extent of this layer. If this layer has its own extent defined,
     * this will be used.
     * Otherwise, will return the source extent (if any).
     * May return undefined if not pre-processed yet.
     *
     * @returns The layer final extent.
     */
    public getExtent(): Extent | undefined {
        // We are interested in the projected CRS, not the cartesian one, if any.
        const crs = nonNull(this._composerProjection);

        // The layer extent takes precedence over the source extent,
        // since it maye be used for some cropping effect.
        return this.extent ?? this.source.getExtent()?.clone()?.as(crs);
    }

    public async loadFallbackImagesInternal(): Promise<void> {
        const extent = this.getExtent();

        // If neither the source nor the layer are able to provide an extent,
        // we cannot reliably fetch fallback images.
        if (!extent) {
            return;
        }
        const width = 512 * this.resolutionFactor;
        const dims = extent.dimensions();
        const height = width * (dims.y / dims.x);

        const extentAsSourceCrs = extent.clone().as(this.source.getCrs());
        const requests = this.source.getImages({
            id: 'background',
            extent: extentAsSourceCrs,
            width,
            height,
            createReadableTextures: this._createReadableTextures,
        });

        const promises = requests.map(img => img.request());

        this._opCounter.increment();

        const results = await Promise.allSettled(promises);

        this._opCounter.decrement();

        for (const result of results) {
            if (result.status === PromiseStatus.Fullfilled) {
                const image = (result as PromiseFulfilledResult<ImageResult>).value;

                this.addToComposer(image, true);
            }
        }

        await this.onInitialized();
    }

    protected onTextureCreated(texture: Texture): void {
        // Interpretation color space have a higher precedence.
        texture.colorSpace = this.interpretation.colorSpace ?? this.source.colorSpace;
    }

    private addToComposer(image: ImageResult, alwaysVisible: boolean): void {
        this.onTextureCreated(image.texture);

        nonNull(this._composer).add({
            alwaysVisible, // Ensures background images are never deleted
            flipY: this.source.flipY,
            ...image,
        });
    }

    public async loadFallbackImages(): Promise<void> {
        if (!this._preloadImages) {
            return;
        }

        if (!this._fallbackImagesPromise) {
            // Let's fetch a low resolution image to fill tiles until we have a better resolution.
            this._fallbackImagesPromise = this.loadFallbackImagesInternal();
        }

        await this._fallbackImagesPromise;
    }

    /**
     * Called when the layer has finished initializing.
     */
    protected async onInitialized(): Promise<void> {
        // Implemented in derived classes.
    }

    private fetchImagesSync(options: FetchImagesOptions): void {
        const { extent, width, height, target } = options;

        const node = target.node;

        const results = this.source.getImages({
            id: `${target.node.id}`,
            extent: extent.clone().as(this.source.getCrs()),
            width,
            height,
            signal: target.controller.signal,
            createReadableTextures: this._createReadableTextures,
        });

        if (results.length === 0) {
            // No new image to generate
            return;
        }

        // Register the ids on the tile
        results.forEach(r => {
            target.imageIds.add(r.id);
        });

        if (this.shouldCancelRequest(node)) {
            target.abortAndThrow();
        }

        const composer = nonNull(this._composer);

        for (const { id, request } of results) {
            if (request == null || composer.has(id)) {
                continue;
            }

            try {
                const image = request() as ImageResult;

                this.addToComposer(image, false);
                if (!this.shouldCancelRequest(node)) {
                    composer.lock(id, node.id);
                }
            } catch (e) {
                if (e instanceof Error && e.name !== 'AbortError') {
                    console.error(e);
                }
            }
        }
    }

    private getExtentAsSourceCRS(extent: Extent): Extent {
        const clone = extent.clone();
        if (clone.crs.isEpsg(4326)) {
            // Keep extent in correct domain
            clone.intersect(Extent.WGS84);
        }
        return clone.as(this.source.getCrs());
    }

    /**
     * @param options - Options.
     * @returns A promise that is settled when all images have been fetched.
     */
    private async fetchImages(options: FetchImagesOptions): Promise<void> {
        const { extent, width, height, target } = options;

        const node = target.node;

        const results = this.source.getImages({
            id: `${target.node.id}`,
            extent: this.getExtentAsSourceCRS(extent),
            width,
            height,
            signal: target.controller.signal,
            createReadableTextures: this._createReadableTextures,
        });

        if (results.length === 0) {
            // No new image to generate
            return;
        }

        // Register the ids on the tile
        results.forEach(r => {
            target.imageIds.add(r.id);
        });

        if (this.shouldCancelRequest(node)) {
            target.abortAndThrow();
        }

        const allImages = [];

        const composer = nonNull(this._composer);

        for (const { id, request } of results) {
            if (request == null || composer.has(id)) {
                continue;
            }

            // More recent requests should be served first.
            const priority = performance.now();
            const shouldExecute = (): boolean => node.visible && this._filter(id);

            this._opCounter.increment();

            const requestId = `${this.id}-${id}`;

            const p = this._queue
                .enqueue({
                    id: requestId,
                    request: request as () => Promise<ImageResult>,
                    priority,
                    shouldExecute,
                })
                .then((image: ImageResult) => {
                    this.addToComposer(image, false);
                    if (!this.shouldCancelRequest(node)) {
                        composer.lock(id, node.id);
                    }
                })
                .catch(e => {
                    if (e.name !== 'AbortError') {
                        console.error(e);
                    }
                })
                .finally(() => {
                    this._opCounter.decrement();
                });

            allImages.push(p);
        }

        await Promise.allSettled(allImages);
    }

    private destroyTarget(target: Target): void {
        const node = target.node;
        target.renderTarget?.dispose();
        this._targets.delete(node.id);
        nonNull(this._composer).unlock(target.imageIds, node.id);
        target.dispose();
        this._sortedTargets = null;
    }

    /**
     * Removes the node from this layer.
     *
     * @param node - The disposed node.
     */
    public unregisterNode(node: LayerNode, immediate = false): void {
        const id = node.id;
        const target = this._targets.get(id);
        node.removeEventListener('dispose', this._onNodeDisposed);

        if (target) {
            if (immediate) {
                this.destroyTarget(target);
            } else {
                this._targetsToDestroy.push(target);
            }
        }
    }

    protected adjustExtent(extent: Extent): Extent {
        return extent;
    }

    /**
     * Adjusts the extent to avoid visual artifacts.
     *
     * @param originalExtent - The original extent.
     * @param originalWidth - The width, in pixels, of the original extent.
     * @param originalHeight - The height, in pixels, of the original extent.
     * @returns And object containing the adjusted extent, as well as adjusted pixel size.
     */
    protected adjustExtentAndPixelSize(
        originalExtent: Extent,
        originalWidth: number,
        originalHeight: number,
    ): GridExtent {
        // This feature only makes sense if both the source and composer
        //  have the same CRS, meaning that pixels can be aligned.
        if (this.source.getCrs() === this._composerProjection) {
            // Let's ask the source if it can help us have a pixel-perfect extent
            const sourceAdjusted = this.source.adjustExtentAndPixelSize(
                originalExtent,
                originalWidth,
                originalHeight,
                2,
            );

            if (sourceAdjusted) {
                return sourceAdjusted;
            }
        }

        // Tough luck, the source does not implement this feature. Let's use a default
        // implementation: add a 5% margin to eliminate visual artifacts at the edges of tiles,
        // such as color bleeding in atlas textures and hillshading issues with elevation data.
        const margin = 0.05;
        const pixelMargin = 4;
        const marginExtent = originalExtent.withRelativeMargin(margin);

        // Should we crop the extent ?
        const adjustedExtent = this.adjustExtent(marginExtent);
        const width = originalWidth + pixelMargin * 2;
        const height = originalHeight + pixelMargin * 2;

        return { extent: adjustedExtent, width, height };
    }

    /**
     * @returns Targets sorted by extent dimension.
     */
    private getSortedTargets(): Target[] {
        if (this._sortedTargets == null) {
            this._sortedTargets = Array.from(this._targets.values()).sort((a, b) => {
                const ax = a.extent.dimensions(tmpDims).x;
                const bx = b.extent.dimensions(tmpDims).x;
                return ax - bx;
            });
        }

        return this._sortedTargets;
    }

    /**
     * Get the pixels colors of this layer at coordinate.
     * This will samples all pixel colors within a square region of specified size, centered at the given coordinate.
     * Returns undefined if no non-transparent (colored) pixels are found, or if no texture is available for this coordinate.
     *
     * Note: only 8-bit layers are supported. If the layer has non 8-bit pixels, returns `undefined`.
     * @returns The colors
     */
    public getPixel(params: {
        /**
         * The coordinate to sample.
         */
        coordinates: Coordinates;
        /**
         * The size, in pixels, of the square to sample
         * @defaultValue 1
         */
        size?: number;
    }): Color[] | undefined {
        const coordinates = params.coordinates.as(this.instance.coordinateSystem);

        if (this.source.datatype !== UnsignedByteType) {
            return undefined;
        }

        const smallestTargetAtCoordinates = this.getSortedTargets().find(target =>
            target.extent.isPointInside(coordinates),
        );

        if (!smallestTargetAtCoordinates || !smallestTargetAtCoordinates.renderTarget) {
            return undefined;
        }

        const uv = smallestTargetAtCoordinates.extent.offsetInExtent(coordinates, tmpDims);

        const size = params.size ?? 1;
        const pixels = new Uint8ClampedArray(size * size * 4);

        this.instance.renderer.readRenderTargetPixels(
            smallestTargetAtCoordinates.renderTarget.object,
            smallestTargetAtCoordinates.width * uv.x,
            smallestTargetAtCoordinates.height * uv.y,
            size,
            size,
            pixels,
        );

        if (pixels.reduce((sum, value) => sum + value) > 0) {
            const colors = [];
            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i] / 255;
                const g = pixels[i + 1] / 255;
                const b = pixels[i + 2] / 255;
                const color = new Color(r, g, b);
                colors.push(color);
            }

            return colors;
        } else {
            return undefined;
        }
    }

    /**
     * Returns the first ancestor that is completely loaded, or null if not found.
     * @param target - The target.
     * @returns The smallest target that still contains this extent.
     */
    private getLoadedAncestor(target: Target): Target | null {
        const extent = target.geometryExtent;
        const targets = this.getSortedTargets();
        for (const t of targets) {
            const otherExtent = t.geometryExtent;
            if (
                t !== target &&
                extent.isInside(otherExtent, 0.00000001) &&
                t.state === TargetState.Complete &&
                t.renderTarget != null
            ) {
                return t;
            }
        }

        return null;
    }

    private getLoadedDirectChildren(target: Target): Target[] | null {
        const extent = target.geometryExtent;
        const targets = this.getSortedTargets();
        const childLod = target.node.lod + 1;
        const result: Target[] = [];

        for (const t of targets) {
            const otherExtent = t.geometryExtent;
            if (
                t.node.lod === childLod &&
                extent.contains(otherExtent, 0.00000001) &&
                t.state === TargetState.Complete &&
                t.renderTarget != null
            ) {
                result.push(t);
            }
        }

        if (result.length > 0) {
            return result;
        }
        return null;
    }

    private borrowTextureFromAncestor(target: Target, onApplied: () => void): boolean {
        const parent = this.getLoadedAncestor(target);

        if (parent) {
            // Borrow  texture from parent
            const parentTarget = nonNull(parent.renderTarget);

            // We have already borrowed it
            if (target.renderTarget && target.renderTarget.owner === parent) {
                return true;
            }

            onApplied();

            // Important note: we are not here disposing the texture itself, just
            // one instance of the shared ownership of the texture. This texture might
            // belong to another tile.
            target.renderTarget?.dispose();
            // Here we are cloning the shared object rather than the texture.
            target.renderTarget = parentTarget.clone();

            const pitch = target.extent.offsetToParent(parent.extent).combine(target.pitch);
            const texture = target.renderTarget.object.texture;

            this.applyTextureToNode({ texture, pitch }, target, false);

            return true;
        }

        return false;
    }

    private borrowTexturesFromChildren(target: Target, onApplied: () => void): boolean {
        const children = this.getLoadedDirectChildren(target);

        if (children) {
            this.createRenderTargetIfNecessary(target);
            const renderTarget = nonNull(target.renderTarget).object;
            const composer = nonNull(this._composer);

            const imagesToBorrow = children.map(c => ({
                texture: nonNull(c.renderTarget).object.texture,
                extent: c.extent,
                renderOrder: 1,
            }));

            // If we don't have enough children to fill the tile,
            // let's also use an ancestor image, but with a lower render order
            // so that it does not cover the child images.
            if (children.length < 4) {
                const ancestor = this.getLoadedAncestor(target);
                if (ancestor) {
                    imagesToBorrow.push({
                        extent: ancestor.extent,
                        texture: nonNull(ancestor.renderTarget).object.texture,
                        renderOrder: 0,
                    });
                }
            }

            composer.copy({
                dest: renderTarget,
                targetExtent: target.extent,
                source: imagesToBorrow,
            });

            const texture = renderTarget.texture;
            const pitch = target.pitch;

            this.applyTextureToNode({ texture, pitch }, target, false);

            onApplied();

            return true;
        }

        return false;
    }

    private generateDefaultTextureFromExistingComposerImages(
        target: Target,
        onApplied: () => void,
    ): void {
        this.createRenderTargetIfNecessary(target);

        const composer = nonNull(this._composer);
        const renderTarget = nonNull(target.renderTarget).object;

        // We didn't find any parent nor child, use whatever is present in the composer.
        composer.render({
            extent: target.extent,
            width: target.width,
            height: target.height,
            target: renderTarget,
            imageIds: target.imageIds,
            isFallbackMode: true,
        });

        const texture = renderTarget.texture;
        const pitch = target.pitch;

        this.applyTextureToNode({ texture, pitch }, target, false);

        onApplied();
    }

    /**
     * Immediately applies a temporary texture to the target while
     * the actual texture is being asynchronously processed, to
     * avoid displaying a black texture.
     */
    protected applyInterimTexture(target: Target): void {
        if (target.isDisposed()) {
            return;
        }

        const onApplied = (): void => {
            // Ensure that the material is up to date with the default texture
            this.updateMaterial(target.node.material);
            this.instance.notifyChange(this);
            target.paintCount++;
        };

        // The first step is too look for children of this target.
        // If they (still) exist, it means that this target becomes
        // visible in stead of its children (aka a "zoom out" in a 2D map),
        // and so we want to reuse the textures from the children.
        if (!this.borrowTexturesFromChildren(target, onApplied)) {
            // Next, we wan to see if an ancestor has a texture we can use.
            // This is typically the case when we are subdividing a tile (aka a "zoom in").
            // Not here we are taking the ancestor that is the closest to the target.
            // Here we are simply reusing the texture without any other processing, meaning
            // it is very fast.
            if (!this.borrowTextureFromAncestor(target, onApplied)) {
                // Finally, this is the worst case scenario: we have to fill the
                // render target with images in the composer. It's less performant that
                // simply reusing a texture, though.
                this.generateDefaultTextureFromExistingComposerImages(target, onApplied);
            }
        }
    }

    /**
     * @internal
     */
    public getInfo(node: LayerNode): { state: string; imageCount: number; paintCount: number } {
        const target = this._targets.get(node.id);
        if (target) {
            return {
                state: TargetState[target.state],
                imageCount: target.imageIds.size,
                paintCount: target.paintCount,
            };
        }

        return { state: 'unknown', imageCount: -1, paintCount: -1 };
    }

    /**
     * Processes the target once, fetching all images relevant for this target,
     * then paints those images to the target's texture.
     *
     * @param target - The target to paint.
     */
    private processTarget(target: Target): void {
        if (target.state !== TargetState.Pending) {
            return;
        }
        const signal = target.controller.signal;

        if (signal.aborted) {
            this.setTargetState(target, TargetState.Pending);
            return;
        }

        const extent = target.extent;
        const width = target.width;
        const height = target.height;

        // Fetch adequate images from the source...
        const isContained = this.contains(extent);
        if (isContained) {
            // If the source is not synchronous, we need a default texture
            // to avoid seeing a blank texture on the tile.
            if (!this.source.synchronous) {
                // The only exception is when the texture on the target is final (e.g not a temporary texture).
                // We want to keep it as is and simply replace with another final texture.
                // This happens when the source is updated (e.g a temporal source has new data).
                // In that case we want to avoid applying a blank texture and create a very
                // nasty flickering effect.
                if (!target.textureIsFinal) {
                    this.applyInterimTexture(target);
                }
            }

            this.setTargetState(target, TargetState.Processing);

            // If the source is synchronous, the whole pipeline is also synchronous.
            if (this.source.synchronous) {
                try {
                    this.fetchImagesSync({ extent, width, height, target });
                    this.paintTarget(target);
                } catch (e) {
                    console.error(e);
                    this.setTargetState(target, TargetState.Pending);
                }
            } else {
                this.fetchImages({
                    extent,
                    width,
                    height,
                    target,
                })
                    .then(() => {
                        this.paintTarget(target);
                    })
                    .catch(err => {
                        // Abort errors are perfectly normal, so we don't need to log them.
                        // However any other error implies an abnormal termination of the processing.
                        if (err.name !== 'AbortError') {
                            console.error(err);
                            this.setTargetState(target, TargetState.Complete);
                        } else {
                            this.setTargetState(target, TargetState.Pending);
                        }
                    });
            }
        } else {
            // The layer does not overlap with this tile, let's apply an empty texture.
            this.setTargetState(target, TargetState.Complete);
            this.applyEmptyTextureToNode(target);
        }
    }

    private createRenderTargetIfNecessary(target: Target): void {
        if (!target.renderTarget || target.renderTarget.owner !== target) {
            target.renderTarget?.dispose();

            const renderTarget = this.acquireRenderTarget(target.width, target.height);

            target.renderTarget = Shared.new(renderTarget, target, obj =>
                this.releaseRenderTarget(obj),
            );
        }
    }

    private paintTarget(target: Target): void {
        if (target.isDisposed()) {
            return;
        }

        const composer = nonNull(this._composer);

        const allImagesReady = composer.hasAll(target.imageIds);

        if (!allImagesReady) {
            this.setTargetState(target, TargetState.Pending);
            return;
        }

        const extent = target.extent;
        const width = target.width;
        const height = target.height;
        const pitch = target.pitch;

        this.createRenderTargetIfNecessary(target);

        const { isLastRender } = nonNull(this._composer).render({
            extent,
            width,
            height,
            target: nonNull(target.renderTarget).object,
            imageIds: target.imageIds,
        });

        target.textureIsFinal = isLastRender;

        if (isLastRender) {
            this.setTargetState(target, TargetState.Complete);
        } else {
            this.setTargetState(target, TargetState.Pending);
        }

        target.paintCount++;

        const texture = nonNull(target.renderTarget).object.texture;
        this.applyTextureToNode({ texture, pitch }, target, isLastRender);
        this.instance.notifyChange(this);
    }

    private setTargetState(target: Target, state: TargetState): void {
        if (target.state === state) {
            return;
        }

        target.state = state;

        if (state === TargetState.Complete) {
            this.dispatchEvent({ type: 'node-complete', node: target.node });
        }
    }

    /**
     * Updates the provided node with content from this layer.
     *
     * @param context - the context
     * @param node - the node to update
     */
    public update(context: Context, node: LayerNode): void {
        if (!this.ready || !this.visible) {
            return;
        }

        const { material } = node;

        if (node.parent == null || material == null) {
            return;
        }

        // Node is hidden, no need to update it
        if (!material.visible) {
            return;
        }

        let target: Target;

        // First time we encounter this node
        if (!this._targets.has(node.id)) {
            const originalExtent = node.getExtent().clone();
            const textureSize = node.textureSize;
            // The texture that will be painted onto this node will not have the exact extent of
            // this node, to avoid problems caused by pixels sitting on the edge of the tile.
            const { extent, width, height } = this.adjustExtentAndPixelSize(
                originalExtent,
                Math.round(textureSize.x * this.resolutionFactor),
                Math.round(textureSize.y * this.resolutionFactor),
            );

            if (this.composer?.targetCrs.isEpsg(4326) === true) {
                // Ensure that no extent overflow the WGS84 domain,
                // to avoid artifacts at the 180° meridian.
                extent?.intersect(Extent.WGS84);
            }

            const pitch = originalExtent.offsetToParent(extent);

            target = new Target({
                node,
                extent,
                pitch,
                width: Math.round(width),
                height: Math.round(height),
                geometryExtent: originalExtent,
            });
            this._targets.set(node.id, target);
            this._sortedTargets = null;

            // Since the node does not own the texture for this layer, we need to be
            // notified whenever it is disposed so we can in turn dispose the texture.
            node.addEventListener('dispose', this._onNodeDisposed);
        } else {
            target = nonNull(this._targets.get(node.id));
        }

        if (target.isDisposed()) {
            return;
        }

        this.updateMaterial(material);

        // An update is pending / or impossible -> abort
        if (this.frozen || !this.visible) {
            return;
        }

        // Repaint the target if necessary.
        this.processTarget(target);
    }

    /**
     * @param extent - The extent to test.
     * @returns `true` if this layer contains the specified extent, `false` otherwise.
     */
    public contains(extent: Extent): boolean {
        const customExtent = this.extent;
        if (customExtent) {
            if (!customExtent.intersectsExtent(extent)) {
                return false;
            }
        }

        return this.source.contains(extent);
    }

    public abstract getRenderTargetPixelFormat(): PixelFormat;

    public abstract getRenderTargetDataType(): TextureDataType;

    /**
     * @param target - The render target to release.
     */
    private releaseRenderTarget(target: WebGLRenderTarget | null): void {
        if (!target) {
            return;
        }
        GlobalRenderTargetPool.release(target, this.instance.renderer);
    }

    /**
     * @param width - Width
     * @param height - Height
     * @returns The render target.
     */
    private acquireRenderTarget(width: number, height: number): WebGLRenderTarget {
        const type = this.getRenderTargetDataType();

        const minFilter = TextureGenerator.getCompatibleTextureFilter(
            this._minFilter ?? LinearFilter,
            type,
            this.instance.renderer,
        );
        const magFilter = TextureGenerator.getCompatibleTextureFilter(
            this._magFilter ?? LinearFilter,
            type,
            this.instance.renderer,
        );

        const options: RenderTargetOptions = {
            format: this.getRenderTargetPixelFormat(),
            minFilter: minFilter,
            magFilter: magFilter,
            type,
            depthBuffer: false,
            generateMipmaps: false,
        };

        const result = GlobalRenderTargetPool.acquire(
            this.instance.renderer,
            width,
            height,
            options,
        );

        result.texture.name = `Layer "${this.id} - WebGLRenderTarget`;

        MemoryTracker.track(result, `Layer "${this.id} - WebGLRenderTarget`);
        return result;
    }

    public postUpdate(): void {
        if (this._targetsToDestroy.length > 0) {
            this._targetsToDestroy.forEach(t => this.destroyTarget(t));
            this._targetsToDestroy.length = 0;
        }

        this._composer?.postUpdate();
    }

    /**
     * @internal
     */
    public get composer(): Readonly<LayerComposer | null> {
        return this._composer;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected updateMaterial(material: Material): void {
        // Implemented in derived classes
    }

    /**
     * Returns true if this layer has loaded data for this node.
     */
    public isLoaded(nodeId: LayerNode['id']): boolean {
        const target = this._targets.get(nodeId);
        if (target) {
            return target.state === TargetState.Complete;
        }
        return false;
    }

    protected abstract applyTextureToNode(
        texture: TextureAndPitch,
        target: Target,
        isLastRender: boolean,
    ): void;

    protected abstract applyEmptyTextureToNode(target: Target): void;

    /**
     * Disposes the layer. This releases all resources held by this layer.
     */
    public dispose(): void {
        this.source.dispose();
        this._composer?.dispose();
        for (const target of this._targets.values()) {
            target.abort();
            this.unregisterNode(target.node, true);
        }

        this.dispatchEvent({ type: 'dispose' });
    }
}

/**
 * Returns `true` if the given object is a {@link Layer}.
 */
export function isLayer(obj: unknown): obj is Layer {
    return typeof obj === 'object' && (obj as Layer)?.isLayer;
}

export default Layer;
