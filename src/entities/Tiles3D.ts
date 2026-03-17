/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { LRUCache, PriorityQueue, Tile, TilesRendererEventMap } from '3d-tiles-renderer';
import type { ColorRepresentation, Material, Object3D } from 'three';

import { TilesRenderer } from '3d-tiles-renderer';
import {
    DebugTilesPlugin,
    GLTFExtensionsPlugin,
    ImplicitTilingPlugin,
    UnloadTilesPlugin,
} from '3d-tiles-renderer/plugins';
import { Box3, Color, REVISION, Vector3 } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

import type ColorimetryOptions from '../core/ColorimetryOptions';
import type Context from '../core/Context';
import type Instance from '../core/Instance';
import type ColorLayer from '../core/layer/ColorLayer';
import type HasLayers from '../core/layer/HasLayers';
import type Layer from '../core/layer/Layer';
import type { LayerNode } from '../core/layer/Layer';
import type Pickable from '../core/picking/Pickable';
import type { PointsPickResult } from '../core/picking/PickPointsAt';
import type PickResult from '../core/picking/PickResult';
import type {
    Classification,
    Mode,
    Mode as PointCloudMaterialMode,
} from '../renderer/PointCloudMaterial';
import type PointCloudParameters from './3dtiles/PointCloudParameters';
import type { EntityPreprocessOptions, EntityUserData } from './Entity';
import type { Entity3DOptions, Entity3DEventMap } from './Entity3D';

import { defaultColorimetryOptions } from '../core/ColorimetryOptions';
import ColorMap from '../core/ColorMap';
import Extent from '../core/geographic/Extent';
import { getGeometryMemoryUsage, type GetMemoryUsageContext } from '../core/MemoryUsage';
import PointCloudMaterial, { ASPRS_CLASSIFICATIONS, MODE } from '../renderer/PointCloudMaterial';
import { isBufferGeometry, isObject3D } from '../utils/predicates';
import { nonNull } from '../utils/tsutils';
import FetchPlugin from './3dtiles/FetchPlugin';
import {
    DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING,
    type PointCloudBatchTableAttributeMapping,
    type WellKnown3DTilesPointCloudAttributes,
} from './3dtiles/PointCloudParameters';
import PointCloudPlugin, { isPNTSScene } from './3dtiles/PointCloudPlugin';
import Entity3D from './Entity3D';

export {
    DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING,
    type PointCloudBatchTableAttributeMapping,
    type WellKnown3DTilesPointCloudAttributes,
};

type Listener<T> = (args: T & object) => void;

/**
 * Constructor options for the {@link Tiles3D} entity.
 */
export interface Tiles3DOptions extends Entity3DOptions {
    /**
     * The URL to the root tileset.
     * Might be `undefined` if the URL is provided externally (for example by the `GoogleCloudAuthPlugin`)
     */
    url?: string;

    /**
     * The path to the DRACO library files.
     * @defaultValue `'https://unpkg.com/three@0.${REVISION}.0/examples/jsm/libs/draco/gltf/'`
     */
    dracoDecoderPath?: string;

    /**
     * The path to the KTX2 library files.
     * @defaultValue `'https://unpkg.com/three@0.${REVISION}.0/examples/jsm/libs/basis/'`
     */
    ktx2DecoderPath?: string;

    /**
     * The display mode for point clouds.
     * Note: only applies to point cloud tiles.
     * @defaultValue color
     */
    pointCloudMode?: Mode;

    /**
     * The mapping between well-known attributes of point cloud geometries and attributes in the batch table.
     * @defaultValue {@link DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING}
     */
    pointCloudAttributeMapping?: PointCloudBatchTableAttributeMapping;

    /**
     * The point size for point clouds.
     * Note: only applies to point cloud tiles.
     * @defaultValue automatic size computation
     */
    pointSize?: number;

    /**
     * The colormap used for point cloud coloring.
     * Note: only applies to point cloud tiles.
     */
    colorMap?: ColorMap;

