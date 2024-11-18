import type Feature from 'ol/Feature';
import type {
    Geometry,
    LineString,
    MultiLineString,
    MultiPoint,
    MultiPolygon,
    Point,
    Polygon,
} from 'ol/geom';
import type VectorSource from 'ol/source/Vector';
import type { BufferGeometry, Camera, Object3D, Plane } from 'three';
import { Box3, Group, MathUtils, Vector3 } from 'three';

import { Projection } from 'ol/proj';
import { GlobalCache } from '../core/Cache';
import type Context from '../core/Context';
import {
    type FeatureElevationCallback,
    type FeatureExtrusionOffsetCallback,
    type FeatureStyle,
    type FeatureStyleCallback,
    type LineMaterialGenerator,
    type PointMaterialGenerator,
    type SurfaceMaterialGenerator,
} from '../core/FeatureTypes';
import type Extent from '../core/geographic/Extent';
import LayerUpdateState from '../core/layer/LayerUpdateState';
import { getGeometryMemoryUsage, type GetMemoryUsageContext } from '../core/MemoryUsage';
import OperationCounter from '../core/OperationCounter';
import { DefaultQueue } from '../core/RequestQueue';
import type { SSE } from '../core/ScreenSpaceError';
import ScreenSpaceError from '../core/ScreenSpaceError';
import type { BaseOptions } from '../renderer/geometries/GeometryConverter';
import GeometryConverter from '../renderer/geometries/GeometryConverter';
import type LineStringMesh from '../renderer/geometries/LineStringMesh';
import { isLineStringMesh } from '../renderer/geometries/LineStringMesh';
import type MultiLineStringMesh from '../renderer/geometries/MultiLineStringMesh';
import { isMultiPolygonMesh } from '../renderer/geometries/MultiPolygonMesh';
import type PointMesh from '../renderer/geometries/PointMesh';
import { isPointMesh } from '../renderer/geometries/PointMesh';
import { isPolygonMesh } from '../renderer/geometries/PolygonMesh';
import type SimpleGeometryMesh from '../renderer/geometries/SimpleGeometryMesh';
import { isSimpleGeometryMesh } from '../renderer/geometries/SimpleGeometryMesh';
import type SurfaceMesh from '../renderer/geometries/SurfaceMesh';
import { isSurfaceMesh } from '../renderer/geometries/SurfaceMesh';
import OLUtils from '../utils/OpenLayersUtils';
import { nonNull } from '../utils/tsutils';
import type { EntityUserData } from './Entity';
import type { Entity3DEventMap } from './Entity3D';
import Entity3D from './Entity3D';

const CACHE_TTL = 30_000; // 30 seconds

const vector = new Vector3();

// A unique property name to avoid conflicting with existing feature attributes
const ID_PROPERTY = '___37499262-65c9-FeatureCollection_ID';

/**
 * The content of the `.userData` property of the {@link SimpleGeometryMesh}es created by this entity.
 */
export type MeshUserData = {
    /**
     * The feature this mesh was generated from.
     */
    feature: Feature;
    /**
     * The parent entity of this mesh.
     */
    parentEntity: Entity3D;
    /**
     * The style of this mesh.
     */
    style: FeatureStyle;
};

function isThreeCamera(obj: unknown): obj is Camera {
    return typeof obj === 'object' && (obj as Camera)?.isCamera;
}

function setNodeContentVisible(node: Object3D, visible: boolean) {
    for (const child of node.children) {
        // hide the content of the tile without hiding potential children tile's content
        if (!isFeatureTile(child)) {
            child.visible = visible;
        }
    }
}

function selectBestSubdivisions(extent: Extent) {
    const dims = extent.dimensions();
    const ratio = dims.x / dims.y;
    let x = 1;
    let y = 1;
    if (ratio > 1) {
        // Our extent is an horizontal rectangle
        x = Math.round(ratio);
    } else if (ratio < 1) {
        // Our extent is an vertical rectangle
        y = Math.round(1 / ratio);
    }

    return { x, y };
}

type FeatureTileUserData = {
    parentEntity: Entity3D;
    layerUpdateState: LayerUpdateState;
    extent: Extent;
    x: number;
    y: number;
    z: number;
};

class FeatureTile extends Group {
    readonly isFeatureTile = true as const;
    readonly type = 'FeatureTile' as const;
    readonly origin: Vector3;
    readonly boundingBox: Box3;

