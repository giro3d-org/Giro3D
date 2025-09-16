import type Feature from 'ol/Feature';

import type { Object3D } from 'three';

import { Box3, Group, Sphere, Vector3 } from 'three';

import type GUI from 'lil-gui';
import { type Coordinate } from 'ol/coordinate';
import { getCenter } from 'ol/extent';
import type { Circle, Point, SimpleGeometry } from 'ol/geom';
import { LineString, MultiLineString, MultiPolygon, Polygon } from 'ol/geom';
import type ElevationProvider from '../core/ElevationProvider';
import type { FeatureExtrusionOffset, FeatureExtrusionOffsetCallback } from '../core/FeatureTypes';
import {
    mapGeometry,
    type FeatureStyle,
    type FeatureStyleCallback,
    type LineMaterialGenerator,
    type PointMaterialGenerator,
    type SurfaceMaterialGenerator,
} from '../core/FeatureTypes';
import type Extent from '../core/geographic/Extent';
import type HasDefaultPointOfView from '../core/HasDefaultPointOfView';
import type Instance from '../core/Instance';
import type PointOfView from '../core/PointOfView';
import EntityInspector from '../gui/EntityInspector';
import EntityPanel from '../gui/EntityPanel';
import type {
    BaseOptions,
    LineOptions,
    PointOptions,
    PolygonOptions,
} from '../renderer/geometries/GeometryConverter';
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
import { computeDistanceToFitSphere, computeZoomToFitSphere } from '../renderer/View';
import type { FeatureSource, FeatureSourceEventMap } from '../sources/FeatureSource';
import OLUtils from '../utils/OpenLayersUtils';
import { isOrthographicCamera, isPerspectiveCamera } from '../utils/predicates';
import { nonNull } from '../utils/tsutils';
import Entity3D from './Entity3D';
import type { MeshUserData } from './FeatureCollection';
import type MapEntity from './Map';
import type { MapEventMap, Tile } from './Map';

const tmpSphere = new Sphere();

/**
 * How the geometry should be draped on the terrain:
 * - `per-feature`: the same elevation offset is applied to the entire feature.
 * Suitable for level geometries, such as buildings, lakes, etc.
 * - `per-vertex`: the elevation is applied to each vertex independently. Suitable for
 * lines that must follow the terrain, such as roads.
 * - `none`: no draping is done, the elevation of the feature is used as is. Suitable for
 * geometries that should not be draped on the terrain, such as flight paths or flying objects.
 *
 * Note: that `Point` geometries, having only one coordinate, will automatically use the `per-feature` mode.
 */
export type DrapingMode = 'per-feature' | 'per-vertex' | 'none';

/**
 * A function to determine the {@link DrapingMode} for each feature.
 */
export type DrapingModeFunction = (feature: Feature) => DrapingMode;

/**
 * This callback can be used to generate elevation for a given OpenLayer
 * [Feature](https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html) (typically from its properties).
 *
 * - If a single number is returned, it will be used for all vertices in the geometry.
 * - If an array is returned, each value will be used to determine the height of the corresponding vertex in the geometry.
 * Note that the cardinality of the array must be the same as the number of vertices in the geometry.
 */
export type DrapedFeatureElevationCallback = (
    feature: Feature,
    elevationProvider: ElevationProvider,
) => { geometry: SimpleGeometry; verticalOffset: number; mustReplace: boolean };

/**
 * Either returns the same geometry if it already has a XYZ layout, or create an equivalent geometry in the XYZ layout.
 */