    /**
     * The error target that drives tile subdivision.
     * @defaultValue 8
     */
    errorTarget?: number;

    /**
     * The classifications for point clouds.
     * Note: only applies to point cloud tiles.
     *
     * @defaultValue {@link ASPRS_CLASSIFICATIONS}
     */
    classifications?: Classification[];

    /**
     * Whether to enable the default fetch plugin to route tile requests using Giro3D's internal
     * Fetcher.
     * @defaultValue true
     */
    enableFetchPlugin?: boolean;
}

const tmpBox3 = new Box3();
const tmpVector = new Vector3();

export function isLayerNode(obj: object): obj is LayerNode {
    if (obj == null) {
        return false;
    }

    if ('material' in obj && PointCloudMaterial.isPointCloudMaterial(obj.material)) {
        return true;
    }

    return false;
}

/**
 * Types of results for picking on {@link Tiles3D}.
 *
 * If Tiles3D uses {@link PointCloudMaterial}, then results will be of {@link PointsPickResult}.
 * Otherwise, they will be of {@link PickResult}.
 */
export type Tiles3DPickResult = PointsPickResult | PickResult;

export interface Tiles3DEventMap extends Entity3DEventMap {
    /** Fires when a layer is added to the entity. */
    'layer-added': { layer: Layer };
    /** Fires when a layer is removed from the entity. */
    'layer-removed': { layer: Layer };
}

interface SharedResources {
    downloadQueue: PriorityQueue;
    parseQueue: PriorityQueue;
    lruCache: LRUCache;
}

const perInstanceSharedResources: Map<Instance, SharedResources> = new Map();

function getSharedResources(instance: Instance): SharedResources | null {
    return perInstanceSharedResources.get(instance) ?? null;
}

function setSharedResources(instance: Instance, resources: SharedResources): void {
    if (perInstanceSharedResources.has(instance)) {
        return;
    }

    perInstanceSharedResources.set(instance, resources);

    instance.addEventListener('dispose', e => perInstanceSharedResources.delete(e.target));
}

interface ObjectOptions {
    castShadow: boolean;
    receiveShadow: boolean;
}

/**
 * Displays a [3D Tiles Tileset](https://www.ogc.org/publications/standard/3dtiles/). This entity
 * uses the [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS) package.
 *
 * Note: shadow maps are supported, but require vertex normals on displayed objects, which
 * depends on the data. Many tilesets do not have vertex normals, as they increase the
 * size of the dataset.
 */