    readonly userData: FeatureTileUserData;

    constructor(options: {
        name: string;
        origin: Vector3;
        userData: FeatureTileUserData;
        boundingBox: Box3;
    }) {
        super();
        this.name = options.name;
        this.origin = options.origin;
        this.userData = options.userData;
        this.boundingBox = options.boundingBox;
    }

    dispose(set: Set<string | number>) {
        this.traverse(obj => {
            if (isSimpleGeometryMesh<MeshUserData>(obj)) {
                obj.dispose();
                const feature = nonNull(obj.userData.feature);
                const id = nonNull(feature.get(ID_PROPERTY));
                set.delete(id);
            }
        });

        this.clear();
    }
}

function isFeatureTile(obj: unknown): obj is FeatureTile {
    return (obj as FeatureTile)?.isFeatureTile;
}

function getRootMesh(obj: Object3D): SimpleGeometryMesh<MeshUserData> | null {
    let current = obj;

    while (isSimpleGeometryMesh<MeshUserData>(current.parent)) {
        current = current.parent;
    }

    if (isSimpleGeometryMesh<MeshUserData>(current)) {
        return current;
    }
    return null;
}

/**
 * An {@link Entity3D} that represent [simple features](https://en.wikipedia.org/wiki/Simple_Features)
 * as 3D meshes.
 *
 * ❗ Arbitrary triangulated meshes (TINs) are not supported.
 *
 * ## Supported geometries
 *
 * Both 2D and 3D geometries are supported. In the case of 2D geometries (with only XY coordinates),
 * you can specify an elevation (Z) to display the geometries at arbitrary heights, using the
 * `elevation` option in the constructor.
 *
 * Supported geometries:
 * - [Point](https://openlayers.org/en/latest/apidoc/module-ol_geom_Point-Point.html) and [MultiPoint](https://openlayers.org/en/latest/apidoc/module-ol_geom_MultiPoint-MultiPoint.html)
 * - [LineString](https://openlayers.org/en/latest/apidoc/module-ol_geom_LineString-LineString.html) and [MultiLineString](https://openlayers.org/en/latest/apidoc/module-ol_geom_MultiLineString-MultiLineString.html)
 * - [Polygon](https://openlayers.org/en/latest/apidoc/module-ol_geom_Polygon-Polygon.html) and [MultiPolygon](https://openlayers.org/en/latest/apidoc/module-ol_geom_MultiPolygon-MultiPolygon.html).
 * Polygons can additionally be extruded (e.g to display buildings from footprints) with the
 * `extrusionOffset` constructor option.
 *
 * ## Data sources
 *
 * At the moment, this entity accepts an OpenLayers [VectorSource](https://openlayers.org/en/latest/apidoc/module-ol_source_Vector-VectorSource.html)
 * that returns [features](https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html).
 *
 * NOTE: if your source doesn't have a notion of level of detail, like a WFS server, you must choose
 * one level where data will be downloaded. The level giving the best user experience depends on the
 * data source. You must configure both `minLevel` and `maxLevel` to this level.
 *
 * For example, in the case of a WFS source:
 *
 * ```js
 * import VectorSource from 'ol/source/Vector.js';
 * import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection';
 *
 * const vectorSource = new VectorSource({
 *  // ...
 * });
 * const featureCollection = new FeatureCollection('features', {
 *  source: vectorSource
 *  minLevel: 10,
 *  maxLevel: 10,
 *  elevation: (feature) => feat.getProperties().elevation,
 * });
 *
 * instance.add(featureCollection);
 *
 * ```
 * ## Supported CRSes
 *
 * The `FeatureCollection` supports the reprojection of geometries if the source has a different CRS
 * than the scene. Any custom CRS must be registered first with
 * {@link core.Instance.registerCRS | Instance.registerCRS()}.
 *
 * Related examples:
 *
 * - [WFS as 3D meshes](/examples/wfs_mesh.html)
 * - [IGN data](/examples/ign_data.html)
 *
 * ## Styling
 *
 * Features can be styled using a {@link FeatureStyle}, either using the same style for the entire
 * entity, or using a style function that will return a style for each feature.
 *
 * ❗ All features that share the same style will internally use the same material. It is not advised
 * to modify this material to avoid affecting all shared objects. Those materials are automatically
 * disposed when the entity is removed from the instance.
 *
 * Textures used by point styles are also disposed if they were created internally by the entity
 * (from a provided URL) rather than provided as a texture.
 *
 * ### Overriding material generators
 *
 * By default, styles are converted to materials using default generator functions. It is possible
 * to override those function to create custom materials. For example, to use custom line materials,
 * you can pass the `lineMaterialGenerator` option to the constructor.
 */
