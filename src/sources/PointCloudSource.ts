import { EventDispatcher, MathUtils, type Box3, type BufferAttribute, type Vector3 } from 'three';
import type Disposable from '../core/Disposable';
import type MemoryUsage from '../core/MemoryUsage';
import type { GetMemoryUsageContext } from '../core/MemoryUsage';
import type Progress from '../core/Progress';

export type PointCloudAttribute = {
    /**
     * The name of the attribute.
     */
    name: string;
    /**
     * Dimension of the attribute. Scalar attributes have dimension 1, e.g intensity, return number,
     * classification. Dimension 3 is for 3-component vectors such as position (XYZ), and color (RGB).
     */
    dimension: 1 | 3;
    /**
     * Dictates how the attribute will be interpreted. Color means the attribute (which
     * is expected to be a 3-component vector) will be interpreted as a RGB triplet. Classification
     * will map discrete colors to the values. Unknown is the default and will use a colormap to map
     * the values to colors.
     */
    interpretation: 'color' | 'classification' | 'unknown';
    /**
     * The data type of this attribute.
     */
    type: 'signed' | 'unsigned' | 'float';
    /**
     * The size, in bytes, of each element in the attribute. For scalars, this is effectively the
     * size in bytes of the whole attribute, per-point. For vectors, this is the size of each component
     * of the vector.
     */
    size: 1 | 2 | 4;
    /**
     * The minimum value of this attribute, if any. Can be used as a hint to specify color map bounds.
     */
    min?: number;
    /**
     * The maximum value of this attribute, if any. Can be used as a hint to specify color map bounds.
     */
    max?: number;
};

/**
 * A dataset CRS definition. Useful when loading datasets from unknown sources, where we don't
 * have this information beforehand.
 */
export type PointCloudCrs = { name: string; definition?: string };

/**
 * Contains lightweight metadata about the source, such as point count.
 */
export type PointCloudMetadata = {
    /**
     * The volume of the point cloud.
     *
     * Note: if the source cannot provide a volume (for example, because it is not present in the
     * headers, or because the source is split into many files), this is `undefined`. In this case,
     * clients should use the volume of the root node in the hierarchy.
     */
    volume?: Box3;
    /**
     * The total number of points in this source.
     *
     * Note: if the source cannot provide a total point count (for example, because it is not
     * present in the headers, or because the source is split into many files), this is `undefined`.
     */
    pointCount?: number;
    /**
     * The supported attributes in this source.
     */
    attributes: PointCloudAttribute[];
    /**
     * The coordinate system of this source, if any.
     */
    crs?: PointCloudCrs;
};

/**
 * A point cloud hierarchy node.
 */
export type PointCloudNode = {
    /**
     * The ID of the node in the source.
     * Note: this ID is **not unique** across sources.
     */
    id: string;
    /**
     * The ID of the {@link PointCloudSource} that owns this node.
     */
    sourceId: string;
    /**
     * The depth of the node in the hierarchy. A depth of zero indicates a root node.
     */
    depth: number;
    /**
     * True if the node has point cloud data, or if it is empty.
     */
    hasData: boolean;
    /**
     * The geometric error of this node. Used to determine if the node should be displayed from
     * a given camera position. Generally it can be the same as the point spacing.
     */
    geometricError: number;
    /**
     * The node volume in world space coordinates.
     */
    volume: Box3;
    /**
     * The center of the volume.
     */
    center: Vector3;
    /**
     * The number of points in this node, if known.
     */
    pointCount?: number;
    /**
     * The parent of this node. If `undefined`, this node is a root node.
     */
    parent?: PointCloudNode;
    /**
     * The children of this node. If undefined, this node is a leaf node. The array can contain
     * undefined items though (for example an octree that does not have 8 defined children).
     */
    children?: Array<PointCloudNode | undefined>;
};

/**
 * Performs a depth-first traversal of the node hierarchy, applying the callback to each traversed node.
 * If the callback returns `false` for a given node, the children of this node are not traversed.
 */
export function traverseNode(
    root: PointCloudNode | undefined | null,
    callback: (node: PointCloudNode) => boolean,
): void {
    if (!root) {
        return;
    }

    if (!callback(root)) {
        // Stop traversal
        return;
    }

    if (root.children != null) {
        for (let i = 0; i < root.children.length; i++) {
            const child = root.children[i];

            if (child) {
                traverseNode(child, callback);
            }
        }
    }
}

/**
 * Contains data for a single {@link PointCloudNode}.
 */
