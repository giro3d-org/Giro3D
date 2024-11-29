import {
    Box3,
    BufferAttribute,
    BufferGeometry,
    Group,
    LineBasicMaterial,
    LineDashedMaterial,
    LineSegments,
    MathUtils,
    Vector2,
    Vector3,
    type Camera,
} from 'three';
import type Context from '../core/Context';
import Extent from '../core/geographic/Extent';
import type ColorLayer from '../core/layer/ColorLayer';
import type HasLayers from '../core/layer/HasLayers';
import type Layer from '../core/layer/Layer';
import type { LayerEvents } from '../core/layer/Layer';
import { getGeometryMemoryUsage, type GetMemoryUsageContext } from '../core/MemoryUsage';
import OperationCounter from '../core/OperationCounter';
import type Pickable from '../core/picking/Pickable';
import type PickOptions from '../core/picking/PickOptions';
import pickPointsAt, { type PointsPickResult } from '../core/picking/PickPointsAt';
import PointCloud from '../core/PointCloud';
import type RequestQueue from '../core/RequestQueue';
import { DefaultQueue } from '../core/RequestQueue';
import type { AttributeName } from '../parser/PotreeBinParser';
import PotreeBinParser from '../parser/PotreeBinParser';
import PotreeCinParser from '../parser/PotreeCinParser';
import PointCloudMaterial, { MODE, type Mode } from '../renderer/PointCloudMaterial';
import type PotreeSource from '../sources/PotreeSource';
import Fetcher from '../utils/Fetcher';
import { isBufferGeometry, isOrthographicCamera, isPerspectiveCamera } from '../utils/predicates';
import { nonNull } from '../utils/tsutils';
import { type EntityUserData } from './Entity';
import Entity3D, { type Entity3DEventMap } from './Entity3D';