class FeatureCollection<UserData = EntityUserData> extends Entity3D<Entity3DEventMap, UserData> {
    /**
     * Read-only flag to check if a given object is of type FeatureCollection.
     */
    readonly isFeatureCollection = true as const;
    readonly type = 'FeatureCollection' as const;

    /**
     * The projection code of the data source.
     */
    readonly dataProjection: string | null;

    /**
     * The minimum LOD at which this entity is displayed.
     */
    readonly minLevel: number = 0;
    /**
     * The maximum LOD at which this entity is displayed.
     */
    readonly maxLevel: number = 0;

    /**
     * The extent of this entity.
     */
    readonly extent: Extent;

    private readonly _level0Nodes: FeatureTile[];
    private readonly _rootMeshes: SimpleGeometryMesh<MeshUserData>[] = [];
    private readonly _geometryConverter: GeometryConverter<MeshUserData>;
    private readonly _subdivisions: { x: number; y: number };
    private readonly _opCounter: OperationCounter;
    private readonly _tileIdSet: Set<string | number>;
    private readonly _source: VectorSource;
    private readonly _style: FeatureStyle | FeatureStyleCallback | null = null;
    private readonly _extrusionOffset?: FeatureExtrusionOffsetCallback | number | Array<number>;
    private readonly _elevation: FeatureElevationCallback | number | Array<number> | undefined;
    private readonly _ignoreZ: boolean;

    private _targetProjection?: Projection;

    /**
     * The factor to drive the subdivision of feature nodes. The heigher, the bigger the nodes.
     */
    sseScale = 1;

    /**
     * The number of materials managed by this entity.
     */
    get materialCount() {
        return this._geometryConverter.materialCount;
    }

    /**
     * Construct a `FeatureCollection`.
     *
     * @param options - Constructor options.
     */
    constructor(options: {
        /** The OpenLayers [VectorSource](https://openlayers.org/en/latest/apidoc/module-ol_source_Vector-VectorSource.html) providing features to this entity */
        source: VectorSource;
        /**
         * The projection code for the projections of the features. If null or empty,
         * no reprojection will be done. If a valid epsg code is given and if different from
         * `instance.referenceCrs`, each feature will be reprojected before mesh
         * conversion occurs. Note that reprojection can be somewhat heavy on CPU resources.
         */
        dataProjection?: string;
        /** The geographic extent of the entity. */
        extent: Extent;
        /** The optional 3D object to use as the root */
        object3d?: Object3D;
        /**
         * The min subdivision level to start processing features.
         * Useful for WFS or other untiled servers, to avoid to download the
         * entire dataset when the whole extent is visible.
         */
        minLevel?: number;
        /**
         * The max level to subdivide the extent and process features.
         */
        maxLevel?: number;
        /**
         * Set the elevation of the features received from the source.
         * It can be a constant for every feature, or a callback.
         * The callback version is particularly useful to derive the elevation
         * from the properties of the feature.
         * Requires `ignoreZ` to be `false`.
         */
        elevation?: number | number[] | FeatureElevationCallback;
        /**
         * If true, the Z-coordinates of geometries will be ignored and set to zero.
         * @defaultValue false
         */
        ignoreZ?: boolean;
        /**
         * If set, this will cause 2D features to be extruded of the corresponding amount.
         * If a single value is given, it will be used for all the vertices of every feature.
         * If an array is given, each extruded vertex will use the corresponding value.
         * If a callback is given, it allows to extrude each feature individually.
         */
        extrusionOffset?: number | number[] | FeatureExtrusionOffsetCallback;
        /**
         * An style or a callback returning a style to style the individual features.
         * If an object is used, the informations it contains will be used to style every
         * feature the same way. If a function is provided, it will be called with the feature.
         * This allows to individually style each feature.
         */
        style?: FeatureStyle | FeatureStyleCallback;
        /**
         * An optional material generator for shaded surfaces.
         */
        shadedSurfaceMaterialGenerator?: SurfaceMaterialGenerator;
        /**
         * An optional material generator for unshaded surfaces.
         */
        unshadedSurfaceMaterialGenerator?: SurfaceMaterialGenerator;
        /**
         * An optional material generator for lines.
         */
        lineMaterialGenerator?: LineMaterialGenerator;
        /**
         * An optional material generator for points.
         */
        pointMaterialGenerator?: PointMaterialGenerator;
    }) {
        super(options.object3d || new Group());

        this._geometryConverter = new GeometryConverter<MeshUserData>({
            shadedSurfaceMaterialGenerator: options.shadedSurfaceMaterialGenerator,
            unshadedSurfaceMaterialGenerator: options.unshadedSurfaceMaterialGenerator,
            lineMaterialGenerator: options.lineMaterialGenerator,
            pointMaterialGenerator: options.pointMaterialGenerator,
        });
        this._geometryConverter.addEventListener('texture-loaded', () => this.notifyChange(this));

        if (options.extent == null) {
            throw new Error('Error while initializing FeatureCollection: missing options.extent');
        }
        if (!options.extent.isValid()) {
            throw new Error(
                'Invalid extent: minX must be less than maxX and minY must be less than maxY.',
            );
        }
        if (options.source == null) {
            throw new Error('options.source is mandatory.');
        }
        this._ignoreZ = options.ignoreZ ?? false;
        this.dataProjection = options.dataProjection ?? null;
        this.extent = options.extent;
        this._subdivisions = selectBestSubdivisions(this.extent);

        this.maxLevel = options.maxLevel ?? Infinity;
        this.minLevel = options.minLevel ?? 0;

        this._extrusionOffset = options.extrusionOffset;
        this._elevation = options.elevation;
        this._style = options.style ?? null;

        this.sseScale = 1;

        this.visible = true;

        this._level0Nodes = [];

        this._source = options.source;

        this._opCounter = new OperationCounter();

        // some protocol like WFS have no real tiling system, so we need to make sure we don't get
        // duplicated elements
        this._tileIdSet = new Set();
    }

