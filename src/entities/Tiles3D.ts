import type { Box3 } from 'three';
import { Group, MathUtils, Matrix4, Vector2, Vector3, type Material, type Object3D } from 'three';
import { GlobalCache } from '../core/Cache';
import type Context from '../core/Context';
import { isDisposable } from '../core/Disposable';
import type Extent from '../core/geographic/Extent';
import type ColorLayer from '../core/layer/ColorLayer';
import type HasLayers from '../core/layer/HasLayers';
import type Layer from '../core/layer/Layer';
import type { LayerEvents } from '../core/layer/Layer';
import { getGeometryMemoryUsage, type GetMemoryUsageContext } from '../core/MemoryUsage';
import OperationCounter from '../core/OperationCounter';
import type Pickable from '../core/picking/Pickable';
import pickObjectsAt from '../core/picking/PickObjectsAt';
import type PickOptions from '../core/picking/PickOptions';
import pickPointsAt, { type PointsPickResult } from '../core/picking/PickPointsAt';
import type PickResult from '../core/picking/PickResult';
import PointCloud from '../core/PointCloud';
import type RequestQueue from '../core/RequestQueue';
import { DefaultQueue } from '../core/RequestQueue';
import PointCloudMaterial from '../renderer/PointCloudMaterial';
import type Tiles3DSource from '../sources/Tiles3DSource';
import Fetcher from '../utils/Fetcher';
import { isBufferGeometry } from '../utils/predicates';
import { nonNull } from '../utils/tsutils';
import utf8Decoder from '../utils/Utf8Decoder';
import $3dTilesIndex, { type ProcessedTile } from './3dtiles/3dTilesIndex';
import $3dTilesLoader from './3dtiles/3dTilesLoader';
import {
    boundingVolumeToBox3,
    boundingVolumeToExtent,
    cullingTest,
} from './3dtiles/BoundingVolume';
import Tile from './3dtiles/Tile';
import type { $3dTilesAsset, $3dTilesTile, $3dTilesTileset } from './3dtiles/types';
import { type EntityUserData } from './Entity';
import Entity3D, { type Entity3DEventMap } from './Entity3D';

type ObjectWithExtent = Object3D & { extent: Extent };

/** Options to create a Tiles3D object. */
export interface Tiles3DOptions<TMaterial extends Material> {
    /**
     * The delay, in milliseconds, to cleanup unused objects.
     *
     * @defaultvalue 1000
     */
    cleanupDelay?: number;
    /**
     * The Screen Space Error (SSE) threshold to use for this tileset.
     *
     * @defaultvalue 16
     */
    sseThreshold?: number;
    /**
     * The optional 3d object to use as the root object of this entity.
     * If none provided, a new one will be created.
     */
    object3d?: Object3D;
    /** The optional material to use. */
    material?: TMaterial;
}

const tmpVector = new Vector3();
const tmpMatrix = new Matrix4();

// This function is used to cleanup a Object3D hierarchy.
// (no 3dtiles spectific code here because this is managed by cleanup3dTileset)
function _cleanupObject3D(n: Object3D): void {
    // all children of 'n' are raw Object3D
    for (const child of n.children) {
        _cleanupObject3D(child);
    }

    if ('dispose' in n && typeof n.dispose === 'function') {
        n.dispose();
    } else {
        // free resources
        if ('material' in n && isDisposable(n.material)) {
            n.material.dispose();
        }
        if ('geometry' in n && isDisposable(n.geometry)) {
            n.geometry.dispose();
        }
    }
    n.remove(...n.children);
}

function isTilesetContentReady(tileset: $3dTilesTile, node: Tile): boolean {
    return (
        tileset != null &&
        node != null && // is tileset loaded ?
        node.children.length === 1 && // is tileset root loaded ?
        node.children[0].children.length > 0
    );
}

/**
 * Types of results for picking on {@link Tiles3D}.
 *
 * If Tiles3D uses {@link PointCloudMaterial}, then results will be of {@link PointsPickResult}.
 * Otherwise, they will be of {@link PickResult}.
 */
export type Tiles3DPickResult = PointsPickResult | PickResult;

/**
 * A [3D Tiles](https://www.ogc.org/standards/3DTiles) dataset.
 *
 */