function cloneAsXYZIfRequired<G extends Polygon | LineString | MultiLineString | MultiPolygon>(
    geometry: G,
): G {
    if (geometry.getLayout() === 'XYZ') {
        // No need to clone.
        return geometry;
    }

    const stride = geometry.getStride();

    const vertexCount = geometry.getFlatCoordinates().length / stride;
    const flat = new Array<number>(vertexCount * 3);

    switch (geometry.getType()) {
        case 'LineString':
            return new LineString(flat, 'XYZ') as G;
        case 'Polygon': {
            const ends = (geometry as Polygon).getEnds().map(end => (end / stride) * 3);
            return new Polygon(flat, 'XYZ', ends) as G;
        }
        case 'MultiLineString': {
            const ends = (geometry as MultiLineString).getEnds().map(end => (end / stride) * 3);
            return new MultiLineString(flat, 'XYZ', ends) as G;
        }
        case 'MultiPolygon': {
            const endss = (geometry as MultiPolygon)
                .getEndss()
                .map(ends => ends.map(end => (end / stride) * 3));
            return new MultiPolygon(flat, 'XYZ', endss) as G;
        }
    }

    throw new Error();
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

function getFeatureElevation(
    feature: Feature,
    geometry: SimpleGeometry,
    provider: ElevationProvider,
) {
    let center: Coordinate;

    if (geometry.getType() === 'Point') {
        center = (geometry as Point).getCoordinates();
    } else if (geometry.getType() === 'Circle') {
        center = (geometry as Circle).getCenter();
    } else {
        center = getCenter(geometry.getExtent());
    }

    const [x, y] = center;

    const sample = provider.getElevationFast(x, y);

    return sample?.elevation ?? 0;
}

function applyPerVertexDraping(
    geometry: Polygon | LineString | MultiLineString | MultiPolygon,
    provider: ElevationProvider,
) {
    const coordinates = geometry.getFlatCoordinates();
    const stride = geometry.getStride();

    // We have to possibly clone the geometry because OpenLayers does
    // not allow changing the layout of an existing geometry, leading to issues.
    const clone = cloneAsXYZIfRequired(geometry.clone());
    const coordinateCount = coordinates.length / stride;
    const xyz = new Array<number>(coordinateCount * 3);

    let k = 0;

    for (let i = 0; i < coordinates.length; i += stride) {
        const x = coordinates[i + 0];
        const y = coordinates[i + 1];

        const sample = provider.getElevationFast(x, y);

        const z = sample?.elevation ?? 0;

        xyz[k + 0] = x;
        xyz[k + 1] = y;
        xyz[k + 2] = z;

        k += 3;
    }

    clone.setFlatCoordinates('XYZ', xyz);

    return clone;
}

export const defaultElevationCallback: DrapedFeatureElevationCallback = (feature, provider) => {
    let result: ReturnType<DrapedFeatureElevationCallback>;

    const perFeature: (geometry: SimpleGeometry) => void = geometry => {
        let center: Coordinate;

        if (geometry.getType() === 'Point') {
            center = (geometry as Point).getCoordinates();
        } else if (geometry.getType() === 'Circle') {
            center = (geometry as Circle).getCenter();
        } else {
            center = getCenter(geometry.getExtent());
        }

        const [x, y] = center;

        const sample = provider.getElevationFast(x, y);

        result = {
            verticalOffset: sample?.elevation ?? 0,
            geometry,
            mustReplace: false,
        };
    };

    const perVertex: (
        geometry: Polygon | LineString | MultiLineString | MultiPolygon,
    ) => void = geometry => {
        const coordinates = geometry.getFlatCoordinates();
        const stride = geometry.getStride();

        // We have to possibly clone the geometry because OpenLayers does
        // not allow changing the layout of an existing geometry, leading to issues.
        const clone = cloneAsXYZIfRequired(geometry.clone());
        const coordinateCount = coordinates.length / stride;
        const xyz = new Array<number>(coordinateCount * 3);

        let k = 0;

        for (let i = 0; i < coordinates.length; i += stride) {
            const x = coordinates[i + 0];
            const y = coordinates[i + 1];

            const sample = provider.getElevationFast(x, y);

            const z = sample?.elevation ?? 0;

            xyz[k + 0] = x;
            xyz[k + 1] = y;
            xyz[k + 2] = z;

            k += 3;
        }

        clone.setFlatCoordinates('XYZ', xyz);

        // TODO nous avons besoin d'une méthode pour savoir s'il faut remplacer le mesh ou non
        result = {
            verticalOffset: 0,
            geometry: clone,
            mustReplace: true,
        };
    };

    const geometry = nonNull(feature.getGeometry(), 'feature has no geometry') as SimpleGeometry;

    mapGeometry(geometry, {
        processPoint: perFeature,
        processCircle: perFeature,
        processPolygon: perVertex,
        processLineString: perVertex,
        processMultiLineString: perVertex,
        processMultiPolygon: perVertex,
    });

    // TODO
    // @ts-expect-error TODO
    return result;
};

export type DrapedFeatureCollectionOptions = {
    /**
     * The data source.
     */
    source: FeatureSource;
    /**
     * The minimum tile LOD (level of detail) to display the features.
     * If zero, then features are always displayed, since root tiles have LOD zero.
     * @defaultValue 0
     */
    minLod?: number;
    /**
     * How is draping computed for each feature.
     */
    drapingMode?: DrapingMode | DrapingModeFunction;
    /**
     * An style or a callback returning a style to style the individual features.
     * If an object is used, the informations it contains will be used to style every
     * feature the same way. If a function is provided, it will be called with the feature.
     * This allows to individually style each feature.
     */
    style?: FeatureStyle | FeatureStyleCallback;
    /**
     * If set, this will cause 2D features to be extruded of the corresponding amount.
     * If a single value is given, it will be used for all the vertices of every feature.
     * If an array is given, each extruded vertex will use the corresponding value.
     * If a callback is given, it allows to extrude each feature individually.
     */
    extrusionOffset?: FeatureExtrusionOffset | FeatureExtrusionOffsetCallback;
    /**
     * The elevation callback to compute elevations for a feature.
     * @defaultValue {@link defaultElevationCallback}
     */
    elevationCallback?: DrapedFeatureElevationCallback;
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
};

function getStableFeatureId(feature: Feature): string {
    const existing = feature.getId();
    if (existing != null) {
        return existing.toString();
    }
    const fid = feature.get('fid');
    if (fid != null) {
        return `${fid}`;
    }

    throw new Error('not implemented');
}

type EventHandler<T> = (e: T) => void;

type ObjectOptions = {
    castShadow: boolean;
    receiveShadow: boolean;
};

type FeaturesEntry = {
    feature: Feature;
    originalZ: number;
    extent: Extent;
    mesh: SimpleGeometryMesh | undefined;
    sampledLod: number;
}

export default class DrapedFeatureCollection extends Entity3D {
    override type = 'DrapedFeatureCollection' as const;
    readonly isDrapedFeatureCollection = true as const;

    private _map: MapEntity | null = null;

    private readonly _drapingMode: DrapingMode | DrapingModeFunction;
    private readonly _elevationCallback: DrapedFeatureElevationCallback;
    private readonly _geometryConverter: GeometryConverter<MeshUserData>;
    private readonly _activeTiles = new Map<Tile['id'], Tile>();
    private readonly _objectOptions: ObjectOptions = {
        castShadow: false,
        receiveShadow: false,
    };

    private readonly _extrusionCallback:
        | FeatureExtrusionOffset
        | FeatureExtrusionOffsetCallback
        | undefined;
    private readonly _features: Map<string, FeaturesEntry> = new Map();
    private readonly _source: FeatureSource;
    private readonly _eventHandlers: {
        onTileCreated: EventHandler<MapEventMap['tile-created']>;
        onTileDeleted: EventHandler<MapEventMap['tile-deleted']>;
        onElevationLoaded: EventHandler<MapEventMap['tile-deleted']>;
        onSourceUpdated: EventHandler<FeatureSourceEventMap['updated']>;
        onTextureLoaded: () => void;
    };
    private readonly _style: FeatureStyle | FeatureStyleCallback | undefined;

    get loadedFeatures() {
        return this._features.size;
    }

    private _shouldCleanup = false;
    private _sortedTiles: Tile[] | null = null;
    private _minLod = 0;

    get minLod() {
        return this._minLod;
    }

    set minLod(v: number) {
        this._minLod = v >= 0 ? v : 0;
    }

    constructor(options: DrapedFeatureCollectionOptions) {
        super(new Group());

        this._drapingMode = options.drapingMode ?? 'per-vertex';
        this._extrusionCallback = options.extrusionOffset;
        this._source = options.source;
        this._style = options.style;
        this._minLod = options.minLod ?? this._minLod;
        this._elevationCallback = options.elevationCallback ?? defaultElevationCallback;

        this._eventHandlers = {
            onTileCreated: this.onTileCreated.bind(this),
            onTileDeleted: this.onTileDeleted.bind(this),
            onElevationLoaded: this.onElevationLoaded.bind(this),
            onTextureLoaded: this.notifyChange.bind(this),
            onSourceUpdated: this.onSourceUpdated.bind(this),
        };

        this._geometryConverter = new GeometryConverter<MeshUserData>({
            shadedSurfaceMaterialGenerator: options.shadedSurfaceMaterialGenerator,
            unshadedSurfaceMaterialGenerator: options.unshadedSurfaceMaterialGenerator,
            lineMaterialGenerator: options.lineMaterialGenerator,
            pointMaterialGenerator: options.pointMaterialGenerator,
        });

        this._geometryConverter.addEventListener(
            'texture-loaded',
            this._eventHandlers.onTextureLoaded,
        );

        this._source.addEventListener('updated', this._eventHandlers.onSourceUpdated);
    }

    traverseGeometries(callback: (geom: SimpleGeometryMesh<MeshUserData>) => void) {
        this.traverse(obj => {
            if (isSimpleGeometryMesh<MeshUserData>(obj)) {
                callback(obj);
            }
        });
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
            this._features.forEach(v => {
                if (v.mesh) {
                    this.updateStyle(v.mesh);
                }
            });
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
            // TODO
            // ignoreZ: draping === 'none',
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
                    // TODO
                    // const elevation =
                    //     typeof this._elevation === 'function'
                    //         ? this._elevation(feature)
                    //         : this._elevation;

                    const extrusionOffset = this.getExtrusionOffset(feature);

                    const options = {
                        ...commonOptions,
                        ...style,
                        extrusionOffset,
                        // elevation, // TODO
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

    private updateObjectOption<K extends keyof ObjectOptions>(key: K, value: ObjectOptions[K]) {
        if (this._objectOptions[key] !== value) {
            this._objectOptions[key] = value;
            this.traverseGeometries(mesh => {
                mesh.traverse(obj => {
                    obj.castShadow = this._objectOptions.castShadow;
                    obj.receiveShadow = this._objectOptions.receiveShadow;
                });
            });
            this.notifyChange(this);
        }
    }

    /**
     * Toggles the `.castShadow` property on objects generated by this entity.
     *
     * Note: shadow maps require normal attributes on objects.
     */
    get castShadow() {
        return this._objectOptions.castShadow;
    }

    set castShadow(v: boolean) {
        this.updateObjectOption('castShadow', v);
    }

    /**
     * Toggles the `.receiveShadow` property on objects generated by this entity.
     *
     * Note: shadow maps require normal attributes on objects.
     */
    get receiveShadow() {
        return this._objectOptions.receiveShadow;
    }

    set receiveShadow(v: boolean) {
        this.updateObjectOption('receiveShadow', v);
    }

    private onSourceUpdated() {
        this._features.forEach(v => {
            v.mesh?.dispose();
            v.mesh?.removeFromParent();
        });

        this._features.clear();

        for (const tile of [...this._activeTiles.values()]) {
            this.registerTile(tile, true);
        }
    }

    override async preprocess() {
        await this._source.initialize({ targetCoordinateSystem: this.instance.coordinateSystem });
    }

    attach(map: MapEntity): this {
        if (this._map != null) {
            throw new Error('a map is already attached to this entity');
        }

        this._map = map;

        map.addEventListener('tile-created', this._eventHandlers.onTileCreated);
        map.addEventListener('tile-deleted', this._eventHandlers.onTileDeleted);
        map.addEventListener('elevation-loaded', this._eventHandlers.onElevationLoaded);

        // TODO register trop tôt avant que l'élévation soit prête
        map.traverseTiles(tile => {
            this.registerTile(tile);
        });

        return this;
    }

    private getSortedTiles() {
        if (this._sortedTiles == null) {
            this._sortedTiles = [...this._activeTiles.values()];
            this._sortedTiles.sort((t0, t1) => t0.lod - t1.lod);
        }

        return this._sortedTiles;
    }

    detach(): this {
        if (this._map == null) {
            throw new Error('no map is attached to this entity');
        }

        this._map.removeEventListener('tile-created', this._eventHandlers.onTileCreated);
        this._map.removeEventListener('tile-deleted', this._eventHandlers.onTileDeleted);
        this._map.removeEventListener('elevation-loaded', this._eventHandlers.onElevationLoaded);

        this._map.traverseTiles(tile => {
            this.unregisterTile(tile);
        });

        this._map = null;
        return this;
    }

    override updateVisibility() {
        super.updateVisibility();
        if (this.visible && this._map) {
            this._map.traverseTiles(tile => {
                this.registerTile(tile);
            });
        }
    }

    private onTileCreated({ tile }: MapEventMap['tile-created']) {
        this.registerTile(tile);
    }

    private onTileDeleted({ tile }: MapEventMap['tile-deleted']) {
        this.unregisterTile(tile);
    }

    private onElevationLoaded({ tile }: MapEventMap['elevation-loaded']) {
        this.registerTile(tile, true);
    }

    private registerTile(tile: Tile, forceRecreateMeshes = false) {
        if (!this.visible) {
            return;
        }
        if (!this._activeTiles.has(tile.id) || forceRecreateMeshes) {
            this._activeTiles.set(tile.id, tile);
            this._sortedTiles = null;

            if (tile.lod >= this._minLod) {
                this.loadFeaturesOnExtent(tile.extent).then(features => {
                    if (this._activeTiles.has(tile.id)) {
                        this.loadMeshes(features, tile.lod);
                    }
                });
            }
        }
    }

    private loadMeshes(features: Readonly<Feature[]>, lod: number) {
        for (const feature of features) {

            const geometry = feature.getGeometry();

            if (geometry) {
                const id = getStableFeatureId(feature);
                if (!this._features.has(id)) {
                    const extent = OLUtils.fromOLExtent(
                        geometry.getExtent(),
                        this.instance.coordinateSystem,
                    );

                    this._features.set(id, { feature, mesh: undefined, originalZ: 0, extent, sampledLod: lod });
                }
                const existing = nonNull(this._features.get(id));

                if (!existing.mesh || existing.sampledLod < lod) {
                    this.loadFeatureMesh(id, existing);
                    existing.sampledLod = lod;
                }
            }
        }

        this.notifyChange();
    }

    private prepare(
        mesh: SimpleGeometryMesh<MeshUserData>,
        feature: Feature,
        style: FeatureStyle | undefined,
    ) {
        mesh.traverse(obj => {
            obj.userData.feature = feature;
            obj.userData.style = style;
            obj.castShadow = this._objectOptions.castShadow;
            obj.receiveShadow = this._objectOptions.receiveShadow;

            this.assignRenderOrder(obj);
        });
    }

    private getPointOptions(style?: FeatureStyle): PointOptions {
        const pointStyle = style?.point;

        return {
            color: pointStyle?.color,
            pointSize: pointStyle?.pointSize,
            renderOrder: pointStyle?.renderOrder,
            sizeAttenuation: pointStyle?.sizeAttenuation,
            depthTest: pointStyle?.depthTest,
            image: pointStyle?.image,
            opacity: pointStyle?.opacity,
        };
    }

    private getExtrusionOffset(feature: Feature) {
        let extrusionOffset: FeatureExtrusionOffset | undefined = undefined;
        if (this._extrusionCallback != null) {
            extrusionOffset =
                typeof this._extrusionCallback === 'function'
                    ? this._extrusionCallback(feature)
                    : this._extrusionCallback;
        }

        return extrusionOffset;
    }

    private getPolygonOptions(feature: Feature, style?: FeatureStyle): PolygonOptions {
        return {
            fill: style?.fill,
            stroke: style?.stroke,
            extrusionOffset: this.getExtrusionOffset(feature),
        };
    }

    // TODO gérer l'élévation sur les lignes
    private getLineOptions(style?: FeatureStyle): LineOptions {
        return {
            ...style?.stroke,
        };
    }

    private getStyle(feature: Feature): FeatureStyle | undefined {
        if (typeof this._style === 'function') {
            return this._style(feature);
        }
        return this._style;
    }

    private createMesh(feature: Feature, geometry: SimpleGeometry): SimpleGeometryMesh | undefined {
        const style = this.getStyle(feature);

        const converter = this._geometryConverter;

        const result = mapGeometry<SimpleGeometryMesh>(geometry, {
            processPoint: p => converter.build(p, this.getPointOptions(style)),
            processPolygon: p => converter.build(p, this.getPolygonOptions(feature, style)),
            processLineString: p => converter.build(p, this.getLineOptions(style)),
            processMultiPolygon: p => converter.build(p, this.getPolygonOptions(feature, style)),
            processMultiLineString: p => converter.build(p, this.getLineOptions(style)),
            // TODO faire le reste:
        });

        if (result) {
            this.prepare(result, feature, style);
        }

        return result;
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

    private getDrapingMode(feature: Feature): DrapingMode {
        if (typeof this._drapingMode === 'function') {
            return this._drapingMode(feature);
        }

        return this._drapingMode;
    }

    private loadFeatureMesh(id: string, existing: FeaturesEntry) {
        // TODO filter non compatible geometries
        const geometry = existing.feature.getGeometry() as SimpleGeometry;

        const drapingMode = this.getDrapingMode(existing.feature);

        let actualGeometry: SimpleGeometry = geometry;
        let shouldReplaceMesh = false;
        let verticalOffset = 0;

        if (
            drapingMode === 'per-feature' ||
            (drapingMode === 'per-vertex' && geometry.getType() === 'Point')
        ) {
            // Note that point is necessarily per feature, since there is only one vertex
            actualGeometry = geometry;
            verticalOffset = getFeatureElevation(existing.feature, geometry, nonNull(this._map));
        } else if (drapingMode === 'per-vertex') {
            shouldReplaceMesh = true;
            // TODO support multipoint ?
            // @ts-expect-error cast
            actualGeometry = applyPerVertexDraping(geometry, this._map);
        }

        // // TODO doit-on supporter plusieurs maps ?
        // // TODO Callback de récupération de l'élévation
        // const processed = this._elevationCallback(feature, this._maps[0]);

        // We have to entirely recreate the mesh because
        // the vertices will have different elevations
        if (shouldReplaceMesh && existing.mesh) {
            existing.mesh.dispose();
            existing.mesh.removeFromParent();
            existing.mesh = undefined;
        }

        // The mesh needs to be (re)created
        if (existing.mesh == undefined) {
            const newMesh = this.createMesh(existing.feature, actualGeometry);
            existing.originalZ = newMesh?.position.z ?? 0;
            if (newMesh) {
                existing.mesh = newMesh;
                existing.mesh.name = id;
                this.object3d.add(existing.mesh);
            }
        }

        if (existing.mesh) {
            // When a single elevation value is applied to the entire mesh,
            // then we can simply translate the Mesh itself, rather than recreate it.
            if (verticalOffset !== 0) {
                existing.mesh.position.setZ(existing.originalZ + verticalOffset);
            }

            existing.mesh.updateMatrix();
            existing.mesh.updateMatrixWorld(true);
        }
    }

    private unregisterTile(tile: Tile) {
        const actuallyDeleted = this._activeTiles.delete(tile.id);

        if (actuallyDeleted) {
            this._sortedTiles = null;
            this._shouldCleanup = true;
            this.notifyChange(this);
        }
    }

    private async loadFeaturesOnExtent(extent: Extent): Promise<readonly Feature[]> {
        const result = await this._source.getFeatures({ extent });

        return result.features;
    }

    override postUpdate(): void {
        if (this._shouldCleanup) {
            this._shouldCleanup = false;

            this.cleanup();
        }
    }

    cleanup() {
        const sorted = this.getSortedTiles();
        const features = [...this._features.values()];

        for (const block of features) {
            let stillUsed = false;
            for (const tile of sorted) {
                if (tile.lod >= this._minLod && tile.extent.intersectsExtent(block.extent)) {
                    stillUsed = true;
                    break;
                }
            }

            if (!stillUsed && block.mesh) {
                block.mesh.dispose();
                block.mesh.removeFromParent();
                block.mesh = undefined;
            }
        }
    }

    override getDefaultPointOfView({
        camera,
    }: Parameters<HasDefaultPointOfView['getDefaultPointOfView']>[0]): ReturnType<
        HasDefaultPointOfView['getDefaultPointOfView']
    > {
        const bounds = new Box3().setFromObject(this.object3d);
        const sphere = bounds.getBoundingSphere(tmpSphere);

        let orthographicZoom = 1;
        let distance: number;

        if (isOrthographicCamera(camera)) {
            orthographicZoom = computeZoomToFitSphere(camera, sphere.radius);
            // In orthographic camera, the actual distance has no effect on the size
            // of objects, but it does have an effect on clipping planes.
            // Let's compute a reasonable distance to put the camera.
            distance = sphere.radius;
        } else if (isPerspectiveCamera(camera)) {
            distance = computeDistanceToFitSphere(camera, sphere.radius);
        } else {
            return null;
        }

        // To avoid a perfectly vertical camera axis that would cause a gimbal lock.
        const VERTICAL_OFFSET = 0.01;
        const origin = new Vector3(sphere.center.x, sphere.center.y - VERTICAL_OFFSET, distance);
        const target = sphere.center;

        const result: PointOfView = { origin, target, orthographicZoom };

        return Object.freeze(result);
    }

    override dispose() {
        this.detach();
        this._geometryConverter.dispose({ disposeMaterials: true, disposeTextures: true });
        this.traverseMeshes(mesh => {
            mesh.geometry.dispose();
        });
    }
}

class DrapedFeatureCollectionInspector extends EntityInspector<DrapedFeatureCollection> {
    constructor(gui: GUI, instance: Instance, entity: DrapedFeatureCollection) {
        super(gui, instance, entity);

        this.addController(entity, 'loadedFeatures');
    }
}

EntityPanel.registerInspector('DrapedFeatureCollection', DrapedFeatureCollectionInspector);