    getMemoryUsage(context: GetMemoryUsageContext) {
        this.traverse(obj => {
            if ('geometry' in obj) {
                getGeometryMemoryUsage(context, obj.geometry as BufferGeometry);
            }
        });
    }

    preprocess() {
        this._targetProjection = new Projection({ code: this.instance.referenceCrs });

        // If the map is not square, we want to have more than a single
        // root tile to avoid elongated tiles that hurt visual quality and SSE computation.
        const rootExtents = this.extent.split(this._subdivisions.x, this._subdivisions.y);

        let i = 0;
        for (const root of rootExtents) {
            if (this._subdivisions.x > this._subdivisions.y) {
                this._level0Nodes.push(this.buildNewTile(root, 0, i, 0));
            } else if (this._subdivisions.y > this._subdivisions.x) {
                this._level0Nodes.push(this.buildNewTile(root, 0, 0, i));
            } else {
                this._level0Nodes.push(this.buildNewTile(root, 0, 0, 0));
            }
            i++;
        }
        for (const level0 of this._level0Nodes) {
            this.object3d.add(level0);
            level0.updateMatrixWorld();
        }

        return Promise.resolve();
    }

    /**
     * Gets whether this entity is currently loading data.
     */
    get loading() {
        return this._opCounter.loading;
    }

    /**
     * Gets the progress value of the data loading.
     */
    get progress() {
        return this._opCounter.progress;
    }

    private buildNewTile(extent: Extent, z: number, x = 0, y = 0) {
        // create a simple square shape. We duplicate the top left and bottom right
        // vertices because each vertex needs to appear once per triangle.
        extent = extent.as(this.instance.referenceCrs);

        const origin = extent.centerAsVector3();
        const name = `tile @ (z=${z}, x=${x}, y=${y})`;

        const userData: FeatureTileUserData = {
            parentEntity: this as Entity3D,
            extent,
            z,
            x,
            y,
            layerUpdateState: new LayerUpdateState(),
        };

        // we initialize it with fake z to avoid a degenerate bounding box
        // the culling test will be done considering x and y only anyway.
        const boundingBox = new Box3(
            new Vector3(extent.west, extent.south, -1),
            new Vector3(extent.east, extent.north, 1),
        );

        const tile = new FeatureTile({
            origin,
            name,
            userData,
            boundingBox,
        });
        tile.visible = false;
        if (this.renderOrder !== undefined || this.renderOrder !== null) {
            tile.renderOrder = this.renderOrder;
        }

        this.onObjectCreated(tile);
        return tile;
    }