export type PointCloudNodeData = {
    /**
     * The number of points in the buffers.
     * Might be undefined if position buffer was not required by the caller.
     */
    pointCount?: number;
    /**
     * The origin of the position buffer.
     */
    origin: Vector3;
    /**
     * The optional scale to apply to the resulting mesh.
     */
    scale?: Vector3;
    /**
     * The position buffer.
     * Might be undefined if position buffer was not required by the caller.
     */
    position?: BufferAttribute;
    /**
     * The local bounding box of this node's point cloud. If undefined, the volume of the node will
     * be used instead.
     * Might be undefined if position buffer was not required by the caller.
     */
    localBoundingBox?: Box3;
    /**
     * The optionally requested attribute buffer (color, classification, etc).
     */
    attribute?: BufferAttribute;
};

/**
 * Default event map.
 */
export interface PointCloudSourceEventMap {
    /** Raised when the progress of this source changes. */
    progress: unknown;
    /** Raised when the source is initialized. */
    initialized: unknown;
    /** Raised when the source's content has been updated. */
    updated: unknown;
}

export type GetNodeDataOptions = {
    /**
     * To node to process.
     */
    node: PointCloudNode;
    /**
     * Load the point position attribute.
     */
    position: boolean;
    /**
     * The optional attribute to load.
     */
    attribute?: PointCloudAttribute;
    /**
     * Optional abort signal for early cancellation of asynchronous requests.
     */
    signal?: AbortSignal;
};

/**
 * Provides point cloud data.
 */
export interface PointCloudSource<
    TEventMap extends PointCloudSourceEventMap = PointCloudSourceEventMap,
> extends Progress,
        Disposable,
        MemoryUsage,
        EventDispatcher<TEventMap> {
    readonly id: string;
    /**
     * A flag that indicates that the source is ready to use. This flag should be true when
     * {@link initialize} has finished.
     */
    ready: boolean;

    /**
     * The name of the source implementation.
     */
    type: string;

    /**
     * Initialize this source.
     * As long as this source is not initialized, it cannot be used.
     */
    initialize(): Promise<this>;

    /**
     * Gets the hierarchy of this point cloud.
     *
     * Note: this does not provide point cloud data itself.
     */
    getHierarchy(): Promise<PointCloudNode>;

    /**
     * Gets the metadata of this source.
     */
    getMetadata(): Promise<PointCloudMetadata>;

    /**
     * Loads buffer data for the specific {@link PointCloudNode}.
     * @param params - Options.
     */
    getNodeData(params: GetNodeDataOptions): Promise<PointCloudNodeData>;
}

/**
 * Base class for sources that provide point cloud data.
 */
export abstract class PointCloudSourceBase<
        TEventMap extends PointCloudSourceEventMap = PointCloudSourceEventMap,
    >
    extends EventDispatcher<TEventMap>
    implements Progress, Disposable, MemoryUsage
{
    abstract type: string;

    readonly isMemoryUsage = true as const;
    /** Read-only flag to indicate that this object is a PointCloudSource. */
    readonly isPointCloudSource = true as const;

    /** An auto-generated UUID used internally to create unique keys for various purposes. */
    readonly id = MathUtils.generateUUID();

    private _initializePromise: Promise<this> | null = null;
    private _ready = false;

    get ready() {
        return this._ready;
    }

    /**
     * Initialize this source.
     * As long as this source is not initialized, it cannot be used.
     */
    initialize(): Promise<this> {
        if (!this._initializePromise) {
            this._initializePromise = this.initializeOnce();
            this._initializePromise.then(() => {
                this._ready = true;
                // @ts-expect-error stange issue with typing here
                this.dispatchEvent({ type: 'initialized' });
            });
        }

        return this._initializePromise;
    }

    /**
     * Implement by subclasses to initialize the source. This is automatically called by {@link initialize}.
     */
    protected abstract initializeOnce(): Promise<this>;

    /**
     * Gets the hierarchy of this point cloud.
     *
     * Note: this does not provide point cloud data itself.
     */
    abstract getHierarchy(): Promise<PointCloudNode>;

    /**
     * Gets the metadata of this source.
     */
    abstract getMetadata(): Promise<PointCloudMetadata>;

    /**
     * Loads buffer data for the specific {@link PointCloudNode}.
     * @param params - Options.
     */
    abstract getNodeData(params: GetNodeDataOptions): Promise<PointCloudNodeData>;

    abstract get progress(): number;
    abstract get loading(): boolean;
    abstract dispose(): void;
    abstract getMemoryUsage(context: GetMemoryUsageContext): void;
}