// Draw a cube with lines (12 lines).
function cube(size: Vector3) {
    const h = size.clone().multiplyScalar(0.5);
    const vertices = new Float32Array([
        -h.x,
        -h.y,
        -h.z,
        -h.x,
        h.y,
        -h.z,
        -h.x,
        h.y,
        -h.z,
        h.x,
        h.y,
        -h.z,
        h.x,
        h.y,
        -h.z,
        h.x,
        -h.y,
        -h.z,
        h.x,
        -h.y,
        -h.z,
        -h.x,
        -h.y,
        -h.z,
        -h.x,
        -h.y,
        h.z,
        -h.x,
        h.y,
        h.z,
        -h.x,
        h.y,
        h.z,
        h.x,
        h.y,
        h.z,
        h.x,
        h.y,
        h.z,
        h.x,
        -h.y,
        h.z,
        h.x,
        -h.y,
        h.z,
        -h.x,
        -h.y,
        h.z,
        -h.x,
        -h.y,
        -h.z,
        -h.x,
        -h.y,
        h.z,
        -h.x,
        h.y,
        -h.z,
        -h.x,
        h.y,
        h.z,
        h.x,
        h.y,
        -h.z,
        h.x,
        h.y,
        h.z,
        h.x,
        -h.y,
        -h.z,
        h.x,
        -h.y,
        h.z,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    return geometry;
}

export interface PotreeBoundingBox {
    lx: number;
    ly: number;
    lz: number;
    ux: number;
    uy: number;
    uz: number;
}

export interface PotreeMetadata {
    version: string;
    octreeDir?: string;
    boundingBox?: PotreeBoundingBox;
    tightBoundingBox?: PotreeBoundingBox;
    pointAttributes: AttributeName[] | 'CIN';
    spacing: number;
    scale?: number;
    hierarchyStepSize: number;
}

class BoxHelper extends LineSegments<BufferGeometry, LineBasicMaterial> {
    removeMe?: boolean;

    constructor(size: Vector3, material: LineBasicMaterial) {
        super(cube(size), material);
        this.computeLineDistances();

        this.frustumCulled = false;
        this.material.linewidth = 2;
    }
}

class PotreeTilePointCloud extends PointCloud {
    boxHelper?: BoxHelper;
    tightbbox?: Box3;
}

export interface OctreeItem {
    baseurl?: string;
    name: string;
    childrenBitField: number;
    numPoints: number;
    children: OctreeItem[];
    bbox: Box3;
    // eslint-disable-next-line no-use-before-define
    layer?: PotreePointCloud;
    parent?: OctreeItem;
    findChildrenByName?: (node: OctreeItem, name: string) => OctreeItem;
    obj?: PotreeTilePointCloud;
    tightbbox?: Box3;
    visible: boolean;
    notVisibleSince?: number;
    sse?: number;
    promise?: Promise<void>;
}

const tmp = {
    v: new Vector3(),
};

function markForDeletion(elt: OctreeItem) {
    if (elt.obj) {
        elt.obj.material.visible = false;
    }

    if (elt.notVisibleSince == null) {
        elt.notVisibleSince = Date.now();
        // Set .sse to an invalid value
        elt.sse = -1;
    }
    for (const child of elt.children) {
        markForDeletion(child);
    }
}

function findChildrenByName(node: OctreeItem, name: string): OctreeItem {
    if (node.name === name) {
        return node;
    }
    const charIndex = node.name.length;
    for (let i = 0; i < node.children.length; i++) {
        if (node.children[i].name[charIndex] === name[charIndex]) {
            return findChildrenByName(node.children[i], name);
        }
    }
    throw new Error(`Cannot find node with name '${name}'`);
}

// Create an A(xis)A(ligned)B(ounding)B(ox) for the child `childIndex` of one aabb.
// (PotreeConverter protocol builds implicit octree hierarchy by applying the same
// subdivision algo recursively)
function createChildAABB(aabb: Box3, childIndex: number) {
    // Code taken from potree
    let { min } = aabb;
    let { max } = aabb;
    const dHalfLength = new Vector3().copy(max).sub(min).multiplyScalar(0.5);
    const xHalfLength = new Vector3(dHalfLength.x, 0, 0);
    const yHalfLength = new Vector3(0, dHalfLength.y, 0);
    const zHalfLength = new Vector3(0, 0, dHalfLength.z);

    const cmin = min;
    const cmax = new Vector3().add(min).add(dHalfLength);

    if (childIndex === 1) {
        min = new Vector3().copy(cmin).add(zHalfLength);
        max = new Vector3().copy(cmax).add(zHalfLength);
    } else if (childIndex === 3) {
        min = new Vector3().copy(cmin).add(zHalfLength).add(yHalfLength);
        max = new Vector3().copy(cmax).add(zHalfLength).add(yHalfLength);
    } else if (childIndex === 0) {
        min = cmin;
        max = cmax;
    } else if (childIndex === 2) {
        min = new Vector3().copy(cmin).add(yHalfLength);
        max = new Vector3().copy(cmax).add(yHalfLength);
    } else if (childIndex === 5) {
        min = new Vector3().copy(cmin).add(zHalfLength).add(xHalfLength);
        max = new Vector3().copy(cmax).add(zHalfLength).add(xHalfLength);
    } else if (childIndex === 7) {
        min = new Vector3().copy(cmin).add(dHalfLength);
        max = new Vector3().copy(cmax).add(dHalfLength);
    } else if (childIndex === 4) {
        min = new Vector3().copy(cmin).add(xHalfLength);
        max = new Vector3().copy(cmax).add(xHalfLength);
    } else if (childIndex === 6) {
        min = new Vector3().copy(cmin).add(xHalfLength).add(yHalfLength);
        max = new Vector3().copy(cmax).add(xHalfLength).add(yHalfLength);
    }

    return new Box3(min, max);
}

// eslint-disable-next-line no-use-before-define
type OnPointsCreatedCallback = (entity: PotreePointCloud, pnts: PointCloud) => void;

/**
 * A [Potree](https://github.com/potree/potree) point cloud.
 *
 */
class PotreePointCloud<UserData extends EntityUserData = EntityUserData>
    extends Entity3D<Entity3DEventMap, UserData>
    implements Pickable<PointsPickResult>, HasLayers
{
    /**
     * Read-only flag to check if a given object is of type PotreePointCloud.
     */
    readonly isPotreePointCloud = true as const;
    readonly type = 'PotreePointCloud' as const;
    readonly hasLayers = true;
    private _colorLayer?: ColorLayer;
    source: PotreeSource;
    private readonly _queue: RequestQueue;
    private _opCounter: OperationCounter;
    private _fastUpdateHint: string | null = null;
    group: Group;
    bboxes: Group;
    octreeDepthLimit = -1;
    pointBudget = 2000000;
    pointSize = 4;
    sseThreshold = 2;
    material: PointCloudMaterial;
    mode: Mode;
    /**
     * Optional hook called when a new point tile is loaded.
     * The parameter is a {@link Points} object.
     *
     * ```js
     * const cloud = new PotreePointCloud(source);
     * cloud.onPointsCreated = function(pnts) {
     *  // Do something with the points.
     * }
     * ```
     */
    onPointsCreated: OnPointsCreatedCallback | null;
    private _metadata?: PotreeMetadata;
    table?: string;
    extension?: 'cin' | 'bin';
    supportsProgressiveDisplay?: boolean;
    root?: OctreeItem;
    extent?: Extent;
    displayedCount?: number;

    private _imageSize?: Vector2;
    private _customBinFormat = false;
    get imageSize(): Vector2 {
        return this._imageSize as Vector2;
    }

    /**
     * Creates an instance of PotreePointCloud.
     *
     * @param source - The data source.
     * @example
     * const source = new PotreeSource('http://example.com', 'cloud.js');
     * const cloud = new PotreePointCloud(source);
     */
    constructor(source: PotreeSource) {
        super(new Group());
        this.source = source;

        this._queue = DefaultQueue;
        this._opCounter = new OperationCounter();

        this.group = new Group();
        this.group.name = 'root';
        this.object3d.add(this.group);
        this.group.updateMatrixWorld();

        this.bboxes = new Group();
        this.bboxes.name = 'bboxes';
        this.object3d.add(this.bboxes);
        this.bboxes.updateMatrixWorld();
        this.bboxes.visible = false;

        // default options
        this.material = new PointCloudMaterial();
        this.mode = MODE.COLOR;

        this.onPointsCreated = null;
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

    updateOpacity() {
        if (this.material != null) {
            // This is necessary because update() does copy the material's properties
            // to the tile's material, and we are losing any custom opacity.
            this.material.opacity = this.opacity;
            this.material.transparent = this.opacity < 1;
        }
        super.updateOpacity();
    }

    computeBbox() {
        const entityBbox = nonNull(this._metadata?.boundingBox);
        const bbox = new Box3(
            new Vector3(entityBbox.lx, entityBbox.ly, entityBbox.lz),
            new Vector3(entityBbox.ux, entityBbox.uy, entityBbox.uz),
        );

        return bbox;
    }

    getLayers(predicate?: (arg0: Layer) => boolean): Layer<LayerEvents>[] {
        if (this._colorLayer) {
            if (predicate && predicate(this._colorLayer)) {
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

    parseMetadata(metadata: PotreeMetadata) {
        this._metadata = metadata;

        let customBinFormat = true;

        // PotreeConverter format
        customBinFormat = this._metadata.pointAttributes === 'CIN';
        // do we have normal information
        const normal =
            Array.isArray(this._metadata.pointAttributes) &&
            this._metadata.pointAttributes.find(elem => elem.startsWith('NORMAL'));
        if (normal != null) {
            // @ts-expect-error the define is dynamically set
            this.material.defines[normal] = 1;
        }

        this.extension = customBinFormat ? 'cin' : 'bin';
        this._customBinFormat = customBinFormat;
        this.supportsProgressiveDisplay = customBinFormat;
    }

    async parseOctree(hierarchyStepSize: number, root: Partial<OctreeItem>): Promise<OctreeItem> {
        const blob = await Fetcher.arrayBuffer(
            `${root.baseurl}/r${root.name}.hrc`,
            this.source.networkOptions,
        );
        const dataView = new DataView(blob);
        const stack: OctreeItem[] = [];
        let offset = 0;

        const name = nonNull(root.name);
        root.childrenBitField = dataView.getUint8(0);
        offset += 1;
        root.numPoints = dataView.getUint32(1, true);
        offset += 4;
        root.children = [];

        stack.push(root as OctreeItem);

        while (stack.length && offset < blob.byteLength) {
            const snode = nonNull(stack.shift());
            // look up 8 children
            for (let i = 0; i < 8; i++) {
                // does snode have a #i child ?
                if (snode.childrenBitField & (1 << i) && offset + 5 <= blob.byteLength) {
                    const c = dataView.getUint8(offset);
                    offset += 1;
                    let n = dataView.getUint32(offset, true);
                    offset += 4;
                    if (n === 0) {
                        n = root.numPoints;
                    }
                    const childname = snode.name + i;
                    const bounds = createChildAABB(snode.bbox, i);

                    let url_1 = root.baseurl;
                    if (childname.length % hierarchyStepSize === 0) {
                        const myname = childname.substring(name.length);
                        url_1 = `${root.baseurl}/${myname}`;
                    }
                    const item: OctreeItem = {
                        numPoints: n,
                        childrenBitField: c,
                        children: [],
                        name: childname,
                        baseurl: url_1,
                        bbox: bounds,
                        layer: this,
                        parent: snode,
                        visible: false,
                    };
                    snode.children.push(item);
                    stack.push(item);
                }
            }
        }
        return root as OctreeItem;
    }

    async preprocess() {
        const source = this.source;
        this._imageSize = new Vector2(128, 128);
        const metadata = (await Fetcher.json(
            `${source.url}/${source.filename}`,
            source.networkOptions,
        )) as PotreeMetadata;
        this.parseMetadata(metadata);
        const bbox = this.computeBbox();

        const root = await this.parseOctree(metadata.hierarchyStepSize, {
            baseurl: `${source.url}/${metadata.octreeDir}/r`,
            name: '',
            bbox,
        });
        this.root = root;
        // @ts-expect-error incorrect type signature // TODO
        root.findChildrenByName = findChildrenByName.bind(root, root);
        this.extent = Extent.fromBox3(this.instance.referenceCrs, root.bbox);
    }

    pick(coordinates: Vector2, options?: PickOptions): PointsPickResult[] {
        return pickPointsAt(this.instance, coordinates, this, options);
    }

    updateMinMaxDistance(context: Context, bbox: Box3) {
        const distance = context.distance.plane.distanceToPoint(bbox.getCenter(tmp.v));
        const radius = bbox.getSize(tmp.v).length() * 0.5;
        this._distance.min = Math.min(this._distance.min, distance - radius);
        this._distance.max = Math.max(this._distance.max, distance + radius);
        return distance;
    }

    getBoundingBox() {
        if (this.root && this.root.bbox != null) {
            return this.root.bbox;
        }

        return null;
    }

    preUpdate(context: Context, changeSources: Set<unknown>): OctreeItem[] {
        // Bail-out if not ready
        if (!this.root) {
            return [];
        }

        const view = context.view;
        const camera = view.camera;

        if (isPerspectiveCamera(camera)) {
            // See https://cesiumjs.org/hosted-apps/massiveworlds/downloads/Ring/WorldScaleTerrainRendering.pptx
            // slide 17
            view.preSSE = view.height / (2 * Math.tan(MathUtils.degToRad(camera.fov) * 0.5));
        } else if (isOrthographicCamera(camera)) {
            view.preSSE = (view.height * camera.near) / (camera.top - camera.bottom);
        }

        if (this.material != null) {
            this.material.visible = this.visible;
            this.material.opacity = this.opacity;
            const currentTransparent = this.material.transparent;
            this.material.transparent = this.opacity < 1;
            this.material.needsUpdate = currentTransparent !== this.material.transparent;
            this.material.size = this.pointSize;
        }

        // lookup lowest common ancestor of changeSources
        let commonAncestorName: string | undefined = undefined;

        for (const source of changeSources.values()) {
            if ((source as Camera).isCamera || source === this) {
                // if the change is caused by a camera move, no need to bother
                // to find common ancestor: we need to update the whole tree:
                // some invisible tiles may now be visible
                return [this.root];
            }
            if ((source as OctreeItem).obj === undefined) {
                continue;
            }

            const octreeItem = source as OctreeItem;
            const obj = nonNull(octreeItem.obj);

            // filter sources that belong to our entity
            if (obj.isPoints && this.isOwned(obj)) {
                const name = octreeItem.name;
                if (commonAncestorName == null) {
                    commonAncestorName = name;
                } else {
                    const nameLength = Math.min(name.length, commonAncestorName.length);
                    let i;
                    for (i = 0; i < nameLength; i++) {
                        if (name[i] !== commonAncestorName[i]) {
                            break;
                        }
                    }
                    commonAncestorName = commonAncestorName.substr(0, i);
                    if (commonAncestorName.length === 0) {
                        break;
                    }
                }
            }
        }
        if (commonAncestorName != null) {
            this._fastUpdateHint = commonAncestorName;
        }

        // Start updating from hierarchy root
        return [this.root];
    }

    computeScreenSpaceError(context: Context, elt: OctreeItem, distance: number) {
        if (distance <= 0) {
            return Infinity;
        }
        const pointSpacing = nonNull(this._metadata).spacing / 2 ** elt.name.length;
        // Estimate the onscreen distance between 2 points
        const onScreenSpacing = (context.view.preSSE * pointSpacing) / distance;
        // [  P1  ]--------------[   P2   ]
        //     <--------------------->      = pointsSpacing (in world coordinates)
        //                                  ~ onScreenSpacing (in pixels)
        // <------>                         = layer.pointSize (in pixels)
        // we are interested in the radius of the points, not their total size.
        const pointRadius = this.pointSize / 2;
        return Math.max(0.0, onScreenSpacing - pointRadius);
    }

    initBoundingBox(elt: OctreeItem) {
        const tightbbox = nonNull(elt.tightbbox);

        const size = tightbbox.getSize(tmp.v);

        const lineMaterial = elt.childrenBitField
            ? new LineDashedMaterial({ color: 0, dashSize: 0.25, gapSize: 0.25 })
            : new LineBasicMaterial({ color: 0 });

        const obj = nonNull(elt.obj);

        obj.boxHelper = new BoxHelper(size, lineMaterial);
        obj.boxHelper.position.copy(tightbbox.min);
        obj.boxHelper.position.add(size.multiplyScalar(0.5));
        obj.boxHelper.updateMatrixWorld(true);
        obj.boxHelper.matrixAutoUpdate = false;
        obj.boxHelper.layers.mask = this.bboxes.layers.mask;
        this.bboxes.add(obj.boxHelper);
        obj.boxHelper.updateMatrixWorld();
    }

    update(context: Context, elt: OctreeItem) {
        if (this.octreeDepthLimit >= 0 && this.octreeDepthLimit < elt.name.length) {
            markForDeletion(elt);
            return null;
        }

        // pick the best bounding box
        const bbox = elt.tightbbox ? elt.tightbbox : elt.bbox;

        if (this._fastUpdateHint != null && !elt.name.startsWith(this._fastUpdateHint)) {
            if (!elt.visible) {
                return null;
            }
            this.updateMinMaxDistance(context, bbox);
        } else {
            elt.visible = context.view.isBox3Visible(bbox, this.object3d.matrixWorld);

            if (!elt.visible) {
                markForDeletion(elt);
                return null;
            }

            const distance = this.updateMinMaxDistance(context, bbox);
            elt.notVisibleSince = undefined;

            // only load geometry if this elements has points
            if (elt.numPoints > 0) {
                if (elt.obj) {
                    elt.obj.material.update(this.material);
                } else if (!elt.promise) {
                    // Increase priority of nearest node
                    const priority =
                        this.computeScreenSpaceError(context, elt, distance) /
                        Math.max(0.001, distance);

                    this._opCounter.increment();

                    elt.promise = this._queue
                        .enqueue({
                            id: MathUtils.generateUUID(),
                            priority,
                            shouldExecute: () => elt.visible && this.visible,
                            request: () => this.executeCommand(elt),
                        })
                        .then(
                            (pts: PotreeTilePointCloud) => {
                                if (this.onPointsCreated) {
                                    this.onPointsCreated(this, pts);
                                }

                                elt.obj = pts;
                                // store tightbbox to avoid ping-pong
                                // (bbox = larger => visible, tight => invisible)
                                elt.tightbbox = pts.tightbbox;

                                // make sure to add it here, otherwise it might never
                                // be added nor cleaned
                                this.group.add(elt.obj);
                                elt.obj.updateMatrixWorld(true);
                                elt.promise = undefined;
                                this.notifyChange(this);
                            },
                            err => {
                                if (err instanceof Error && err.message === 'aborted') {
                                    elt.promise = undefined;
                                } else {
                                    console.error(err);
                                }
                            },
                        )
                        .finally(() => this._opCounter.decrement());
                }
            }

            if (elt.children != null && elt.children.length > 0) {
                elt.sse = this.computeScreenSpaceError(context, elt, distance) / this.sseThreshold;
            }
        }

        if (elt.children != null && elt.children.length > 0) {
            if (elt.sse != null && elt.sse >= 1) {
                return elt.children;
            }
            for (const child of elt.children) {
                markForDeletion(child);
            }
        }
        return null;
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    postUpdate(context: Context, changeSource: Set<unknown>) {
        if (this.group == null) {
            return;
        }

        this._fastUpdateHint = null;

        this.displayedCount = 0;
        for (const obj3d of this.group.children) {
            const pts = obj3d as PotreeTilePointCloud;
            if (pts.material.visible) {
                const { count } = pts.geometry.attributes.position;
                pts.geometry.setDrawRange(0, count);
                this.displayedCount += count;
            }
        }

        if (this.displayedCount > this.pointBudget) {
            // 2 different point count limit implementation, depending on the pointcloud source
            if (this.supportsProgressiveDisplay === true) {
                // In this format, points are evenly distributed within a node,
                // so we can draw a percentage of each node and still get a correct
                // representation
                const reduction = this.pointBudget / this.displayedCount;

                for (const obj3d of this.group.children) {
                    const pts = obj3d as PotreeTilePointCloud;

                    if (pts.material.visible) {
                        const count = Math.floor(pts.geometry.drawRange.count * reduction);

                        if (count > 0) {
                            pts.geometry.setDrawRange(0, count);
                        } else {
                            pts.material.visible = false;
                        }
                    }
                }
                this.displayedCount *= reduction;
            } else {
                // This format doesn't require points to be evenly distributed, so
                // we're going to sort the nodes by "importance" (= on screen size)
                // and display only the first N nodes
                this.group.children.sort(
                    (p1, p2) => p2.userData.metadata.sse - p1.userData.metadata.sse,
                );

                let limitHit = false;
                this.displayedCount = 0;

                for (const obj3d of this.group.children) {
                    const pts = obj3d as PotreeTilePointCloud;
                    const { count } = pts.geometry.attributes.position;

                    if (limitHit || this.displayedCount + count > this.pointBudget) {
                        pts.material.visible = false;
                        limitHit = true;
                    } else {
                        this.displayedCount += count;
                    }
                }
            }
        }

        const now = Date.now();
        for (let i = this.group.children.length - 1; i >= 0; i--) {
            const obj = this.group.children[i] as PotreeTilePointCloud;

            if (obj.userData == null || obj.userData.metadata == null) {
                continue;
            }

            const notVisibleSince = obj.userData.metadata.notVisibleSince;

            if (!obj.material.visible && now - notVisibleSince > 10000) {
                // remove from group
                this.group.children.splice(i, 1);

                obj.material.dispose();
                obj.geometry.dispose();
                obj.userData.metadata.obj = null;
            }
        }

        this.traverse(obj => {
            if (
                PointCloud.isPointCloud(obj) &&
                PointCloudMaterial.isPointCloudMaterial(obj.material)
            ) {
                this.forEachLayer(layer => layer.update(context, obj));
            }
        });

        this.forEachLayer(layer => layer.postUpdate());
    }

    async executeCommand(metadata: OctreeItem) {
        const thisMetadata = nonNull(this._metadata);

        // Query HRC if we don't have children metadata yet.
        if (metadata.childrenBitField && metadata.children.length === 0) {
            this.parseOctree(thisMetadata.hierarchyStepSize, metadata).then(() =>
                this.notifyChange(this),
            );
        }

        const url = `${metadata.baseurl}/r${metadata.name}.${this.extension}`;

        const buffer = await Fetcher.arrayBuffer(url, this.source.networkOptions);

        let geometry: BufferGeometry;

        if (this._customBinFormat) {
            geometry = await PotreeCinParser.parse(buffer);
        } else {
            const attributes = thisMetadata.pointAttributes as AttributeName[];
            geometry = await PotreeBinParser.parse(buffer, attributes);
        }

        const points = new PotreeTilePointCloud({
            geometry,
            material: this.material.clone(),
            textureSize: nonNull(this._imageSize),
            extent: Extent.fromBox3(this.instance.referenceCrs, metadata.bbox),
        });
        points.name = `r${metadata.name}.${this.extension}`;
        points.frustumCulled = false;
        points.matrixAutoUpdate = false;
        points.position.copy(metadata.bbox.min);
        const scale = nonNull(thisMetadata.scale);
        points.scale.set(scale, scale, scale);
        points.updateMatrix();
        points.tightbbox = nonNull(geometry.boundingBox).applyMatrix4(points.matrix);
        points.userData.metadata = metadata;
        this.onObjectCreated(points);
        return points;
    }
}

export default PotreePointCloud;