    preUpdate(_: Context, changeSources: Set<unknown>) {
        if (changeSources.has(undefined) || changeSources.size === 0) {
            return this._level0Nodes;
        }

        const nodeToUpdate: FeatureTile[] = [];

        for (const source of changeSources.values()) {
            if (isThreeCamera(source) || source === this) {
                // if the change is caused by a camera move, no need to bother
                // to find common ancestor: we need to update the whole tree:
                // some invisible tiles may now be visible
                return this._level0Nodes;
            }

            if (isFeatureTile(source) && source.userData.parentEntity === this) {
                nodeToUpdate.push(source);
            } else if (isSimpleGeometryMesh<MeshUserData>(source)) {
                this.updateStyle(source);
            } else if (isSurfaceMesh<MeshUserData>(source)) {
                this.updateStyle(source.parent);
            }
        }
        if (nodeToUpdate.length > 0) {
            return nodeToUpdate;
        }
        return [];
    }

    private getCachedList() {
        if (this._rootMeshes.length === 0) {
            this.traverse(obj => {
                const root = getRootMesh(obj);
                if (root != null) {
                    this._rootMeshes.push(root);
                }
            });
        }

        return this._rootMeshes;
    }

    /**
     * Updates the styles of the  given objects, or all objects if unspecified.
     * @param objects - The objects to update.
     */
    updateStyles(objects?: (SimpleGeometryMesh<MeshUserData> | SurfaceMesh<MeshUserData>)[]) {
        if (objects != null) {
            objects.forEach(obj => {
                if (obj.userData.parentEntity === this) {
                    this.updateStyle(getRootMesh(obj));
                }
            });
        } else {
            const cachedList = this.getCachedList();

            cachedList.forEach(obj => this.updateStyle(obj));
        }

        // Make sure new materials have the correct opacity
        this.updateOpacity();

        this.notifyChange(this);
    }

    private updateStyle(obj: SimpleGeometryMesh<MeshUserData> | null) {
        if (!obj) {
            return;
        }

        const feature = obj.userData.feature as Feature;
        const style = this.getStyle(feature);

        const commonOptions: BaseOptions = {
            origin: obj.position,
            ignoreZ: this._ignoreZ,
        };

        switch (obj.type) {
            case 'PointMesh':
                this._geometryConverter.updatePointMesh(obj as PointMesh<MeshUserData>, {
                    ...commonOptions,
                    ...style?.point,
                });
                break;
            case 'PolygonMesh':
            case 'MultiPolygonMesh':
                {
                    const elevation =
                        typeof this._elevation === 'function'
                            ? this._elevation(feature)
                            : this._elevation;

                    const extrusionOffset =
                        typeof this._extrusionOffset === 'function'
                            ? this._extrusionOffset(feature)
                            : this._extrusionOffset;

                    const options = {
                        ...commonOptions,
                        ...style,
                        extrusionOffset,
                        elevation,
                    };
                    if (isPolygonMesh(obj)) {
                        this._geometryConverter.updatePolygonMesh(obj, options);
                    } else if (isMultiPolygonMesh(obj)) {
                        this._geometryConverter.updateMultiPolygonMesh(obj, options);
                    }
                }
                break;
            case 'LineStringMesh':
                this._geometryConverter.updateLineStringMesh(obj as LineStringMesh<MeshUserData>, {
                    ...commonOptions,
                    ...style?.stroke,
                });
                break;
            case 'MultiLineStringMesh':
                this._geometryConverter.updateMultiLineStringMesh(
                    obj as MultiLineStringMesh<MeshUserData>,
                    {
                        ...commonOptions,
                        ...style?.stroke,
                    },
                );
                break;
        }

        // Since changing the style of the feature might create additional objects,
        // we have to use this method again.
        this.prepare(obj, feature, style);
    }

