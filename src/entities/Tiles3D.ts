import type { LRUCache, PriorityQueue, Tile } from '3d-tiles-renderer';
import { TilesRenderer } from '3d-tiles-renderer';
import {
    DebugTilesPlugin,
    GLTFExtensionsPlugin,
    ImplicitTilingPlugin,
    UnloadTilesPlugin,
} from '3d-tiles-renderer/plugins';
import type { ColorRepresentation, Material, Object3D } from 'three';
import { Box3, Color, Group, REVISION, Vector3 } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import type ColorimetryOptions from '../core/ColorimetryOptions';
import { defaultColorimetryOptions } from '../core/ColorimetryOptions';
import ColorMap from '../core/ColorMap';
import type Context from '../core/Context';
import Extent from '../core/geographic/Extent';
import type ColorLayer from '../core/layer/ColorLayer';
import type HasLayers from '../core/layer/HasLayers';
import type Layer from '../core/layer/Layer';
import type { LayerNode } from '../core/layer/Layer';
import { getGeometryMemoryUsage, type GetMemoryUsageContext } from '../core/MemoryUsage';
import type Pickable from '../core/picking/Pickable';
import type { PointsPickResult } from '../core/picking/PickPointsAt';
import type PickResult from '../core/picking/PickResult';
import type {
    Classification,
    Mode,
    Mode as PointCloudMaterialMode,
} from '../renderer/PointCloudMaterial';
import PointCloudMaterial, { ASPRS_CLASSIFICATIONS, MODE } from '../renderer/PointCloudMaterial';
import { isBufferGeometry, isObject3D } from '../utils/predicates';
import { nonNull } from '../utils/tsutils';
import FetchPlugin from './3dtiles/FetchPlugin';
import type PointCloudParameters from './3dtiles/PointCloudParameters';
import PointCloudPlugin, { isPNTSScene } from './3dtiles/PointCloudPlugin';
import type { EntityPreprocessOptions, EntityUserData } from './Entity';
import type { Entity3DEventMap } from './Entity3D';
import Entity3D from './Entity3D';

type Listener<T> = (args: T & object) => void;

/** Options to create a Tiles3D object. */
export type Tiles3DOptions = {
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
};

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

const shared: {
    downloadQueue: PriorityQueue | null;
    parseQueue: PriorityQueue | null;
    lruCache: LRUCache | null;
} = {
    downloadQueue: null,
    parseQueue: null,
    lruCache: null,
};

/**
 * Displays a [3D Tiles Tileset](https://www.ogc.org/publications/standard/3dtiles/). This entity
 * uses the [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS) package.
 */