class Tiles3D<
        TMaterial extends Material = Material,
        UserData extends EntityUserData = EntityUserData,
    >
    extends Entity3D<Entity3DEventMap, UserData>
    implements Pickable<Tiles3DPickResult>, HasLayers
{
    readonly type = 'Tiles3D' as const;
    readonly hasLayers = true as const;
    readonly isMemoryUsage = true as const;
    /** Read-only flag to check if a given object is of type Tiles3D. */
    readonly isTiles3D = true as const;
    private readonly _url: string;
    private _networkOptions?: RequestInit;
    private _colorLayer?: ColorLayer;

    get url() {
        return this._url;
    }

    /** The Screen Space Error (SSE) threshold to use for this tileset. */
    sseThreshold: number;
    /** The delay, in milliseconds, to cleanup unused objects. */
    cleanupDelay: number;
    /** The material to use */
    material?: TMaterial;
    private _cleanableTiles: Tile[];
    private _opCounter: OperationCounter;
    private _queue: RequestQueue;
    readonly imageSize = new Vector2(128, 128);
    private _tileIndex?: $3dTilesIndex;
    private _asset?: $3dTilesAsset;
    get asset(): $3dTilesAsset {
        return nonNull(this._asset);
    }
    private _root?: Tile;
    public get root(): Tile {
        return nonNull(this._root);
    }
    private _extent?: Extent;
    wireframe?: boolean;

    /**
     * Constructs a Tiles3D object.
     *
     * @param source - The data source.
     * @param options - Optional properties.
     */
    constructor(source: Tiles3DSource, options: Tiles3DOptions<TMaterial> = {}) {
        super(options.object3d || new Group());

        if (source == null) {
            throw new Error('missing source');
        }

        if (source.url == null) {
            throw new Error('missing source.url');
        }

        this.type = 'Tiles3D';
        this._url = source.url;
        this._networkOptions = source.networkOptions;
        this.sseThreshold = options.sseThreshold ?? 16;
        this.cleanupDelay = options.cleanupDelay ?? 1000;
        this.material = options.material ?? undefined;

        this._cleanableTiles = [];

        this._opCounter = new OperationCounter();

        this._queue = DefaultQueue;
    }

    onRenderingContextRestored(): void {
        this.forEachLayer(layer => layer.onRenderingContextRestored());
        this.instance.notifyChange(this);
    }

    getBoundingBox(): Box3 | null {
        if (this._root != null) {
            return boundingVolumeToBox3(this._root.boundingVolume, this._root.matrixWorld);
        }

        return super.getBoundingBox();
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

    async attach(colorLayer: ColorLayer) {
        this._colorLayer = colorLayer;
        await colorLayer.initialize({ instance: this.instance });
    }

    get loading() {
        return this._opCounter.loading || (this._colorLayer?.loading ?? false);
    }

    get progress() {
        let sum = this._opCounter.progress;
        let count = 1;
        if (this._colorLayer) {
            sum += this._colorLayer.progress;
            count = 2;
        }
        return sum / count;
    }

    getLayers(predicate?: (arg0: Layer) => boolean): Layer<LayerEvents>[] {
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

    get layerCount(): number {
        if (this._colorLayer) {
            return 1;
        }
        return 0;
    }

    updateOpacity() {
        if (this.material) {
            // This is necessary because update() does copy the material's properties
            // to the tile's material, and we are losing any custom opacity.
            this.material.opacity = this.opacity;
            this.material.transparent = this.opacity < 1;
            // in the case we have a material for the whole entity, we can ignore the object's
            // original opacity and the Entity3D implementation is fine
            super.updateOpacity();
        } else {
            // if we *don't* have an entity-wise material, we need to be a bit more subtle and take
            // the original opacity into account
            this.traverseMaterials(material => {
                this.setMaterialOpacity(material);
            });
        }
    }

    async preprocess(): Promise<void> {
        // Download the root tileset to complete the preparation.
        const tileset = (await Fetcher.json(this._url, this._networkOptions)) as $3dTilesTileset;
        if (!tileset.root.refine) {
            tileset.root.refine = tileset.refine;
        }

        // Add a tile which acts as root of the tileset but has no content.
        // This way we can safely cleanup the root of the tileset in the processing
        // code, and keep a valid layer.root tile.
        const fakeroot: $3dTilesTile = {
            boundingVolume: tileset.root.boundingVolume,
            geometricError: tileset.geometricError * 10,
            refine: tileset.root.refine,
            transform: tileset.root.transform,
            children: [tileset.root],
        };
        // Remove transform which has been moved up to fakeroot
        tileset.root.transform = undefined;
        // Replace root
        tileset.root = fakeroot;

        const urlPrefix = this._url.slice(0, this._url.lastIndexOf('/') + 1);
        // Note: Constructing $3dTilesIndex makes tileset.root become a Tileset object !
        this._tileIndex = new $3dTilesIndex(tileset, urlPrefix);
        this._asset = tileset.asset;

        const tile = await this.requestNewTile(tileset.root as ProcessedTile);
        if (tile == null) {
            throw new Error('Could not load root tile');
        }

        this.object3d.add(tile);
        tile.updateMatrixWorld();

        nonNull(this._tileIndex).get(tile).obj = tile;
        this._root = tile;
        this._extent = boundingVolumeToExtent(
            this.instance.referenceCrs,
            tile.boundingVolume,
            tile.matrixWorld,
        );
    }

    private async requestNewTile(
        metadata: ProcessedTile,
        parent?: Tile,
    ): Promise<Tile | undefined> {
        if (metadata.obj) {
            const tileset = metadata as ProcessedTile;
            this.unmarkTileForDeletion(tileset.obj);
            this.instance.notifyChange(parent);
            return tileset.obj;
        }

        this._opCounter.increment();

        let priority;
        if (!parent || parent.additiveRefinement) {
            // Additive refinement can be done independently for each child,
            // so we can compute a per child priority
            const box = nonNull(metadata.boundingVolumeObject.box);
            const size = box
                .clone()
                .applyMatrix4(metadata.worldFromLocalTransform)
                .getSize(tmpVector);
            priority = size.x * size.y;
        } else {
            // But the 'replace' refinement needs to download all children at
            // the same time.
            // If one of the children is very small, its priority will be low,
            // and it will delay the display of its siblings.
            // So we compute a priority based on the size of the parent
            // TODO cache the computation of world bounding volume ?
            const box = nonNull(parent.boundingVolume.box);
            const size = box.clone().applyMatrix4(parent.matrixWorld).getSize(tmpVector);
            priority = size.x * size.y; // / this.tileIndex.index[parent.tileId].children.length;
        }

        const request = {
            id: MathUtils.generateUUID(),
            priority,
            shouldExecute: () => this.shouldExecute(parent),
            request: () => this.executeCommand(metadata, parent),
        };

        try {
            const node = (await this._queue.enqueue(request)) as Tile;
            metadata.obj = node;
            this.notifyChange(this);
            return node;
        } catch (e) {
            if (e instanceof Error && e.name !== 'AbortError') {
                throw e;
            }
        } finally {
            this._opCounter.decrement();
        }
    }

    preUpdate(): Tile[] {
        if (!this.visible) {
            return [];
        }

        // Elements removed are added in the this._cleanableTiles list.
        // Since we simply push in this array, the first item is always
        // the oldest one.
        const now = Date.now();
        const cleanable = this._cleanableTiles;
        const first = cleanable[0];

        if (first != null && now - (first.cleanableSince as number) > this.cleanupDelay) {
            while (cleanable.length > 0) {
                const elt = this._cleanableTiles[0];
                if (now - (elt.cleanableSince as number) > this.cleanupDelay) {
                    this.cleanup3dTileset(elt);
                } else {
                    // later entries are younger
                    break;
                }
            }
        }

        return [nonNull(this._root)];
    }

    update(context: Context, node: Tile): Tile[] | undefined {
        // Remove deleted children (?)
        node.remove(...node.children.filter(c => c.deleted));

        const parent = nonNull(node.parent);

        // early exit if parent's subdivision is in progress
        if (parent.pendingSubdivision === true && !parent.additiveRefinement) {
            node.visible = false;
            return undefined;
        }
        let returnValue;

        // do proper culling
        const isVisible = !cullingTest(context.view, node, node.matrixWorld);
        node.visible = isVisible;

        if (isVisible) {
            this.unmarkTileForDeletion(node);

            // We need distance for 2 things:
            // - subdivision testing
            // - near / far calculation in MainLoop. For this one, we need the distance for *all*
            // displayed tiles.
            // For this last reason, we need to calculate this here, and not in subdivisionControl
            node.calculateCameraDistance(context.view.camera);

            if (!this.frozen) {
                if (node.pendingSubdivision === true || this.subdivisionTest(context, node)) {
                    this.subdivideNode(context, node);
                    // display iff children aren't ready
                    if (node.additiveRefinement || node.pendingSubdivision === true) {
                        node.setDisplayed(true);
                    } else {
                        // If one of our child is a tileset, this node must be displayed until this
                        // child content is ready, to avoid hiding our content too early (= when our
                        // child is loaded but its content is not)
                        const index = nonNull(this._tileIndex);
                        const children = nonNull(index.get(node).children);
                        const subtilesets = children.filter(tile => tile.isProcessedTile);

                        if (subtilesets.length) {
                            let allReady = true;
                            for (const tileset of subtilesets) {
                                const subTilesetNode = node.children.filter(
                                    n => n.tileId === tileset.tileId,
                                )[0];
                                if (!isTilesetContentReady(tileset, subTilesetNode)) {
                                    allReady = false;
                                    break;
                                }
                            }
                            node.setDisplayed(allReady);
                        } else {
                            node.setDisplayed(true);
                        }
                    }
                    returnValue = node.getChildTiles();
                } else {
                    node.setDisplayed(true);

                    for (const n of node.getChildTiles()) {
                        n.visible = false;
                        this.markTileForDeletion(n);
                    }
                }
            } else {
                returnValue = node.getChildTiles();
            }

            // update material
            if (node.content && node.content.visible) {
                // it will therefore contribute to near / far calculation
                if (node.boundingVolume.region) {
                    throw new Error('boundingVolume.region is not yet supported');
                } else if (node.boundingVolume.box) {
                    this._distance.min = Math.min(this._distance.min, node.distance.min);
                    this._distance.max = Math.max(this._distance.max, node.distance.max);
                } else if (node.boundingVolume.sphere) {
                    this._distance.min = Math.min(this._distance.min, node.distance.min);
                    this._distance.max = Math.max(this._distance.max, node.distance.max);
                }
                node.content.traverse(o => {
                    const mesh = o as Object3D;
                    if (this.isOwned(mesh) && 'material' in mesh) {
                        const m = mesh.material as Material;
                        if ('wireframe' in m) {
                            m.wireframe = this.wireframe;
                        }
                    }
                });
                if (this.material) {
                    node.content.traverse(o => {
                        const pointcloud = o as PointCloud;
                        if (this.isOwned(pointcloud) && pointcloud.material != null) {
                            if (pointcloud.isPoints) {
                                if (
                                    PointCloudMaterial.isPointCloudMaterial(pointcloud.material) &&
                                    PointCloudMaterial.isPointCloudMaterial(this.material)
                                ) {
                                    pointcloud.material.update(this.material);
                                } else if (this.material != null) {
                                    pointcloud.material.copy(this.material);
                                }
                            }
                        }
                    });
                }
            }
        } else if (node !== this._root) {
            if (node.parent && node.parent.additiveRefinement) {
                this.markTileForDeletion(node);
            }
        }

        return returnValue;
    }

    postUpdate(context: Context): void {
        this.traverse(obj => {
            if (
                PointCloud.isPointCloud(obj) &&
                PointCloudMaterial.isPointCloudMaterial(obj.material)
            ) {
                obj.material.updateUniforms();
                this.forEachLayer(layer => layer.update(context, obj));
            }
        });

        this.forEachLayer(layer => layer.postUpdate());
    }

    protected markTileForDeletion(node: Tile) {
        if (node.cleanableSince == null) {
            node.markForDeletion();
            this._cleanableTiles.push(node);
        }
    }

    protected unmarkTileForDeletion(node: Tile | undefined) {
        if (node && node.cleanableSince != null) {
            this._cleanableTiles.splice(this._cleanableTiles.indexOf(node), 1);
            node.unmarkForDeletion();
        }
    }

    // Cleanup all 3dtiles|three.js starting from a given node n.
    // n's children can be of 2 types:
    //   - have a 'content' attribute -> it's a tileset and must
    //     be cleaned with cleanup3dTileset()
    //   - doesn't have 'content' -> it's a raw Object3D object,
    //     and must be cleaned with _cleanupObject3D()
    protected cleanup3dTileset(n: Tile, depth = 0): void {
        this.unmarkTileForDeletion(n);

        const tileset = nonNull(this._tileIndex).get(n);

        if (tileset.obj) {
            tileset.obj.deleted = Date.now();
            tileset.obj = undefined;
        }

        // clean children tiles recursively
        for (const child of n.getChildTiles()) {
            this.cleanup3dTileset(child, depth + 1);
            n.remove(child);
        }

        if (n.content) {
            // clean content
            n.content.traverse(_cleanupObject3D);
            n.remove(n.content);
            delete n.content;
        }

        if ('dispose' in n && typeof n.dispose === 'function') {
            n.dispose();
        }

        // and finally remove from parent
        // if (depth === 0 && n.parent) {
        //     n.parent.remove(n);
        // }
    }

    protected subdivisionTest(context: Context, node: Tile): boolean {
        const tileset = nonNull(this._tileIndex).get(node);
        if (tileset.children === undefined) {
            return false;
        }
        if (tileset.isProcessedTile) {
            return true;
        }

        const sse = node.computeNodeSSE(context.view);
        node.sse = sse;

        return sse > this.sseThreshold;
    }

    protected subdivideNodeAdditive(context: Context, node: Tile): void {
        const children = nonNull(nonNull(this._tileIndex).get(node).children);

        for (const child of children) {
            // child being downloaded or already added => skip
            if (child.promise || node.children.filter(n => n.tileId === child.tileId).length > 0) {
                continue;
            }

            // 'child' is only metadata (it's *not* a Object3D). 'cullingTest' needs
            // a matrixWorld, so we compute it: it's node's matrixWorld x child's transform
            let overrideMatrixWorld = node.matrixWorld;
            if (child.transformMatrix != null) {
                overrideMatrixWorld = tmpMatrix.multiplyMatrices(
                    node.matrixWorld,
                    child.transformMatrix,
                );
            }

            const isVisible = !cullingTest(context.view, child, overrideMatrixWorld);

            // child is not visible => skip
            if (!isVisible) {
                continue;
            }

            child.promise = this.requestNewTile(child, node)
                .then(tile => {
                    if (!tile || !node.parent) {
                        // cancelled promise or node has been deleted
                    } else {
                        node.add(tile);
                        tile.updateMatrixWorld();

                        const extent = boundingVolumeToExtent(
                            nonNull(this._extent).crs,
                            tile.boundingVolume,
                            tile.matrixWorld,
                        );
                        tile.traverse(obj => {
                            (obj as ObjectWithExtent).extent = extent;
                        });

                        this.notifyChange(child);
                    }
                })
                .catch(e => {
                    console.error('Cannot subdivide node', node, e);
                })
                .finally(() => delete child.promise);
        }
    }

    protected subdivideNodeSubstractive(node: Tile): void {
        // Subdivision in progress => nothing to do
        if (node.pendingSubdivision === true) {
            return;
        }

        if (node.getChildTiles().length > 0) {
            return;
        }

        const index = nonNull(this._tileIndex);

        // No child => nothing to do either
        const childrenTiles = index.get(node).children;
        if (childrenTiles === undefined || childrenTiles.length === 0) {
            return;
        }

        node.pendingSubdivision = true;

        // Substractive (refine = 'REPLACE') is an all or nothing subdivision mode
        const promises: Promise<void>[] = [];
        for (const child of childrenTiles) {
            const p = this.requestNewTile(child, node)
                .then(tile => {
                    if (!tile || !node.parent) {
                        // cancelled promise or node has been deleted
                    } else {
                        node.add(tile);
                        tile.updateMatrixWorld();

                        const extent = boundingVolumeToExtent(
                            nonNull(this._extent).crs,
                            tile.boundingVolume,
                            tile.matrixWorld,
                        );
                        tile.traverse(obj => {
                            (obj as ObjectWithExtent).extent = extent;
                        });
                    }
                })
                .catch(e => {
                    console.error('Cannot subdivide node', node, e);
                });
            promises.push(p);
        }

        Promise.all(promises).then(
            () => {
                node.pendingSubdivision = false;
                this.notifyChange(node);
            },
            () => {
                node.pendingSubdivision = false;

                // delete other children
                for (const n of node.getChildTiles()) {
                    n.visible = false;
                    this.markTileForDeletion(n);
                }
            },
        );
    }

    protected subdivideNode(context: Context, node: Tile): void {
        if (node.additiveRefinement) {
            // Additive refinement can only fetch visible children.
            this.subdivideNodeAdditive(context, node);
        } else {
            // Substractive refinement on the other hand requires to replace
            // node with all of its children
            this.subdivideNodeSubstractive(node);
        }
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

    protected setupMaterial(material: Material) {
        material.clippingPlanes = this.clippingPlanes;
        // this object can already be transparent with opacity < 1.0
        // we need to honor it, even when we change the whole entity's opacity
        if (material.userData.originalOpacity == null) {
            material.userData.originalOpacity = material.opacity;
        }
        this.setMaterialOpacity(material);
    }

    async executeCommand(metadata: ProcessedTile, requester?: Tile): Promise<Tile> {
        const tile = new Tile(metadata, requester);

        // Patch for supporting 3D Tiles pre 1.0 (metadata.content.url) and 1.0
        // (metadata.content.uri)
        let path: string | undefined = undefined;
        if (metadata.content) {
            if (metadata.content.url != null) {
                // 3D Tiles pre 1.0 version
                path = metadata.content.url;
            } else if (metadata.content.uri != null) {
                // 3D Tiles 1.0 version
                path = metadata.content.uri;
            }
        }

        const setupObject = (obj: Object3D) => {
            this.onObjectCreated(obj);
        };
        if (path != null) {
            // Check if we have relative or absolute url (with tileset's lopocs for example)
            const url = path.startsWith('http') ? path : metadata.baseURL + path;
            const dl = (GlobalCache.get(url) ??
                GlobalCache.set(
                    url,
                    Fetcher.arrayBuffer(url, this._networkOptions),
                )) as Promise<ArrayBuffer>;

            const result = await dl;
            if (result !== undefined) {
                let content;
                const magic = utf8Decoder.decode(new Uint8Array(result, 0, 4));
                metadata.magic = magic;
                if (magic[0] === '{') {
                    const { newTileset, newPrefix } = await $3dTilesLoader.jsonParse(
                        result,
                        this,
                        url,
                    );
                    nonNull(this._tileIndex).extendTileset(newTileset, metadata.tileId, newPrefix);
                } else if (magic === 'b3dm') {
                    content = await $3dTilesLoader.b3dmToMesh(result, this, url);
                } else if (magic === 'pnts') {
                    content = await $3dTilesLoader.pntsParse(result, this);
                } else {
                    throw new Error(`Unsupported magic code ${magic}`);
                }

                if (content) {
                    // TODO: request should be delayed if there is a viewerRequestVolume
                    tile.content = content.object3d;
                    content.object3d.name = path;

                    if ('batchTable' in content && content.batchTable != null) {
                        tile.batchTable = content.batchTable;
                    }
                    tile.add(content.object3d);
                    tile.traverse(setupObject);
                    return tile;
                }
            }
            tile.traverse(setupObject);
            return tile;
        }
        tile.traverse(setupObject);
        return tile;
    }

    /**
     * @param node - The tile to evaluate;
     * @returns true if the request can continue, false if it must be cancelled.
     */
    shouldExecute(node: Tile | undefined): boolean {
        if (!node) {
            return true;
        }

        // node was removed from the hierarchy
        if (!node.parent) {
            return false;
        }

        // tile not visible anymore
        if (!node.visible) {
            return false;
        }

        // tile visible but doesn't need subdivision anymore
        if (node.sse != null && node.sse < this.sseThreshold) {
            return false;
        }

        return true;
    }

    pick(coordinates: Vector2, options?: PickOptions): Tiles3DPickResult[] {
        if (this.material && PointCloudMaterial.isPointCloudMaterial(this.material)) {
            return pickPointsAt(this.instance, coordinates, this, options);
        }
        return pickObjectsAt(this.instance, coordinates, this.object3d, options);
    }
}

export default Tiles3D;

export { boundingVolumeToExtent };