    // We override this because the render order of the features depends on their style,
    // so we have to cumulate that with the render order of the entity.
    protected override assignRenderOrder(obj: Object3D) {
        const renderOrder = this.renderOrder;

        // Note that the final render order of the mesh is the sum of
        // the entity's render order and the style's render order(s).
        if (isSurfaceMesh<MeshUserData>(obj)) {
            const relativeRenderOrder = obj.userData.style?.fill?.renderOrder ?? 0;
            obj.renderOrder = renderOrder + relativeRenderOrder;
        } else if (isLineStringMesh<MeshUserData>(obj)) {
            const relativeRenderOrder = obj.userData.style?.stroke?.renderOrder ?? 0;
            obj.renderOrder = renderOrder + relativeRenderOrder;
        } else if (isPointMesh<MeshUserData>(obj)) {
            const relativeRenderOrder = obj.userData.style?.point?.renderOrder ?? 0;
            obj.renderOrder = renderOrder + relativeRenderOrder;
        }
    }

    private prepare(
        mesh: SimpleGeometryMesh<MeshUserData>,
        feature: Feature,
        style: FeatureStyle | null,
    ) {
        mesh.traverse(obj => {
            obj.userData.feature = feature;
            obj.userData.style = style;

            this.assignRenderOrder(obj);
        });
    }

    private getStyle(feature: Feature): FeatureStyle | null {
        if (typeof this._style === 'function') {
            return this._style(feature);
        }
        return this._style;
    }

    override updateRenderOrder(): void {
        this.traverseMeshes(mesh => {
            this.assignRenderOrder(mesh);
        });
    }

    override updateOpacity(): void {
        // We have to overload the method because we don't want to replace
        // materials' opacity with feature opacity. Instead, we want to combine them.
        this.traverseGeometries(mesh => {
            mesh.opacity = this.opacity;
        });
    }

    traverseGeometries(callback: (geom: SimpleGeometryMesh<MeshUserData>) => void) {
        this.traverse(obj => {
            if (isSimpleGeometryMesh<MeshUserData>(obj)) {
                callback(obj);
            }
        });
    }

    private getCacheKey(node: FeatureTile): string {
        return `${this.id} - ${node.uuid}`;
    }

    private processFeatures(
        features: Feature<Geometry>[],
        node: FeatureTile,
    ): SimpleGeometryMesh<MeshUserData>[] | null {
        // if the node is not visible any more, don't bother
        if (!node.visible) {
            return null;
        }

        if (features.length === 0) {
            return null;
        }

        if (!node.parent) {
            // node have been removed before we got the result, cancelling
            return null;
        }

        const meshes: SimpleGeometryMesh<MeshUserData>[] = [];

        for (const feature of features) {
            let id = feature.get(ID_PROPERTY);
            if (id == null) {
                id = MathUtils.generateUUID();
                // We used to use the Feature.setId() method, but it is atrociously slow
                // as it forces re-indexing the features in the source. Since we don't want
                // that, we use an arbitrary property name instead.
                // https://gitlab.com/giro3d/giro3d/-/issues/543
                feature.set(ID_PROPERTY, id);
            }

            if (this._tileIdSet.has(id)) {
                continue;
            }

            const geom = feature.getGeometry();

            if (!geom) {
                continue;
            }

            const style = typeof this._style === 'function' ? this._style(feature) : this._style;

            const type = geom.getType();

            let mesh: SimpleGeometryMesh<MeshUserData> | null = null;

            const commonOptions = { ignoreZ: this._ignoreZ };

            switch (type) {
                case 'Point':
                case 'MultiPoint':
                    mesh = this._geometryConverter.build(geom as Point | MultiPoint, {
                        ...commonOptions,
                        ...style?.point,
                    });
                    break;
                case 'LineString':
                case 'MultiLineString':
                    mesh = this._geometryConverter.build(geom as LineString | MultiLineString, {
                        ...commonOptions,
                        ...style?.stroke,
                    });
                    break;
                case 'Polygon':
                case 'MultiPolygon':
                    {
                        const elevation =
                            typeof this._elevation === 'function'
                                ? this._elevation(feature)
                                : this._elevation;

                        const extrusionOffset =
                            typeof this._extrusionOffset === 'function'
                                ? this._extrusionOffset(feature)
                                : this._extrusionOffset;

                        mesh = this._geometryConverter.build(geom as Polygon | MultiPolygon, {
                            ...commonOptions,
                            fill: style?.fill,
                            stroke: style?.stroke,
                            elevation,
                            extrusionOffset,
                        });
                    }
                    break;
                case 'LinearRing':
                case 'GeometryCollection':
                case 'Circle':
                    // TODO
                    break;
            }

            if (mesh) {
                mesh.userData.feature = feature;
                meshes.push(mesh);
                this.prepare(mesh, feature, style);
            }
        }

        GlobalCache.set(this.getCacheKey(node), meshes, { ttl: CACHE_TTL });

        return meshes;
    }