export default class Tiles3D<UserData extends EntityUserData = EntityUserData>
    extends Entity3D<Tiles3DEventMap, UserData>
    implements Pickable<Tiles3DPickResult>, HasLayers
{
    readonly isPickable = true as const;
    readonly hasLayers = true as const;
    readonly isTiles3D = true as const;
    readonly type = 'Tiles3D';

    private readonly _debugPlugin: DebugTilesPlugin;
    private readonly _fetchPlugin: FetchPlugin;
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
        pointCloudColorMap: new ColorMap({
            colors: [new Color('black'), new Color('white')],
            min: 0,
            max: 100,
        }),
        classifications: ASPRS_CLASSIFICATIONS.map(c => c.clone()),
    };

    private readonly _listeners: {
        onModelLoaded: Listener<object>;
        onColorMapUpdated: Listener<unknown>;
        onTileVisibilityChanged: Listener<{ scene: Object3D; tile: Tile; visible: boolean }>;
        onTileDisposed: Listener<{ scene: Object3D; tile: Tile }>;
    };

    private _colorLayer: ColorLayer | null = null;

    constructor(options?: Tiles3DOptions) {
        super(new Group());

        this._tiles = new TilesRenderer(options?.url);

        // Share resources between instances
        if (shared.lruCache && shared.downloadQueue && shared.parseQueue) {
            this._tiles.lruCache = shared.lruCache;
            this._tiles.downloadQueue = shared.downloadQueue;
            this._tiles.parseQueue = shared.parseQueue;
        } else {
            shared.lruCache = this._tiles.lruCache;
            shared.downloadQueue = this._tiles.downloadQueue;
            shared.parseQueue = this._tiles.parseQueue;
        }

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
        this._fetchPlugin = new FetchPlugin();
        this._pointCloudPlugin = new PointCloudPlugin(this._pointCloudParameters);
        this._tiles.registerPlugin(this._pointCloudPlugin);
        this._tiles.registerPlugin(this._fetchPlugin);

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
                // FIXME the following parameters are optional but the .d.ts file makes them mandatory
                // https://github.com/NASA-AMMOS/3DTilesRendererJS/pull/908
                metadata: true,
                rtc: true,
                autoDispose: true,
                plugins: [],
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

        this._pointCloudParameters.pointCloudColorMap.addEventListener(
            'updated',
            this._listeners.onColorMapUpdated,
        );
    }

    /**
     * Returns the underlying renderer.
     */
    get tiles(): TilesRenderer {
        return this._tiles;
    }

    onRenderingContextRestored(): void {
        this.forEachLayer(layer => layer.onRenderingContextRestored());
        this.instance.notifyChange(this);
    }

    getBoundingBox(): Box3 | null {
        const box = new Box3();
        this._tiles.getBoundingBox(box);

        return box;
    }

    getMemoryUsage(context: GetMemoryUsageContext) {
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

    get loading() {
        return this.tiles.loadProgress !== 1 || (this._colorLayer?.loading ?? false);
    }

    get progress() {
        let sum = this.tiles.loadProgress;
        let count = 1;
        if (this._colorLayer) {
            sum += this._colorLayer.progress;
            count = 2;
        }
        return sum / count;
    }

    getLayers(predicate?: (arg0: Layer) => boolean): Layer[] {
        if (this._colorLayer) {
            if (typeof predicate != 'function' || predicate(this._colorLayer)) {
                return [this._colorLayer];
            }
        }

        return [];
    }

    forEachLayer(callback: (layer: Layer) => void): void {
        if (this._colorLayer) {
            callback(this._colorLayer);
        }
    }

    removeColorLayer(): void {
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
    async setColorLayer(layer: ColorLayer): Promise<void> {
        if (this._colorLayer) {
            this.removeColorLayer();
        }
        this._colorLayer = layer;
        await layer.initialize({ instance: this.instance });
        this.dispatchEvent({ type: 'layer-removed', layer });
    }

    get layerCount(): number {
        if (this._colorLayer) {
            return 1;
        }
        return 0;
    }

    updateOpacity() {
        this.traverseMaterials(material => {
            this.setMaterialOpacity(material);
        });
    }

    protected preprocess(opts: EntityPreprocessOptions): Promise<void> {
        return new Promise(resolve => {
            const instance = opts.instance;

            // Preprocessing is done when the root tileset is loaded
            const listener = () => {
                this._tiles.removeEventListener('load-content', listener);
                resolve();
            };
            this._tiles.addEventListener('load-content', listener);

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

    preUpdate(context: Context): unknown[] | null {
        if (this.frozen || !this.visible) {
            return null;
        }

        const camera = context.view.camera;

        this._tiles.setResolutionFromRenderer(camera, this.instance.renderer);
        this._tiles.update();

        return null;
    }

    postUpdate(context: Context): void {
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
    protected setMaterialOpacity(material: Material) {
        material.opacity = this.opacity * material.userData.originalOpacity;
        const currentTransparent = material.transparent;
        material.transparent = material.opacity < 1.0;
        material.needsUpdate = currentTransparent !== material.transparent;
    }

    private onColorMapUpdated() {
        this.traversePointCloudMaterials(m => m.updateUniforms());
    }

    get errorTarget() {
        return this._tiles.errorTarget;
    }

    set errorTarget(v: number) {
        if (this._tiles.errorTarget !== v) {
            this._tiles.errorTarget = v;
            this.notifyChange(this);
        }
    }

    /**
     * Gets or sets the size of points. Only applies to point cloud tiles.
     */
    get pointSize() {
        return this._pointCloudParameters.pointSize;
    }

    set pointSize(v: number) {
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
    get pointCloudMode() {
        return this._pointCloudParameters.pointCloudMode;
    }

    set pointCloudMode(v: PointCloudMaterialMode) {
        if (this._pointCloudParameters.pointCloudMode !== v) {
            this._pointCloudParameters.pointCloudMode = v;
            this.traversePointCloudMaterials(m => (m.mode = v));
            this.notifyChange(this);
        }
    }

    /**
     * Gets or sets the default color of point clouds. Only applies to point cloud tiles.
     */
    get pointCloudColor() {
        return this._pointCloudParameters.overlayColor;
    }

    set pointCloudColor(v: ColorRepresentation | null) {
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
    get pointCloudColorimetryOptions(): ColorimetryOptions {
        return this._pointCloudParameters.colorimetry;
    }

    set pointCloudColorimetryOptions(v: ColorimetryOptions) {
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
    get pointCloudClassifications() {
        return this._pointCloudParameters.classifications;
    }

    /**
     * Gets the colormap used for point clouds. Only applies to point cloud tiles.
     */
    get colorMap() {
        return this._pointCloudParameters.pointCloudColorMap;
    }

    private traversePointCloudMaterials(callback: (m: PointCloudMaterial) => void) {
        this.traverseMaterials(m => {
            if (PointCloudMaterial.isPointCloudMaterial(m)) {
                callback(m);
            }
        });
    }

    private setDebugParam<K extends keyof DebugTilesPlugin>(key: K, value: DebugTilesPlugin[K]) {
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

    private updateDebugPluginState() {
        this._debugPlugin.enabled =
            this._debugOptions.displayBoxBounds ||
            this._debugOptions.displayRegionBounds ||
            this._debugOptions.displaySphereBounds;
    }

    /**
     * Toggles the display of box volumes.
     */
    get displayBoxBounds(): boolean {
        return this._debugOptions.displayBoxBounds;
    }

    set displayBoxBounds(v: boolean) {
        if (this._debugOptions.displayBoxBounds !== v) {
            this._debugOptions.displayBoxBounds = v;
            this.setDebugParam('displayBoxBounds', v);
        }
    }

    /**
     * Toggles the display of sphere volumes.
     */
    get displaySphereBounds(): boolean {
        return this._debugOptions.displaySphereBounds;
    }

    set displaySphereBounds(v: boolean) {
        if (this._debugOptions.displaySphereBounds !== v) {
            this._debugOptions.displaySphereBounds = v;
            this.setDebugParam('displaySphereBounds', v);
        }
    }

    /**
     * Toggles the display of region volumes.
     */
    get displayRegionBounds(): boolean {
        return this._debugOptions.displayRegionBounds;
    }

    set displayRegionBounds(v: boolean) {
        if (this._debugOptions.displayRegionBounds !== v) {
            this._debugOptions.displayRegionBounds = v;
            this.setDebugParam('displayRegionBounds', v);
        }
    }

    /**
     * Prepares the object so that it can receive a color layer.
     */
    private prepareLayerNode(node: LayerNode) {
        if (node.visible && node.userData.extent == null) {
            const localBox = node.userData.boundingBox as Box3;
            const worldBox = localBox.clone().applyMatrix4(node.matrixWorld);
            const extent = Extent.fromBox3(this.instance.referenceCrs, worldBox);
            node.userData.extent = extent;
        }
    }

    private onTileDisposed(e: { scene: Object3D; tile: Tile }) {
        const { scene } = e;

        if (this.layerCount !== 0 && isLayerNode(scene)) {
            this.forEachLayer(layer => layer.unregisterNode(scene));
        }

        this.notifyChange(this);
    }

    private onTileVisibilityChanged(e: { scene: Object3D; tile: Tile; visible: boolean }) {
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

    private updateMaterial(scene: Object3D) {
        if (isPNTSScene(scene)) {
            this._pointCloudPlugin.updateMaterial(scene.material as PointCloudMaterial);
        }
    }

    private onModelLoaded(e: unknown) {
        if (typeof e === 'object' && e != null && 'scene' in e && isObject3D(e.scene)) {
            this.onObjectCreated(e.scene as Object3D);
            this.updateMaterial(e.scene);
            this.notifyChange(this);
        }
    }

    protected setupMaterial(material: Material) {
        material.clippingPlanes = this.clippingPlanes;
        // this object can already be transparent with opacity < 1.0
        // we need to honor it, even when we change the whole entity's opacity
        if (material.userData.originalOpacity == null) {
            material.userData.originalOpacity = material.opacity;
        }
        this.setMaterialOpacity(material);
    }

    private updateCameraDistances(context: Context, obj: Object3D) {
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

    dispose(): void {
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
    }
}