class Tiles3D<UserData extends EntityUserData = EntityUserData>
    extends Entity3D<Tiles3DEventMap, UserData>
    implements Pickable<Tiles3DPickResult>, HasLayers
{
    public override readonly isPickable = true as const;
    public readonly hasLayers = true as const;
    public readonly isTiles3D = true as const;
    public override readonly type = 'Tiles3D';

    private readonly _debugPlugin: DebugTilesPlugin;
    private readonly _pointCloudPlugin: PointCloudPlugin;
    private readonly _tiles: TilesRenderer;
    private readonly _ktx2Loader: KTX2Loader;

    private readonly _debugOptions = {
        displayBoxBounds: false,
        displaySphereBounds: false,
        displayRegionBounds: false,
    };

    // Settings that only applies to point cloud tiles
    private readonly _pointCloudParameters: PointCloudParameters = {
        pointSize: 0, // Automatic size
        pointCloudMode: MODE.COLOR,
        colorimetry: defaultColorimetryOptions(),
        overlayColor: null,
        attributeMapping: DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING,
        pointCloudColorMap: new ColorMap({
            colors: [new Color('black'), new Color('white')],
            min: 0,
            max: 100,
        }),
        classifications: ASPRS_CLASSIFICATIONS.map(c => c.clone()),
    };

    private readonly _objectOptions: ObjectOptions = {
        castShadow: false,
        receiveShadow: false,
    };

    private readonly _listeners: {
        onModelLoaded: Listener<object>;
        onColorMapUpdated: Listener<unknown>;
        onTileVisibilityChanged: Listener<{ scene: Object3D; tile: Tile; visible: boolean }>;
        onTileDisposed: Listener<{ scene: Object3D; tile: Tile }>;
    };

    private _colorLayer: ColorLayer | null = null;

    public constructor(options?: Tiles3DOptions) {
        super(options);

        this._tiles = new TilesRenderer(options?.url);

        this._tiles.errorTarget = options?.errorTarget ?? 8;
        this.object3d.add(this._tiles.group);

        this._listeners = {
            onModelLoaded: this.onModelLoaded.bind(this),
            onTileVisibilityChanged: this.onTileVisibilityChanged.bind(this),
            onColorMapUpdated: this.onColorMapUpdated.bind(this),
            onTileDisposed: this.onTileDisposed.bind(this),
        };

        this._tiles.addEventListener('load-model', this._listeners.onModelLoaded);
        this._tiles.addEventListener(
            'tile-visibility-change',
            this._listeners.onTileVisibilityChanged,
        );
        this._tiles.addEventListener('dispose-model', this._listeners.onTileDisposed);

        this._debugPlugin = new DebugTilesPlugin();
        this._tiles.registerPlugin(this._debugPlugin);
        this.updateDebugPluginState();
        this._tiles.registerPlugin(new ImplicitTilingPlugin());
        this._tiles.registerPlugin(new UnloadTilesPlugin({ delay: 5000, bytesTarget: +Infinity }));

        // Giro3D specific plugins
        this._pointCloudPlugin = new PointCloudPlugin(this._pointCloudParameters);
        this._tiles.registerPlugin(this._pointCloudPlugin);
        const enableFetchPlugin = options?.enableFetchPlugin ?? true;
        if (enableFetchPlugin) {
            this._tiles.registerPlugin(new FetchPlugin());
        }

        const dracoLoader = new DRACOLoader(this._tiles.manager).setDecoderPath(
            options?.dracoDecoderPath ??
                `https://unpkg.com/three@0.${REVISION}.0/examples/jsm/libs/draco/gltf/`,
        );

        const ktxLoader = new KTX2Loader(this._tiles.manager).setTranscoderPath(
            options?.ktx2DecoderPath ??
                `https://unpkg.com/three@0.${REVISION}.0/examples/jsm/libs/basis/`,
        );

        this._ktx2Loader = ktxLoader;

        this._tiles.registerPlugin(
            new GLTFExtensionsPlugin({
                dracoLoader,
                ktxLoader,
                meshoptDecoder: MeshoptDecoder,
            }),
        );

        this._pointCloudParameters.pointCloudMode =
            options?.pointCloudMode ?? this._pointCloudParameters.pointCloudMode;
        this._pointCloudParameters.pointSize =
            options?.pointSize ?? this._pointCloudParameters.pointSize;
        this._pointCloudParameters.pointCloudColorMap =
            options?.colorMap ?? this._pointCloudParameters.pointCloudColorMap;
        this._pointCloudParameters.classifications =
            options?.classifications ?? this._pointCloudParameters.classifications;
        this._pointCloudParameters.attributeMapping =
            options?.pointCloudAttributeMapping ?? this._pointCloudParameters.attributeMapping;

        this._pointCloudParameters.pointCloudColorMap.addEventListener(
            'updated',
            this._listeners.onColorMapUpdated,
        );
    }

    /**
     * Returns the underlying renderer.
     */
    public get tiles(): TilesRenderer {
        return this._tiles;
    }

    public override onRenderingContextRestored(): void {
        this.forEachLayer(layer => layer.onRenderingContextRestored());
        this.instance.notifyChange(this);
    }

    public override getBoundingBox(): Box3 | null {
        const box = new Box3();
        this._tiles.getBoundingBox(box);

        return box;
    }

    public override getMemoryUsage(context: GetMemoryUsageContext): void {
        this.traverse(obj => {
            if ('geometry' in obj && isBufferGeometry(obj.geometry)) {
                getGeometryMemoryUsage(context, obj.geometry);
            }
        });

        if (this.layerCount > 0) {
            this.forEachLayer(layer => {
                layer.getMemoryUsage(context);
            });
        }
    }

    public override get loading(): boolean {
        return this.tiles.loadProgress !== 1 || (this._colorLayer?.loading ?? false);
    }

    public override get progress(): number {
        let sum = this.tiles.loadProgress;
        let count = 1;
        if (this._colorLayer) {
            sum += this._colorLayer.progress;
            count = 2;
        }
        return sum / count;
    }

    private updateObjectOption<K extends keyof ObjectOptions>(
        key: K,
        value: ObjectOptions[K],
    ): void {
        if (this._objectOptions[key] !== value) {
            this._objectOptions[key] = value;
            this.traverse(o => this.updateObject(o));
            this.notifyChange(this);
        }
    }

    /**
     * Toggles the `.castShadow` property on objects generated by this entity.
     *
     * Note: shadow maps require normal attributes on objects.
     */
    public get castShadow(): boolean {
        return this._objectOptions.castShadow;
    }

    public set castShadow(v: boolean) {
        this.updateObjectOption('castShadow', v);
    }

    /**
     * Toggles the `.receiveShadow` property on objects generated by this entity.
     *
     * Note: shadow maps require normal attributes on objects.
     */
    public get receiveShadow(): boolean {
        return this._objectOptions.receiveShadow;
    }

    public set receiveShadow(v: boolean) {
        this.updateObjectOption('receiveShadow', v);
    }

    public getLayers(predicate?: (arg0: Layer) => boolean): Layer[] {
        if (this._colorLayer) {
            if (typeof predicate != 'function' || predicate(this._colorLayer)) {
                return [this._colorLayer];
            }
        }

        return [];
    }

    public forEachLayer(callback: (layer: Layer) => void): void {
        if (this._colorLayer) {
            callback(this._colorLayer);
        }
    }

    public removeColorLayer(): void {
        if (this._colorLayer) {
            this.dispatchEvent({ type: 'layer-removed', layer: this._colorLayer });
            this.traverse(obj => {
                if (isLayerNode(obj)) {
                    this._colorLayer?.unregisterNode(obj);
                }
            });
            this._colorLayer = null;
        }
    }

    /**
     * Sets the color layer used to colorize tiles.
     * Note: this feature only works with point cloud tiles.
     */
    public async setColorLayer(layer: ColorLayer): Promise<void> {
        if (this._colorLayer) {
            this.removeColorLayer();
        }
        this._colorLayer = layer;
        await layer.initialize({
            instance: this.instance,
            composerProjection: this.instance.coordinateSystem,
        });
        this.dispatchEvent({ type: 'layer-removed', layer });
    }

    public get layerCount(): number {
        if (this._colorLayer) {
            return 1;
        }
        return 0;
    }

    public override updateOpacity(): void {
        this.traverseMaterials(material => {
            this.setMaterialOpacity(material);
        });
    }

    protected override preprocess(opts: EntityPreprocessOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            const instance = opts.instance;

            // Share resources between instances
            const shared = getSharedResources(instance);

            if (shared) {
                this._tiles.lruCache = shared.lruCache;
                this._tiles.downloadQueue = shared.downloadQueue;
                this._tiles.parseQueue = shared.parseQueue;
            } else {
                const toShare: SharedResources = {
                    lruCache: this._tiles.lruCache,
                    downloadQueue: this._tiles.downloadQueue,
                    parseQueue: this._tiles.parseQueue,
                };

                setSharedResources(instance, toShare);
            }

            const handlers = {
                success: (): void => {
                    this._tiles.removeEventListener('load-content', handlers.success);
                    this._tiles.removeEventListener('load-error', handlers.error);
                    // The two next lines became necessary starting with
                    // 3d-tile-renderer v0.4.8 but the actual reason is unclear.
                    this._tiles.update();
                    this.notifyChange(this);
                    resolve();
                },
                error: (error: TilesRendererEventMap['load-error']): void => {
                    this._tiles.removeEventListener('load-content', handlers.success);
                    this._tiles.removeEventListener('load-error', handlers.error);
                    reject(error);
                },
            };
            this._tiles.addEventListener('load-content', handlers.success);
            this._tiles.addEventListener('load-error', handlers.error);

            const camera = instance.view.camera;
            if (this._tiles.hasCamera(camera) === false) {
                this._tiles.setCamera(camera);
                this._tiles.setResolutionFromRenderer(camera, instance.renderer);
            }

            this._ktx2Loader.detectSupport(instance.renderer);

            this._tiles.update();

            this.notifyChange(this);
        });
    }

    public override preUpdate(context: Context): unknown[] | null {
        if (this.frozen || !this.visible) {
            return null;
        }

        const camera = context.view.camera;

        this._tiles.setResolutionFromRenderer(camera, this.instance.renderer);
        this._tiles.update();

        return null;
    }

    public override postUpdate(context: Context): void {
        if (this.frozen || !this.visible) {
            return;
        }

        this.traverse(obj => {
            if (obj.visible) {
                this.updateCameraDistances(context, obj);

                if ('material' in obj && PointCloudMaterial.isPointCloudMaterial(obj.material)) {
                    this._pointCloudPlugin.updateMaterial(obj.material);

                    if (isLayerNode(obj)) {
                        this.prepareLayerNode(obj);
                        this.forEachLayer(layer => layer.update(context, obj));
                    }
                }
            }
        });

        this.forEachLayer(layer => layer.postUpdate());
    }

    /**
     * Calculate and set the material opacity, taking into account this entity opacity and the
     * original opacity of the object.
     *
     * @param material - a material belonging to an object of this entity
     */
    protected setMaterialOpacity(material: Material): void {
        material.opacity = this.opacity * material.userData.originalOpacity;
        const currentTransparent = material.transparent;
        material.transparent = material.opacity < 1.0;
        material.needsUpdate = currentTransparent !== material.transparent;
    }

    private onColorMapUpdated(): void {
        this.traversePointCloudMaterials(m => m.updateUniforms());
    }

    public get errorTarget(): number {
        return this._tiles.errorTarget;
    }

    public set errorTarget(v: number) {
        if (this._tiles.errorTarget !== v) {
            this._tiles.errorTarget = v;
            this.notifyChange(this);
        }
    }

    /**
     * Gets or sets the size of points. Only applies to point cloud tiles.
     */
    public get pointSize(): number {
        return this._pointCloudParameters.pointSize;
    }

    public set pointSize(v: number) {
        if (this._pointCloudParameters.pointSize !== v) {
            this._pointCloudParameters.pointSize = v;
            this.traversePointCloudMaterials(m => {
                m.size = v;
            });
            this.notifyChange(this);
        }
    }

    /**
     * Gets or sets display mode of point clouds. Only applies to point cloud tiles.
     */
    public get pointCloudMode(): PointCloudMaterialMode {
        return this._pointCloudParameters.pointCloudMode;
    }

    public set pointCloudMode(v: PointCloudMaterialMode) {
        if (this._pointCloudParameters.pointCloudMode !== v) {
            this._pointCloudParameters.pointCloudMode = v;
            this.traversePointCloudMaterials(m => (m.mode = v));
            this.notifyChange(this);
        }
    }

    /**
     * Gets or sets the default color of point clouds. Only applies to point cloud tiles.
     */
    public get pointCloudColor(): Color | null {
        return this._pointCloudParameters.overlayColor;
    }

    public set pointCloudColor(v: ColorRepresentation | null) {
        const color = v != null ? new Color(v) : new Color();

        if (
            v == null ||
            this._pointCloudParameters.overlayColor == null ||
            !this._pointCloudParameters.overlayColor.equals(color)
        ) {
            this._pointCloudParameters.overlayColor = color;
            this.notifyChange(this);
        }
    }

    /**
     * Gets or sets the point cloud brightness, contrast and saturation. Only applies to point cloud tiles.
     */
    public get pointCloudColorimetryOptions(): ColorimetryOptions {
        return this._pointCloudParameters.colorimetry;
    }

    public set pointCloudColorimetryOptions(v: ColorimetryOptions) {
        if (this._pointCloudParameters.colorimetry !== v) {
            this._pointCloudParameters.colorimetry = v;
            this.traversePointCloudMaterials(m => {
                m.brightness = v.brightness;
                m.contrast = v.contrast;
                m.saturation = v.saturation;
            });
            this.notifyChange(this);
        }
    }

    /**
     * Gets the classifications for point clouds. Only applies to point cloud tiles.
     */
    public get pointCloudClassifications(): Classification[] {
        return this._pointCloudParameters.classifications;
    }

    /**
     * Gets the colormap used for point clouds. Only applies to point cloud tiles.
     */
    public get colorMap(): ColorMap {
        return this._pointCloudParameters.pointCloudColorMap;
    }

    private traversePointCloudMaterials(callback: (m: PointCloudMaterial) => void): void {
        this.traverseMaterials(m => {
            if (PointCloudMaterial.isPointCloudMaterial(m)) {
                callback(m);
            }
        });
    }

    private setDebugParam<K extends keyof DebugTilesPlugin>(
        key: K,
        value: DebugTilesPlugin[K],
    ): void {
        // This plugin has a severe performance cost until it can be disabled at runtime
        // See https://github.com/NASA-AMMOS/3DTilesRendererJS/issues/647
        let plugin = this._tiles.getPluginByName('DEBUG_TILES_PLUGIN') as DebugTilesPlugin;
        if (plugin == null) {
            plugin = new DebugTilesPlugin();
            this._tiles.registerPlugin(plugin);
        }
        if (plugin != null && plugin[key] !== value) {
            plugin[key] = value;
            this.notifyChange(this);
        }

        this.updateDebugPluginState();
    }

    private updateDebugPluginState(): void {
        this._debugPlugin.enabled =
            this._debugOptions.displayBoxBounds ||
            this._debugOptions.displayRegionBounds ||
            this._debugOptions.displaySphereBounds;
    }

    /**
     * Toggles the display of box volumes.
     */
    public get displayBoxBounds(): boolean {
        return this._debugOptions.displayBoxBounds;
    }

    public set displayBoxBounds(v: boolean) {
        if (this._debugOptions.displayBoxBounds !== v) {
            this._debugOptions.displayBoxBounds = v;
            this.setDebugParam('displayBoxBounds', v);
        }
    }

    /**
     * Toggles the display of sphere volumes.
     */
    public get displaySphereBounds(): boolean {
        return this._debugOptions.displaySphereBounds;
    }

    public set displaySphereBounds(v: boolean) {
        if (this._debugOptions.displaySphereBounds !== v) {
            this._debugOptions.displaySphereBounds = v;
            this.setDebugParam('displaySphereBounds', v);
        }
    }

    /**
     * Toggles the display of region volumes.
     */
    public get displayRegionBounds(): boolean {
        return this._debugOptions.displayRegionBounds;
    }

    public set displayRegionBounds(v: boolean) {
        if (this._debugOptions.displayRegionBounds !== v) {
            this._debugOptions.displayRegionBounds = v;
            this.setDebugParam('displayRegionBounds', v);
        }
    }

    /**
     * Prepares the object so that it can receive a color layer.
     */
    private prepareLayerNode(node: LayerNode): void {
        if (node.visible && node.userData.extent == null) {
            const localBox = node.userData.boundingBox as Box3;
            const worldBox = localBox.clone().applyMatrix4(node.matrixWorld);
            const extent = Extent.fromBox3(this.instance.coordinateSystem, worldBox);
            node.userData.extent = extent;
        }
    }

    private onTileDisposed(e: { scene: Object3D; tile: Tile }): void {
        const { scene } = e;

        if (this.layerCount !== 0 && isLayerNode(scene)) {
            this.forEachLayer(layer => layer.unregisterNode(scene));
        }

        this.notifyChange(this);
    }

    private onTileVisibilityChanged(e: { scene: Object3D; tile: Tile; visible: boolean }): void {
        const { scene, visible } = e;

        if (this.layerCount !== 0 && isLayerNode(scene)) {
            if (visible && scene.userData.extent == null) {
                this.prepareLayerNode(scene);
            }

            // We have to unregister the node when the tile becomes invisible
            // because currently, the library does not delete invisible tiles
            // See https://github.com/NASA-AMMOS/3DTilesRendererJS/pull/874
            // for a future plugin that will actually unload the tiles.
            if (!visible) {
                this.forEachLayer(layer => layer.unregisterNode(scene));
            }
            scene.dispatchEvent({ type: 'visibility-changed' });
        }

        if (visible) {
            this.updateMaterial(scene);
        }

        this.notifyChange(this);
    }

    private updateMaterial(scene: Object3D): void {
        this.traverseMaterials(m => this.setupMaterial(m), scene);

        if (isPNTSScene(scene)) {
            this._pointCloudPlugin.updateMaterial(scene.material as PointCloudMaterial);
        }
    }

    private updateObject(obj: Object3D): void {
        const opts = this._objectOptions;

        // Note that for object to actually cast/receive shadows, they *must*
        // have a normal attribute set. This is not really documented anywhere
        // in the three.js documentation. "flat shading" is not sufficient,
        // as normals from flat shading are computed directly in the shader,
        // which is ignored by the actual shader used for shadows.
        obj.castShadow = opts.castShadow;
        obj.receiveShadow = opts.receiveShadow;
    }

    private onModelLoaded(e: unknown): void {
        if (typeof e === 'object' && e != null && 'scene' in e && isObject3D(e.scene)) {
            this.onObjectCreated(e.scene as Object3D);
            e.scene.traverse(o => this.updateObject(o));
            this.updateMaterial(e.scene);
            this.notifyChange(this);
        }
    }

    protected override setupMaterial(material: Material): void {
        material.clippingPlanes = this.clippingPlanes;
        // this object can already be transparent with opacity < 1.0
        // we need to honor it, even when we change the whole entity's opacity
        if (material.userData.originalOpacity == null) {
            material.userData.originalOpacity = material.opacity;
        }
        this.setMaterialOpacity(material);
    }

    private updateCameraDistances(context: Context, obj: Object3D): void {
        const plane = context.distance.plane;

        if (obj.visible && 'geometry' in obj && isBufferGeometry(obj.geometry)) {
            const geometry = obj.geometry;

            if (geometry.boundingBox == null) {
                geometry.computeBoundingBox();
            }

            // Note: this algorithm is exactly the same as the one used by the map
            // TODO We might want to extract it and commonalize.
            // https://gitlab.com/giro3d/giro3d/-/issues/540
            const bbox = tmpBox3.copy(nonNull(geometry.boundingBox)).applyMatrix4(obj.matrixWorld);

            const distance = plane.distanceToPoint(bbox.getCenter(tmpVector));
            const radius = bbox.getSize(tmpVector).length() * 0.5;

            this._distance.min = Math.min(this._distance.min, distance - radius);
            this._distance.max = Math.max(this._distance.max, distance + radius);
        }
    }

    public override dispose(): void {
        this._tiles.removeEventListener('load-model', this._listeners.onModelLoaded);
        this._tiles.removeEventListener(
            'tile-visibility-change',
            this._listeners.onTileVisibilityChanged,
        );
        this._tiles.removeEventListener('dispose-model', this._listeners.onTileDisposed);
        this._pointCloudParameters.pointCloudColorMap.removeEventListener(
            'updated',
            this._listeners.onColorMapUpdated,
        );
        this._tiles.dispose();
    }
}

export default Tiles3D;