    private loadFeatures(
        extent: Extent,
        resolve: (features: Feature[]) => void,
        reject: (error: Error) => void,
    ) {
        const olExtent = OLUtils.toOLExtent(extent);
        const resolution: number | undefined = undefined;

        // @ts-expect-error loader_ is private
        this._source.loader_(olExtent, resolution, this._targetProjection, resolve, reject);
    }

    private async getMeshesWithCache(
        node: FeatureTile,
    ): Promise<SimpleGeometryMesh<MeshUserData>[] | null> {
        const cacheKey = this.getCacheKey(node);
        const cachedFeatures = GlobalCache.get(cacheKey) as SimpleGeometryMesh<MeshUserData>[];

        if (cachedFeatures != null) {
            return Promise.resolve(cachedFeatures);
        }

        const request = () =>
            new Promise<Feature[]>((resolve, reject) => {
                let extent = node.userData.extent;
                if (this.dataProjection != null) {
                    extent = extent.as(this.dataProjection);
                }

                this.loadFeatures(extent, resolve, reject);
            });

        const features = await DefaultQueue.enqueue({
            id: node.uuid, // we only make one query per "tile"
            request,
            priority: performance.now(), // Last in first out, like in Layer.js
            shouldExecute: () => node.visible,
        });

        return this.processFeatures(features, node);
    }

    private disposeTile(tile: FeatureTile) {
        tile.dispose(this._tileIdSet);
        this._rootMeshes.length = 0;
    }

    update(ctx: Context, tile: FeatureTile) {
        if (!tile.parent) {
            this.disposeTile(tile);

            return null;
        }

        // Are we visible ?
        if (!this.frozen) {
            const isVisible = ctx.view.isBox3Visible(tile.boundingBox, tile.matrixWorld);
            tile.visible = isVisible;
        }

        // if not visible we can stop early
        if (!tile.visible) {
            this.disposeTile(tile);
            return null;
        }

        this.updateMinMaxDistance(ctx.distance.plane, tile);

        // Do we need stuff for ourselves?
        const ts = Date.now();

        // we are in the z range and we can try an update
        if (
            tile.userData.z <= this.maxLevel &&
            tile.userData.z >= this.minLevel &&
            tile.userData.layerUpdateState.canTryUpdate(ts)
        ) {
            tile.userData.layerUpdateState.newTry();

            this._opCounter.increment();

            this.getMeshesWithCache(tile)
                .then(meshes => {
                    // if request return empty json, result will be null
                    if (meshes) {
                        if (
                            tile.children.filter(
                                n => n.userData.parentEntity === this && !isFeatureTile(n),
                            ).length > 0
                        ) {
                            console.warn(
                                `We received results for this tile: ${tile},` +
                                    'but it already contains children for the current entity.',
                            );
                        }

                        if (meshes.length > 0) {
                            tile.boundingBox.makeEmpty();
                        }

                        for (const mesh of meshes) {
                            const id = nonNull(mesh.userData.feature?.get(ID_PROPERTY));

                            if (!this._tileIdSet.has(id) || id == null) {
                                this._tileIdSet.add(id);

                                tile.add(mesh);
                                this.onObjectCreated(mesh);

                                tile.boundingBox.expandByObject(mesh);
                                this.notifyChange(tile);
                            }
                        }
                        tile.userData.layerUpdateState.noMoreUpdatePossible();
                    } else {
                        tile.userData.layerUpdateState.failure(1, true);
                    }
                })
                .catch(err => {
                    // Abort errors are perfectly normal, so we don't need to log them.
                    // However any other error implies an abnormal termination of the processing.
                    if (err?.name === 'AbortError') {
                        // the query has been aborted because Giro3D thinks it doesn't need this any
                        // more, so we put back the state to IDLE
                        tile.userData.layerUpdateState.success();
                    } else {
                        console.error(err);
                        tile.userData.layerUpdateState.failure(Date.now(), true);
                    }
                })
                .finally(() => {
                    this._rootMeshes.length = 0;
                    this._opCounter.decrement();
                });
        }

        // Do we need children ?
        let requestChildrenUpdate = false;

        if (!this.frozen) {
            const s = tile.boundingBox.getSize(vector);
            const sse = ScreenSpaceError.computeFromBox3(
                ctx.view,
                tile.boundingBox,
                tile.matrixWorld,
                Math.max(s.x, s.y),
                ScreenSpaceError.Mode.MODE_2D,
            );

            if (this.testTileSSE(tile, sse)) {
                this.subdivideNode(ctx, tile);
                setNodeContentVisible(tile, false);
                requestChildrenUpdate = true;
            } else {
                setNodeContentVisible(tile, true);
            }
        } else {
            requestChildrenUpdate = true;
        }

        // update uniforms
        if (!requestChildrenUpdate) {
            const toClean = [];
            for (const child of tile.children.filter(c => isFeatureTile(c))) {
                tile.remove(child);
                toClean.push(child);
            }
            return toClean;
        }

        return requestChildrenUpdate ? tile.children.filter(c => isFeatureTile(c)) : undefined;
    }

    private subdivideNode(context: Context, node: FeatureTile) {
        if (!node.children.some(n => n.userData.parentEntity === this)) {
            const extents = node.userData.extent.split(2, 2);

            let i = 0;
            const { x, y, z } = node.userData;
            for (const extent of extents) {
                let child;
                if (i === 0) {
                    child = this.buildNewTile(extent, z + 1, 2 * x + 0, 2 * y + 0);
                } else if (i === 1) {
                    child = this.buildNewTile(extent, z + 1, 2 * x + 0, 2 * y + 1);
                } else if (i === 2) {
                    child = this.buildNewTile(extent, z + 1, 2 * x + 1, 2 * y + 0);
                } else {
                    child = this.buildNewTile(extent, z + 1, 2 * x + 1, 2 * y + 1);
                }
                node.add(child);

                child.updateMatrixWorld(true);
                i++;
            }
            this.notifyChange(node);
        }
    }

    private testTileSSE(tile: Group, sse: SSE | null) {
        if (this.maxLevel >= 0 && this.maxLevel <= tile.userData.z) {
            return false;
        }

        if (!sse) {
            return true;
        }

        // the ratio is how much the tile appears compared to its real size. If you see it from the
        // side, the ratio is low. If you see it from above, the ratio is 1
        // lengths times ratio gives a normalized size
        // I don't exactly know what lengths contains, you have to understand
        // ScreenSpaceError.computeSSE for that :-) but I *think* it contains the real dimension of
        // the tile on screen. I'm really not sure though.
        // I don't know why we multiply the ratio
        const values = [sse.lengths.x * sse.ratio, sse.lengths.y * sse.ratio];

        // if one of the axis is too small on the screen, the test fail and we don't subdivise
        // sseScale allows to customize this at the entity level
        // 100 *might* be because  values are percentage?
        if (values.filter(v => v < 100 * tile.userData.parentEntity.sseScale).length >= 1) {
            return false;
        }
        // this is taken from Map: there, the subdivision follows the same logic as openlayers:
        // subdividing when a tile reach 384px (assuming you're looking at it top-down of course, in
        // 3D it's different).
        // For Features, it makes less sense, but it "works". We might want to revisit that later,
        // especially because this and the sseThreshold are not easy to use for developers.
        return values.filter(v => v >= 384 * tile.userData.parentEntity.sseScale).length >= 2;
    }

    dispose(): void {
        this._geometryConverter.dispose({ disposeMaterials: true, disposeTextures: true });
        this.traverseMeshes(mesh => {
            mesh.geometry.dispose();
        });
    }

    private updateMinMaxDistance(cameraPlane: Plane, node: FeatureTile) {
        if (node.boundingBox != null) {
            const bbox = node.boundingBox.clone().applyMatrix4(node.matrixWorld);
            const distance = cameraPlane.distanceToPoint(bbox.getCenter(vector));
            const radius = bbox.getSize(vector).length() * 0.5;
            this._distance.min = Math.min(this._distance.min, distance - radius);
            this._distance.max = Math.max(this._distance.max, distance + radius);
        }
    }
}

export default FeatureCollection;
