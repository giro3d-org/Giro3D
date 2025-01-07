import {
    Box3,
    Color,
    FrontSide,
    Group,
    MathUtils,
    Matrix4,
    Quaternion,
    Raycaster,
    UnsignedByteType,
    Vector2,
    Vector3,
    type ColorRepresentation,
    type Intersection,
    type Object3D,
    type Side,
    type TextureDataType,
    type Camera as ThreeCamera,
} from 'three';

import type ColorimetryOptions from '../core/ColorimetryOptions';
import { defaultColorimetryOptions } from '../core/ColorimetryOptions';
import type ColorMap from '../core/ColorMap';
import type Context from '../core/Context';
import type ContourLineOptions from '../core/ContourLineOptions';
import type ElevationProvider from '../core/ElevationProvider';
import type ElevationRange from '../core/ElevationRange';
import Coordinates from '../core/geographic/Coordinates';
import type Extent from '../core/geographic/Extent';
import type GetElevationOptions from '../core/GetElevationOptions';
import type GetElevationResult from '../core/GetElevationResult';
import type GraticuleOptions from '../core/GraticuleOptions';
import type HillshadingOptions from '../core/HillshadingOptions';
import ColorLayer, { isColorLayer } from '../core/layer/ColorLayer';
import ElevationLayer, { isElevationLayer } from '../core/layer/ElevationLayer';
import type HasLayers from '../core/layer/HasLayers';
import Layer from '../core/layer/Layer';
import type MemoryUsage from '../core/MemoryUsage';
import { type GetMemoryUsageContext } from '../core/MemoryUsage';
import type Pickable from '../core/picking/Pickable';
import type PickableFeatures from '../core/picking/PickableFeatures';
import { isPickableFeatures } from '../core/picking/PickableFeatures';
import traversePickingCircle from '../core/picking/PickingCircle';
import type PickOptions from '../core/picking/PickOptions';
import pickTilesAt, { type MapPickResult } from '../core/picking/PickTilesAt';
import type { SSE } from '../core/ScreenSpaceError';
import ScreenSpaceError from '../core/ScreenSpaceError';
import Capabilities from '../core/system/Capabilities';
import type TerrainOptions from '../core/TerrainOptions';
import {
    DEFAULT_ENABLE_CPU_TERRAIN,
    DEFAULT_ENABLE_STITCHING,
    DEFAULT_ENABLE_TERRAIN,
} from '../core/TerrainOptions';
import type TileGeometry from '../core/TileGeometry';
import TileIndex, { type NeighbourList } from '../core/TileIndex';
import TileMesh, { isTileMesh } from '../core/TileMesh';
import AtlasBuilder, { type AtlasInfo } from '../renderer/AtlasBuilder';
import ColorMapAtlas from '../renderer/ColorMapAtlas';
import LayeredMaterial, {
    DEFAULT_AZIMUTH,
    DEFAULT_GRATICULE_COLOR,
    DEFAULT_GRATICULE_STEP,
    DEFAULT_GRATICULE_THICKNESS,
    DEFAULT_HILLSHADING_INTENSITY,
    DEFAULT_HILLSHADING_ZFACTOR,
    DEFAULT_ZENITH,
    type MaterialOptions,
} from '../renderer/LayeredMaterial';
import type RenderingState from '../renderer/RenderingState';
import TextureGenerator from '../utils/TextureGenerator';
import { nonNull } from '../utils/tsutils';
import type { EntityUserData } from './Entity';
import Entity3D, { type Entity3DEventMap } from './Entity3D';

/**
 * The default background color of maps.
 */
export const DEFAULT_MAP_BACKGROUND_COLOR: ColorRepresentation = '#0a3b59';

/**
 * The default tile subdivision threshold.
 */
export const DEFAULT_SUBDIVISION_THRESHOLD = 1.5;

/**
 * The default number of segments in a map's tile.
 */
export const DEFAULT_MAP_SEGMENTS = 32;

/**
 * Comparison function to order layers.
 */
export type LayerCompareFn = (a: Layer, b: Layer) => number;

const IDENTITY = new Matrix4().identity();

/**
 * A predicate to determine if the given tile can be used as a neighbour for stitching purposes.
 */
function isStitchableNeighbour(neighbour: TileMesh): boolean {
    return (
        !neighbour.disposed &&
        neighbour.visible &&
        neighbour.material.visible &&
        neighbour.material.getElevationTexture() != null
    );
}

/**
 * The maximum supported aspect ratio for the map tiles, before we stop trying to create square
 * tiles. This is a safety measure to avoid huge number of root tiles when the extent is a very
 * elongated rectangle. If the map extent has a greater ratio than this value, the generated tiles
 * will not be square-ish anymore.
 */
const MAX_SUPPORTED_ASPECT_RATIO = 10;

const tmpVector = new Vector3();
const tmpBox3 = new Box3();
const tempNDC = new Vector2();
const tempCanvasCoords = new Vector2();
const tmpSseSizes: [number, number] = [0, 0];
const tmpIntersectList: Intersection<TileMesh>[] = [];
const tmpNeighbours: NeighbourList<TileMesh> = [null, null, null, null, null, null, null, null];

function getContourLineOptions(input?: boolean | ContourLineOptions): Required<ContourLineOptions> {
    if (input == null) {
        // Default values
        return {
            enabled: false,
            thickness: 1,
            interval: 100,
            secondaryInterval: 20,
            color: new Color(0, 0, 0),
            opacity: 1,
        };
    }

    if (typeof input === 'boolean') {
        // Default values
        return {
            enabled: true,
            thickness: 1,
            interval: 100,
            secondaryInterval: 20,
            color: new Color(0, 0, 0),
            opacity: 1,
        };
    }

    return {
        enabled: input.enabled ?? false,
        thickness: input.thickness ?? 1,
        interval: input.interval ?? 100,
        secondaryInterval: input.secondaryInterval ?? 20,
        color: input.color ?? new Color(0, 0, 0),
        opacity: input.opacity ?? 1,
    };
}

function getTerrainOptions(input?: boolean | TerrainOptions): Required<TerrainOptions> {
    if (input == null) {
        // Default values
        return {
            enabled: DEFAULT_ENABLE_TERRAIN,
            stitching: DEFAULT_ENABLE_STITCHING,
            enableCPUTerrain: DEFAULT_ENABLE_CPU_TERRAIN,
        };
    }

    if (typeof input === 'boolean') {
        return {
            enabled: input,
            stitching: DEFAULT_ENABLE_STITCHING,
            enableCPUTerrain: DEFAULT_ENABLE_CPU_TERRAIN,
        };
    }

    return {
        enabled: input.enabled ?? DEFAULT_ENABLE_TERRAIN,
        stitching: input.stitching ?? DEFAULT_ENABLE_STITCHING,
        enableCPUTerrain: input.enableCPUTerrain ?? DEFAULT_ENABLE_CPU_TERRAIN,
    };
}

function getGraticuleOptions(input?: boolean | GraticuleOptions): Required<GraticuleOptions> {
    if (input == null) {
        // Default values
        return {
            enabled: false,
            color: DEFAULT_GRATICULE_COLOR,
            xStep: DEFAULT_GRATICULE_STEP,
            yStep: DEFAULT_GRATICULE_STEP,
            xOffset: 0,
            yOffset: 0,
            thickness: DEFAULT_GRATICULE_THICKNESS,
            opacity: 1,
        };
    }

    if (typeof input === 'boolean') {
        return {
            enabled: input,
            color: DEFAULT_GRATICULE_COLOR,
            xStep: DEFAULT_GRATICULE_STEP,
            yStep: DEFAULT_GRATICULE_STEP,
            xOffset: 0,
            yOffset: 0,
            thickness: DEFAULT_GRATICULE_THICKNESS,
            opacity: 1,
        };
    }

    return {
        enabled: input.enabled ?? true,
        color: input.color ?? DEFAULT_GRATICULE_COLOR,
        thickness: input.thickness ?? DEFAULT_GRATICULE_THICKNESS,
        xStep: input.xStep ?? DEFAULT_GRATICULE_STEP,
        yStep: input.yStep ?? DEFAULT_GRATICULE_STEP,
        xOffset: input.xOffset ?? 0,
        yOffset: input.yOffset ?? 0,
        opacity: input.opacity ?? 1,
    };
}

function getColorimetryOptions(input?: ColorimetryOptions): ColorimetryOptions {
    return input ?? defaultColorimetryOptions();
}

function getHillshadingOptions(input?: boolean | HillshadingOptions): Required<HillshadingOptions> {
    if (input == null) {
        // Default values
        return {
            enabled: false,
            elevationLayersOnly: false,
            intensity: DEFAULT_HILLSHADING_INTENSITY,
            zFactor: DEFAULT_HILLSHADING_ZFACTOR,
            azimuth: DEFAULT_AZIMUTH,
            zenith: DEFAULT_ZENITH,
        };
    }

    if (typeof input === 'boolean') {
        // Default values
        return {
            enabled: true,
            elevationLayersOnly: false,
            intensity: DEFAULT_HILLSHADING_INTENSITY,
            zFactor: DEFAULT_HILLSHADING_ZFACTOR,
            azimuth: DEFAULT_AZIMUTH,
            zenith: DEFAULT_ZENITH,
        };
    }

    return {
        enabled: input.enabled ?? false,
        elevationLayersOnly: input.elevationLayersOnly ?? false,
        azimuth: input.azimuth ?? DEFAULT_AZIMUTH,
        zenith: input.zenith ?? DEFAULT_ZENITH,
        intensity: input.intensity ?? DEFAULT_HILLSHADING_INTENSITY,
        zFactor: input.zFactor ?? DEFAULT_HILLSHADING_ZFACTOR,
    };
}

function selectBestSubdivisions(extent: Extent) {
    const dims = extent.dimensions();
    const ratio = dims.x / dims.y;
    let x = 1;
    let y = 1;
    if (ratio > 1) {
        // Our extent is an horizontal rectangle
        x = Math.min(Math.round(ratio), MAX_SUPPORTED_ASPECT_RATIO);
    } else if (ratio < 1) {
        // Our extent is an vertical rectangle
        y = Math.min(Math.round(1 / ratio), MAX_SUPPORTED_ASPECT_RATIO);
    }

    return { x, y };
}

/**
 * Compute the best image size for tiles, taking into account the extent ratio.
 * In other words, rectangular tiles will have more pixels in their longest side.
 *
 * @param extent - The map extent.
 */
function computeImageSize(extent: Extent) {
    const baseSize = 512;
    const dims = extent.dimensions();
    const ratio = dims.x / dims.y;
    if (Math.abs(ratio - 1) < 0.01) {
        // We have a square tile
        return new Vector2(baseSize, baseSize);
    }

    if (ratio > 1) {
        const actualRatio = Math.min(ratio, MAX_SUPPORTED_ASPECT_RATIO);
        // We have an horizontal tile
        return new Vector2(Math.round(baseSize * actualRatio), baseSize);
    }

    const actualRatio = Math.min(1 / ratio, MAX_SUPPORTED_ASPECT_RATIO);

    // We have a vertical tile
    return new Vector2(baseSize, Math.round(baseSize * actualRatio));
}

function getWidestDataType(layers: Layer[]): TextureDataType {
    // Select the type that can contain all the layers (i.e the widest data type.)
    let currentSize = -1;
    let result: TextureDataType = UnsignedByteType;

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];

        const type = layer.getRenderTargetDataType();
        const size = TextureGenerator.getBytesPerChannel(type);

        if (size > currentSize) {
            currentSize = size;
            result = type;
        }
    }

    return result;
}

export interface MapEventMap extends Entity3DEventMap {
    /** Fires when a the layer ordering changes. */
    'layer-order-changed': unknown;
    /** Fires when a layer is added to the map. */
    'layer-added': { layer: Layer };
    /** Fires when a layer is removed from the map. */
    'layer-removed': { layer: Layer };
    /** Fires when elevation data has changed on a specific extent of the map. */
    'elevation-changed': { extent: Extent };
}

export type MapConstructorOptions = {
    /**
     * The geographic extent of the map.
     *
     * Note: It must have the same CRS as the instance this map will be added to.
     */
    extent: Extent;
    /**
     * Maximum tile depth of the map. If `undefined`, there is no limit to the subdivision
     * of the map.
     * @defaultValue undefined
     */
    maxSubdivisionLevel?: number;
    /**
     * Enables [hillshading](https://earthquake.usgs.gov/education/geologicmaps/hillshades.php).
     * If `undefined` or `false`, hillshading is disabled.
     *
     * Note: hillshading has no effect if the map does not contain an elevation layer.
     * @defaultValue `undefined` (hillshading is disabled)
     */
    hillshading?: boolean | HillshadingOptions;
    /**
     * Enables contour lines. If `undefined` or `false`, contour lines
     * are not displayed.
     *
     * Note: this option has no effect if the map does not contain an elevation layer.
     * @defaultValue `undefined` (contour lines are disabled)
     */
    contourLines?: boolean | ContourLineOptions;
    /**
     * The graticule options.
     * @defaultValue undefined (graticule is disabled).
     */
    graticule?: boolean | GraticuleOptions;
    /**
     * The colorimetry for the whole map.
     * Those are distinct from the individual layers' own colorimetry.
     * @defaultValue undefined
     */
    colorimetry?: ColorimetryOptions;
    /**
     * The number of geometry segments in each map tile.
     * The higher the better. It *must* be power of two between `1` included and `256` included.
     * Note: the number of vertices per tile side is `segments` + 1.
     * @defaultValue {@link DEFAULT_MAP_SEGMENTS}
     */
    segments?: number;
    /**
     * The sidedness of the map surface:
     * - `FrontSide` will only display the "above ground" side of the map (in cartesian maps),
     * or the outer shell of the map (in globe settings).
     * - `BackSide` will only display the "underground" side of the map (in cartesian maps),
     * or the inner shell of the map (in globe settings).
     * - `DoubleSide` will display both sides of the map.
     * @defaultValue `FrontSide`
     */
    side?: Side;
    /**
     * Enable or disable depth testing on materials.
     * @defaultValue true
     */
    depthTest?: boolean;
    /**
     * Options for geometric terrain rendering.
     */
    terrain?: boolean | TerrainOptions;
    /**
     * If `true`, parts of the map that relate to no-data elevation
     * values are not displayed. Note: you should only set this value to `true` if
     * an elevation layer is present, otherwise the map will never be displayed.
     * @defaultValue false
     */
    discardNoData?: boolean;
    /**
     * The optional `Object3D` to use as the root object of this map.
     * If none provided, a new one will be created.
     */
    object3d?: Object3D;
    /**
     * The color of the map when no color layers are present.
     * @defaultValue {@link DEFAULT_MAP_BACKGROUND_COLOR}
     */
    backgroundColor?: ColorRepresentation;
    /**
     * The opacity of the map background.
     * @defaultValue 1 (opaque)
     */
    backgroundOpacity?: number;
    /**
     * Show the map tiles' borders.
     * @defaultValue false
     */
    showOutline?: boolean;
    /**
     * The color of the tile borders.
     * @defaultValue red
     */
    outlineColor?: ColorRepresentation;
    /**
     * The optional elevation range of the map. The map will not be
     * rendered for elevations outside of this range.
     * Note: this feature is only useful if an elevation layer is added to this map.
     * @defaultValue undefined (elevation range is disabled)
     */
    elevationRange?: ElevationRange;
    /**
     * Force using texture atlases even when not required.
     * @defaultValue false
     */
    forceTextureAtlases?: boolean;
    /**
     * The threshold before which a map tile is subdivided.
     * @defaultValue {@link DEFAULT_SUBDIVISION_THRESHOLD}
     */
    subdivisionThreshold?: number;
};

/**
 * A map is an {@link Entity3D} that represents a flat surface displaying one or more {@link core.layer.Layer | layer(s)}.
 *
 * ## Supported layers
 *
 * Maps support various types of layers.
 *
 * ### Color layers
 *
 * Maps can contain any number of {@link core.layer.ColorLayer | color layers}, as well as any number of {@link core.layer.MaskLayer | mask layers}.
 *
 * Color layers are used to display satellite imagery, vector features or any other dataset.
 * Mask layers are used to mask parts of a map (like an alpha channel).
 *
 * ### Elevation layers
 *
 * Up to one elevation layer can be added to a map, to provide features related to elevation, such
 * as terrain deformation, hillshading, contour lines, etc. Without an elevation layer, the map
 * will appear like a flat rectangle on the specified extent.
 *
 * Note: to benefit from the features given by elevation layers (shading for instance) while keeping
 * a flat map, disable terrain in the {@link TerrainOptions}.
 *
 * 💡 If the {@link TerrainOptions.enableCPUTerrain} is enabled, the elevation data can be sampled
 * by the {@link getElevation} method.
 *
 * ## Picking on maps
 *
 * Maps can be picked like any other 3D entity, using the {@link entities.Entity3D#pick | pick()} method.
 *
 * However, if {@link TerrainOptions.enableCPUTerrain} is enabled, then the map provides an alternate
 * methods for: raycasting-based picking, in addition to GPU-based picking.
 *
 * ### GPU-based picking
 *
 * This is the default method for picking maps. When the user calls {@link entities.Entity3D#pick | pick()},
 * the camera's field of view is rendered into a temporary texture, then the pixel(s) around the picked
 * point are analyzed to determine the location of the picked point.
 *
 * The main advantage of this method is that it ignores transparent pixels of the map (such as
 * no-data elevation pixels, or transparent color layers).
 *
 * ### Raycasting-based picking
 *
 * 💡 This method requires that {@link TerrainOptions.enableCPUTerrain} is enabled, and that
 * {@link core.picking.PickOptions.gpuPicking} is disabled.
 *
 * This method casts a ray that is then intersected with the map's meshes. The first intersection is
 * returned.
 *
 * The main advantage of this method is that it's much faster and puts less pressure on the GPU.
 *
 * @typeParam UserData - The type of the {@link entities.Entity#userData} property.
 */
class Map<UserData extends EntityUserData = EntityUserData>
    extends Entity3D<MapEventMap, UserData>
    implements
        Pickable<MapPickResult>,
        PickableFeatures<unknown, MapPickResult>,
        ElevationProvider,
        HasLayers,
        MemoryUsage
{
    readonly isMap = true as const;
    readonly type = 'Map' as const;
    readonly hasLayers = true as const;

    private _segments: number;
    private _hasElevationLayer = false;
    private readonly _atlasInfo: AtlasInfo;
    private _subdivisions: { x: number; y: number } | null = null;
    private _colorAtlasDataType: TextureDataType = UnsignedByteType;
    private _imageSize: Vector2 | null = null;
    private _wireframe = false;
    private readonly _layers: Layer[] = [];
    private readonly _onLayerVisibilityChanged: (event: { target: Layer }) => void;
    private readonly _onTileElevationChanged: (tile: TileMesh) => void;
    /** @internal */
    readonly level0Nodes: TileMesh[];
    /** @internal */
    readonly allTiles: Set<TileMesh> = new Set();
    private readonly _layerIndices: globalThis.Map<string, number>;
    private readonly _layerIds: Set<string> = new Set();
    /** @internal */
    readonly geometryPool: globalThis.Map<string, TileGeometry>;
    readonly extent: Extent;
    readonly maxSubdivisionLevel: number;
    readonly isPickableFeatures = true;
    private readonly _materialOptions: MaterialOptions;
    readonly showOutline = false;
    /** @internal */
    readonly tileIndex: TileIndex<TileMesh>;
    /**
     * The global factor that drives SSE (screen space error) computation. The lower this value, the
     * sooner a tile is subdivided. Note: changing this scale to a value less than 1 can drastically
     * increase the number of tiles displayed in the scene, and can even lead to WebGL crashes.
     *
     * @defaultValue {@link DEFAULT_SUBDIVISION_THRESHOLD}
     */
    subdivisionThreshold: number;

    getMemoryUsage(context: GetMemoryUsageContext) {
        this._layers.forEach(layer => layer.getMemoryUsage(context));
        this.geometryPool.forEach(geometry => geometry.getMemoryUsage(context));
        this.allTiles.forEach(tile => tile.getMemoryUsage(context));
    }

    /**
     * Constructs a Map object.
     *
     * @param options - Constructor options.
     */
    constructor(options: MapConstructorOptions) {
        super(options.object3d || new Group());

        this.level0Nodes = [];

        this.geometryPool = new window.Map();

        this._layerIndices = new window.Map();

        this._atlasInfo = { maxX: 0, maxY: 0, atlas: null };

        if (!options.extent.isValid()) {
            throw new Error(
                'Invalid extent: minX must be less than maxX and minY must be less than maxY.',
            );
        }
        this.extent = options.extent;

        this.subdivisionThreshold = options.subdivisionThreshold ?? DEFAULT_SUBDIVISION_THRESHOLD;
        this.maxSubdivisionLevel = options.maxSubdivisionLevel ?? 30;
        this._onTileElevationChanged = this.onTileElevationChanged.bind(this);
        this._onLayerVisibilityChanged = this.onLayerVisibilityChanged.bind(this);

        this._segments = options.segments ?? DEFAULT_MAP_SEGMENTS;

        this._materialOptions = {
            showColliderMeshes: false,
            forceTextureAtlases: options.forceTextureAtlases ?? false,
            hillshading: getHillshadingOptions(options.hillshading),
            contourLines: getContourLineOptions(options.contourLines),
            discardNoData: options.discardNoData ?? false,
            side: options.side ?? FrontSide,
            depthTest: options.depthTest ?? true,
            showTileOutlines: options.showOutline ?? false,
            terrain: getTerrainOptions(options.terrain),
            colorimetry: getColorimetryOptions(options.colorimetry),
            graticule: getGraticuleOptions(options.graticule),
            segments: this.segments,
            colorMapAtlas: null,
            elevationRange: options.elevationRange ?? null,
            backgroundOpacity: options.backgroundOpacity ?? 1,
            tileOutlineColor: new Color(options.outlineColor ?? '#ff0000'),
            backgroundColor:
                options.backgroundColor !== undefined
                    ? new Color(options.backgroundColor)
                    : new Color(DEFAULT_MAP_BACKGROUND_COLOR),
        };

        this.tileIndex = new TileIndex();
    }

    /**
     * Returns `true` if this map is currently processing data.
     */
    get loading() {
        return this._layers.some(l => l.loading);
    }

    /**
     * Gets the loading progress (between 0 and 1) of the map. This is the average progress of all
     * layers in this map.
     * Note: if no layer is present, this will always be 1.
     * Note: This value is only meaningful is {@link loading} is `true`.
     */
    get progress() {
        if (this._layers.length === 0) {
            return 1;
        }

        const sum = this._layers.reduce((accum, layer) => accum + layer.progress, 0);
        return sum / this._layers.length;
    }

    /**
     * Gets or sets depth testing on materials.
     */
    get depthTest() {
        return this._materialOptions.depthTest;
    }

    set depthTest(v: boolean) {
        this._materialOptions.depthTest = v;
    }

    /**
     * Gets or sets the background opacity.
     */
    get backgroundOpacity(): number {
        return this._materialOptions.backgroundOpacity;
    }

    set backgroundOpacity(opacity: number) {
        this._materialOptions.backgroundOpacity = opacity;
    }

    /**
     * Gets or sets the terrain options.
     */
    get terrain(): TerrainOptions {
        return this._materialOptions.terrain;
    }

    set terrain(terrain: TerrainOptions) {
        this._materialOptions.terrain = getTerrainOptions(terrain);
    }

    /**
     * Gets or sets the sidedness of the map surface:
     * - `FrontSide` will only display the "above ground" side of the map (in cartesian maps),
     * or the outer shell of the map (in globe settings).
     * - `BackSide` will only display the "underground" side of the map (in cartesian maps),
     * or the inner shell of the map (in globe settings).
     * - `DoubleSide` will display both sides of the map.
     * @defaultValue `FrontSide`
     */
    get side(): Side {
        return this._materialOptions.side;
    }

    set side(newSide: Side) {
        this._materialOptions.side = newSide;
    }

    /**
     * Toggles discard no-data pixels.
     */
    get discardNoData(): boolean {
        return this._materialOptions.discardNoData;
    }

    set discardNoData(opacity: boolean) {
        this._materialOptions.discardNoData = opacity;
    }

    /**
     * Gets or sets the background color.
     */
    get backgroundColor(): Color {
        return this._materialOptions.backgroundColor;
    }

    set backgroundColor(c: ColorRepresentation) {
        this._materialOptions.backgroundColor = new Color(c);
    }

    /**
     * Gets or sets graticule options.
     */
    get graticule(): GraticuleOptions {
        return this._materialOptions.graticule;
    }

    set graticule(opts: GraticuleOptions) {
        this._materialOptions.graticule = getGraticuleOptions(opts);
    }

    /**
     * Gets or sets hillshading options.
     */
    get hillshading(): HillshadingOptions {
        return this._materialOptions.hillshading;
    }

    set hillshading(opts: HillshadingOptions) {
        this._materialOptions.hillshading = getHillshadingOptions(opts);
    }

    /**
     * Gets or sets colorimetry options.
     */
    get colorimetry(): ColorimetryOptions {
        return this._materialOptions.colorimetry;
    }

    set colorimetry(opts: ColorimetryOptions) {
        this._materialOptions.colorimetry = opts;
    }

    /**
     * Gets or sets elevation range.
     */
    get elevationRange(): ElevationRange | null {
        return this._materialOptions.elevationRange;
    }

    set elevationRange(range: ElevationRange | null) {
        this._materialOptions.elevationRange = range;
    }

    /**
     * Shows tile outlines.
     */
    get showTileOutlines(): boolean {
        return this._materialOptions.showTileOutlines;
    }

    set showTileOutlines(show: boolean) {
        this._materialOptions.showTileOutlines = show;
    }

    /**
     * Gets or sets tile outline color.
     */
    get tileOutlineColor(): Color {
        return this._materialOptions.tileOutlineColor;
    }

    set tileOutlineColor(color: ColorRepresentation) {
        this._materialOptions.tileOutlineColor = new Color(color);
    }

    /**
     * Gets or sets contour line options.
     */
    get contourLines(): ContourLineOptions {
        return this._materialOptions.contourLines;
    }

    set contourLines(opts: ContourLineOptions) {
        this._materialOptions.contourLines = getContourLineOptions(opts);
    }

    /**
     * Shows meshes used for raycasting purposes.
     */
    get showColliderMeshes(): boolean {
        return this._materialOptions.showColliderMeshes;
    }

    set showColliderMeshes(show: boolean) {
        this._materialOptions.showColliderMeshes = show;
    }

    get segments() {
        return this._segments;
    }

    set segments(v) {
        if (this._segments !== v) {
            if (MathUtils.isPowerOfTwo(v) && v >= 1 && v <= 128) {
                // Delete cached geometries that just became obsolete
                this.clearGeometryPool();
                this._segments = v;
                this._materialOptions.segments = v;
                this.updateGeometries();
            } else {
                throw new Error(
                    'invalid segments. Must be a power of two between 1 and 128 included',
                );
            }
        }
    }

    /**
     * Displays the map tiles in wireframe.
     */
    get wireframe(): boolean {
        return this._wireframe;
    }

    set wireframe(v: boolean) {
        if (v !== this._wireframe) {
            this._wireframe = v;
            this.traverseTiles(tile => {
                tile.material.wireframe = v;
            });
        }
    }

    get imageSize(): Vector2 {
        return this._imageSize as Vector2;
    }

    private subdivideNode(context: Context, node: TileMesh) {
        if (!node.children.some(n => isTileMesh(n))) {
            const extents = node.extent.split(2, 2);

            let i = 0;
            const { x, y, z } = node;

            for (const extent of extents) {
                let child: TileMesh;
                if (i === 0) {
                    child = this.requestNewTile(extent, node, z + 1, 2 * x + 0, 2 * y + 0);
                } else if (i === 1) {
                    child = this.requestNewTile(extent, node, z + 1, 2 * x + 0, 2 * y + 1);
                } else if (i === 2) {
                    child = this.requestNewTile(extent, node, z + 1, 2 * x + 1, 2 * y + 0);
                } else {
                    child = this.requestNewTile(extent, node, z + 1, 2 * x + 1, 2 * y + 1);
                }

                // inherit our parent's textures
                for (const e of this.getElevationLayers()) {
                    e.update(context, child);
                }

                for (const c of this.getColorLayers()) {
                    c.update(context, child);
                }

                child.update(this._materialOptions);
                child.updateMatrixWorld(true);
                i++;
            }
            this.notifyChange(node);
        }
    }

    private clearGeometryPool() {
        this.geometryPool.forEach(v => v.dispose());
        this.geometryPool.clear();
    }

    private updateGeometries() {
        this.traverseTiles(tile => {
            tile.segments = this.segments;
        });
    }

    get subdivisions(): { x: number; y: number } {
        return this._subdivisions as Vector2;
    }

    preprocess() {
        if (this.extent.crs !== this.instance.referenceCrs) {
            throw new Error('The extent of this map is not in the same CRS as the Instance CRS');
        }

        const subdivs = selectBestSubdivisions(this.extent);

        this._subdivisions = subdivs;

        // If the map is not square, we want to have more than a single
        // root tile to avoid elongated tiles that hurt visual quality and SSE computation.
        const rootExtents = this.extent.split(subdivs.x, subdivs.y);

        this._imageSize = computeImageSize(rootExtents[0]);

        let i = 0;
        for (const root of rootExtents) {
            if (subdivs.x > subdivs.y) {
                this.level0Nodes.push(this.requestNewTile(root, undefined, 0, i, 0));
            } else if (subdivs.y > subdivs.x) {
                this.level0Nodes.push(this.requestNewTile(root, undefined, 0, 0, i));
            } else {
                this.level0Nodes.push(this.requestNewTile(root, undefined, 0, 0, 0));
            }
            i++;
        }
        for (const level0 of this.level0Nodes) {
            this.object3d.add(level0);
            level0.updateMatrixWorld(false);
        }

        return Promise.resolve();
    }

    private requestNewTile(
        extent: Extent,
        parent: TileMesh | undefined,
        level: number,
        x = 0,
        y = 0,
    ): TileMesh {
        const quaternion = new Quaternion();
        const position = extent.centerAsVector3();

        // build tile
        const material = new LayeredMaterial({
            renderer: this.instance.renderer,
            atlasInfo: this._atlasInfo,
            options: this._materialOptions,
            getIndexFn: this.getIndex.bind(this),
            textureDataType: this._colorAtlasDataType,
            hasElevationLayer: this._hasElevationLayer,
            maxTextureImageUnits: Capabilities.getMaxTextureUnitsCount(),
        });

        const tile = new TileMesh({
            geometryPool: this.geometryPool,
            instance: this.instance,
            material,
            extent,
            textureSize: nonNull(this._imageSize),
            segments: this.segments,
            coord: { level, x, y },
            enableCPUTerrain: this._materialOptions.terrain.enableCPUTerrain ?? true,
            enableTerrainDeformation: this._materialOptions.terrain.enabled ?? true,
            onElevationChanged: this._onTileElevationChanged,
        });

        this.allTiles.add(tile);

        this.tileIndex.addTile(tile);

        tile.material.opacity = this.opacity;

        if (parent && parent instanceof TileMesh) {
            // get parent position from extent
            const positionParent = parent.extent.centerAsVector3();
            // place relative to his parent
            position.sub(positionParent).applyQuaternion(parent.quaternion.invert());
            quaternion.premultiply(parent.quaternion);
        }

        tile.position.copy(position);
        tile.quaternion.copy(quaternion);

        tile.opacity = this.opacity;
        tile.setVisibility(false);
        tile.updateMatrix();

        tile.material.wireframe = this.wireframe || false;

        if (parent) {
            tile.setBBoxZ(parent.minmax.min, parent.minmax.max);
        } else {
            const { min, max } = this.getElevationMinMax();
            tile.setBBoxZ(min, max);
        }

        this.onObjectCreated(tile);

        if (parent) {
            parent.addChildTile(tile);
        }

        return tile;
    }

    private onTileElevationChanged(tile: TileMesh) {
        this.dispatchEvent({ type: 'elevation-changed', extent: tile.extent });
    }

    /**
     * Sets the render state of the map.
     *
     * @internal
     * @param state - The new state.
     * @returns The function to revert to the previous state.
     */
    setRenderState(state: RenderingState) {
        const restores = this.level0Nodes.map(n => n.pushRenderState(state));

        return () => {
            restores.forEach(r => r());
        };
    }

    pick(coordinates: Vector2, options?: PickOptions): MapPickResult[] {
        if (options?.gpuPicking === true) {
            return pickTilesAt(this.instance, coordinates, this, options);
        } else {
            return this.pickUsingRaycast(coordinates, options);
        }
    }

    private raycastAtCoordinate(
        coordinates: Vector2,
        results: MapPickResult[],
        options?: PickOptions,
    ) {
        const normalized = this.instance.canvasToNormalizedCoords(coordinates, tempNDC);

        const raycaster = new Raycaster();
        raycaster.setFromCamera(normalized, this.instance.view.camera);

        tmpIntersectList.length = 0;

        this.raycast(raycaster, tmpIntersectList);

        const filter = options?.filter ?? (() => true);

        if (tmpIntersectList.length > 0) {
            tmpIntersectList.sort((a, b) => a.distance - b.distance);

            const intersect = tmpIntersectList[0];

            const { x, y, z } = intersect.point;

            const pickResult: MapPickResult = {
                isMapPickResult: true,
                coord: new Coordinates(this.instance.referenceCrs, x, y, z),
                entity: this,
                ...intersect,
            };

            if (filter(pickResult)) {
                results.push(pickResult);
            }
        }
    }

    private pickUsingRaycast(coordinates: Vector2, options?: PickOptions): MapPickResult[] {
        const results: MapPickResult[] = [];

        const radius = options?.radius;

        if (radius == null || radius === 0) {
            this.raycastAtCoordinate(coordinates, results, options);
        } else {
            const originX = coordinates.x;
            const originY = coordinates.y;

            traversePickingCircle(radius, (x, y) => {
                tempCanvasCoords.set(originX + x, originY + y);
                this.raycastAtCoordinate(tempCanvasCoords, results, options);
                return null;
            });
        }

        return results;
    }

    /**
     * Perform raycasting on visible tiles.
     * @param raycaster - The THREE raycaster.
     * @param intersects  - The intersections array to populate with intersections.
     */
    raycast(raycaster: Raycaster, intersects: Intersection<TileMesh>[]): void {
        this.traverseTiles(tile => {
            if (!tile.disposed && tile.visible && tile.material.visible) {
                tile.raycast(raycaster, intersects);
            }
        });

        intersects.sort((a, b) => a.distance - b.distance);
    }

    pickFeaturesFrom(pickedResult: MapPickResult, options?: PickOptions): unknown[] {
        const result: unknown[] = [];
        for (const layer of this._layers) {
            if (isPickableFeatures(layer)) {
                const res = layer.pickFeaturesFrom(pickedResult, options);
                result.push(...res);
            }
        }

        pickedResult.features = result;
        return result;
    }

    preUpdate(context: Context, changeSources: Set<unknown>) {
        this._materialOptions.colorMapAtlas?.update();

        this.tileIndex.update();

        if (changeSources.has(undefined) || changeSources.size === 0) {
            return this.level0Nodes;
        }

        let commonAncestor: TileMesh | null = null;
        for (const source of changeSources.values()) {
            if ((source as ThreeCamera).isCamera) {
                // if the change is caused by a camera move, no need to bother
                // to find common ancestor: we need to update the whole tree:
                // some invisible tiles may now be visible
                return this.level0Nodes;
            }
            if (isTileMesh(source)) {
                if (!commonAncestor) {
                    commonAncestor = source;
                } else {
                    commonAncestor = source.findCommonAncestor(commonAncestor);
                    if (!commonAncestor) {
                        return this.level0Nodes;
                    }
                }
                if (commonAncestor.material == null) {
                    commonAncestor = null;
                }
            }
        }
        if (commonAncestor) {
            return [commonAncestor];
        }
        return this.level0Nodes;
    }

    /**
     * Sort the color layers according to the comparator function.
     *
     * @param compareFn - The comparator function.
     */
    sortColorLayers(compareFn: LayerCompareFn) {
        if (compareFn == null) {
            throw new Error('missing comparator function');
        }

        this._layers.sort((a, b) => {
            if (isColorLayer(a) && isColorLayer(b)) {
                return compareFn(a, b);
            }

            // Sorting elevation layers has no effect currently, so by convention
            // we push them to the start of the list.
            if (isElevationLayer(a) && isElevationLayer(b)) {
                return 0;
            }

            if (isElevationLayer(a)) {
                return -1;
            }

            return 1;
        });
        this.reorderLayers();
    }

    /**
     * Moves the layer closer to the foreground.
     *
     * Note: this only applies to color layers.
     *
     * @param layer - The layer to move.
     * @throws If the layer is not present in the map.
     * @example
     * map.addLayer(foo);
     * map.addLayer(bar);
     * map.addLayer(baz);
     * // Layers (back to front) : foo, bar, baz
     *
     * map.moveLayerUp(foo);
     * // Layers (back to front) : bar, foo, baz
     */
    moveLayerUp(layer: ColorLayer) {
        const position = this._layers.indexOf(layer);

        if (position === -1) {
            throw new Error('The layer is not present in the map.');
        }

        if (position < this._layers.length - 1) {
            const next = this._layers[position + 1];
            this._layers[position + 1] = layer;
            this._layers[position] = next;

            this.reorderLayers();
        }
    }

    onRenderingContextRestored(): void {
        this._materialOptions.colorMapAtlas?.forceUpdate();
        this.forEachLayer(layer => layer.onRenderingContextRestored());
        this.notifyChange(this);
    }

    /**
     * Moves the specified layer after the other layer in the list.
     *
     * @param layer - The layer to move.
     * @param target - The target layer. If `null`, then the layer is put at the
     * beginning of the layer list.
     * @throws If the layer is not present in the map.
     * @example
     * map.addLayer(foo);
     * map.addLayer(bar);
     * map.addLayer(baz);
     * // Layers (back to front) : foo, bar, baz
     *
     * map.insertLayerAfter(foo, baz);
     * // Layers (back to front) : bar, baz, foo
     */
    insertLayerAfter(layer: ColorLayer, target: ColorLayer | null) {
        const position = this._layers.indexOf(layer);
        let afterPosition = target == null ? -1 : this._layers.indexOf(target);

        if (position === -1) {
            throw new Error('The layer is not present in the map.');
        }

        if (afterPosition === -1) {
            afterPosition = 0;
        }

        this._layers.splice(position, 1);
        afterPosition = target == null ? -1 : this._layers.indexOf(target);
        this._layers.splice(afterPosition + 1, 0, layer);

        this.reorderLayers();
    }

    /**
     * Moves the layer closer to the background.
     *
     * Note: this only applies to color layers.
     *
     * @param layer - The layer to move.
     * @throws If the layer is not present in the map.
     * @example
     * map.addLayer(foo);
     * map.addLayer(bar);
     * map.addLayer(baz);
     * // Layers (back to front) : foo, bar, baz
     *
     * map.moveLayerDown(baz);
     * // Layers (back to front) : foo, baz, bar
     */
    moveLayerDown(layer: ColorLayer) {
        const position = this._layers.indexOf(layer);

        if (position === -1) {
            throw new Error('The layer is not present in the map.');
        }

        if (position > 0) {
            const prev = this._layers[position - 1];
            this._layers[position - 1] = layer;
            this._layers[position] = prev;

            this.reorderLayers();
        }
    }

    /**
     * Returns the position of the layer in the layer list, or -1 if it is not found.
     *
     * @param layer - The layer to search.
     * @returns The index of the layer.
     */
    getIndex(layer: Layer): number {
        const value = this._layerIndices.get(layer.id);
        if (value == null) {
            return -1;
        }

        return value;
    }

    private reorderLayers() {
        const layers = this._layers;

        for (let i = 0; i < layers.length; i++) {
            const element = layers[i];
            this._layerIndices.set(element.id, i);
        }

        this.traverseTiles(tile => tile.reorderLayers());

        this.dispatchEvent({ type: 'layer-order-changed' });

        this.notifyChange(this);
    }

    contains(obj: unknown) {
        if ((obj as Layer).isLayer) {
            return this._layers.includes(obj as Layer);
        }

        return false;
    }

    update(context: Context, node: TileMesh): unknown[] | undefined {
        if (!node.parent) {
            this.disposeTile(node);
            return undefined;
        }

        // do proper culling
        if (!this.frozen) {
            node.visible = this.testVisibility(node, context);
        }

        if (node.visible) {
            let requestChildrenUpdate = false;

            if (!this.frozen) {
                const worldBox = node.getWorldSpaceBoundingBox(tmpBox3);
                const size = worldBox.getSize(tmpVector);
                const geometricError = Math.max(size.x, size.y);

                const sse = ScreenSpaceError.computeFromBox3(
                    context.view,
                    worldBox,
                    IDENTITY,
                    geometricError,
                    ScreenSpaceError.Mode.MODE_2D,
                );

                if (this.testTileSSE(node, sse) && this.canSubdivide(node)) {
                    this.subdivideNode(context, node);
                    // display iff children aren't ready
                    node.setDisplayed(false);
                    requestChildrenUpdate = true;
                } else {
                    node.setDisplayed(true);
                }
            } else {
                requestChildrenUpdate = true;
            }

            if (node.material.visible) {
                node.material.update(this._materialOptions);

                this.updateMinMaxDistance(context, node);

                // update uniforms
                if (!requestChildrenUpdate) {
                    return node.detachChildren();
                }
            }

            return requestChildrenUpdate ? node.children.filter(n => isTileMesh(n)) : undefined;
        }

        node.setDisplayed(false);
        return node.detachChildren();
    }

    private testVisibility(node: TileMesh, context: Context): boolean {
        node.update(this._materialOptions);

        const isVisible = context.view.isBox3Visible(node.boundingBox, node.matrixWorld);

        return isVisible;
    }

    postUpdate(context: Context) {
        this.traverseTiles(tile => {
            if (tile.visible && tile.material.visible) {
                this._layers.forEach(layer => layer.update(context, tile));
            }
        });
        this._layers.forEach(l => l.postUpdate());

        const computeNeighbours =
            this._materialOptions.terrain.stitching && this._materialOptions.terrain.enabled;

        if (computeNeighbours) {
            this.traverseTiles(tile => {
                if (tile.material.visible) {
                    const neighbours = this.tileIndex.getNeighbours(
                        tile,
                        tmpNeighbours,
                        isStitchableNeighbour,
                    );
                    tile.processNeighbours(neighbours);
                }
            });
        }
    }

    private registerColorLayer(layer: ColorLayer) {
        const colorLayers = this._layers.filter(l => l instanceof ColorLayer);

        // rebuild color textures atlas
        // We use a margin to prevent atlas bleeding.
        const margin = 1.1;
        const factor = layer.resolutionFactor * margin;
        const { x, y } = nonNull(this._imageSize);
        const size = new Vector2(Math.round(x * factor), Math.round(y * factor));

        const { atlas, maxX, maxY } = AtlasBuilder.pack(
            Capabilities.getMaxTextureSize(),
            colorLayers.map(l => ({ id: l.id, size })),
            this._atlasInfo.atlas,
        );
        this._atlasInfo.atlas = atlas;
        this._atlasInfo.maxX = Math.max(this._atlasInfo.maxX, maxX);
        this._atlasInfo.maxY = Math.max(this._atlasInfo.maxY, maxY);

        this._colorAtlasDataType = getWidestDataType(this.getColorLayers());
    }

    private updateGlobalMinMax() {
        const minmax = this.getElevationMinMax();
        this.traverseTiles(tile => {
            tile.setBBoxZ(minmax.min, minmax.max);
        });
    }

    private registerColorMap(colorMap: ColorMap) {
        if (!this._materialOptions.colorMapAtlas) {
            this._materialOptions.colorMapAtlas = new ColorMapAtlas(this.instance.renderer);
            this.traverseTiles(t => {
                t.material.setColorMapAtlas(this._materialOptions.colorMapAtlas);
            });
        }
        this._materialOptions.colorMapAtlas.add(colorMap);
    }

    /**
     * Adds a layer, then returns the created layer.
     * Before using this method, make sure that the map is added in an instance.
     * If the extent or the projection of the layer is not provided,
     * those values will be inherited from the map.
     *
     * @param layer - the layer to add
     * @returns a promise resolving when the layer is ready
     */
    async addLayer<TLayer extends Layer>(layer: TLayer): Promise<TLayer> {
        if (!(layer instanceof Layer)) {
            throw new Error('layer is not an instance of Layer');
        }

        if (this._layerIds.has(layer.id)) {
            throw new Error(`layer ${layer.name ?? layer.id} is already present in this map`);
        }

        this._layerIds.add(layer.id);

        this._layers.push(layer);

        await layer.initialize({ instance: this.instance });

        layer.addEventListener('visible-property-changed', this._onLayerVisibilityChanged);

        if (layer instanceof ColorLayer) {
            this.registerColorLayer(layer);
        } else if (layer instanceof ElevationLayer) {
            this._hasElevationLayer = true;
            this.updateGlobalMinMax();
        }

        if (layer.colorMap) {
            this.registerColorMap(layer.colorMap);
        }

        this.reorderLayers();

        this.notifyChange(this);

        this.dispatchEvent({ type: 'layer-added', layer });

        return layer;
    }

    private onLayerVisibilityChanged(event: { target: Layer }) {
        if (event.target instanceof ElevationLayer) {
            this.dispatchEvent({ type: 'elevation-changed', extent: this.extent });
        }

        this.traverseTiles(tile => {
            tile.onLayerVisibilityChanged(event.target);
        });
    }

    /**
     * Removes a layer from the map.
     *
     * @param layer - the layer to remove
     * @param options - The options.
     * @returns `true` if the layer was present, `false` otherwise.
     */
    removeLayer(
        layer: Layer,
        options: {
            /** If `true`, the layer is also disposed. */
            disposeLayer?: boolean;
        } = {},
    ): boolean {
        if (layer == null) {
            return false;
        }

        if (this._layerIds.has(layer.id)) {
            this._layerIds.delete(layer.id);
            this._layers.splice(this._layers.indexOf(layer), 1);
            if (layer.colorMap) {
                this._materialOptions.colorMapAtlas?.remove(layer.colorMap);
            }
            if (layer instanceof ElevationLayer) {
                this._hasElevationLayer = false;
            }
            this.traverseTiles(tile => {
                layer.unregisterNode(tile);
            });
            layer.removeEventListener('visible-property-changed', this._onLayerVisibilityChanged);
            layer.postUpdate();
            this.reorderLayers();
            this.dispatchEvent({ type: 'layer-removed', layer });
            this.notifyChange(this);
            if (options.disposeLayer === true) {
                layer.dispose();
            }
            return true;
        }

        return false;
    }

    get layerCount() {
        return this._layers.length;
    }

    forEachLayer(callback: (layer: Layer) => void): void {
        this._layers.forEach(l => callback(l));
    }

    /**
     * Gets all layers that satisfy the filter predicate.
     *
     * @param predicate - the optional predicate.
     * @returns the layers that matched the predicate or all layers if no predicate was provided.
     */
    getLayers(predicate?: (arg0: Layer) => boolean) {
        const result = [];
        for (const layer of this._layers) {
            if (!predicate || predicate(layer)) {
                result.push(layer);
            }
        }
        return result;
    }

    /**
     * Gets all color layers in this map.
     *
     * @returns the color layers
     */
    getColorLayers(): ColorLayer[] {
        return this.getLayers(l => (l as ColorLayer).isColorLayer) as ColorLayer[];
    }

    /**
     * Gets all elevation layers in this map.
     *
     * @returns the elevation layers
     */
    getElevationLayers(): ElevationLayer[] {
        return this.getLayers(l => (l as ElevationLayer).isElevationLayer) as ElevationLayer[];
    }

    /**
     * Disposes this map and associated unmanaged resources.
     *
     * Note: By default, layers in this map are not automatically disposed, except when
     * `disposeLayers` is `true`.
     *
     * @param options - Options.
     * @param options -.disposeLayers If true, layers are also disposed.
     */
    dispose(
        options: {
            disposeLayers?: boolean;
        } = {
            disposeLayers: false,
        },
    ) {
        // Delete cached TileGeometry objects. This is not possible to do
        // at the TileMesh level because TileMesh objects do not own their geometry,
        // as it is shared among all tiles at the same depth level.
        this.clearGeometryPool();

        // Dispose all tiles so that every layer will unload data relevant to those tiles.
        this.traverseTiles(t => this.disposeTile(t));

        if (options.disposeLayers === true) {
            this.getLayers().forEach(layer => layer.dispose());
        }

        this._materialOptions.colorMapAtlas?.dispose();
    }

    private disposeTile(tile: TileMesh) {
        tile.traverseTiles(desc => {
            desc.dispose();
            this.allTiles.delete(desc);
        });
    }

    /**
     * Returns the minimal and maximal elevation values in this map, in meters.
     *
     * If there is no elevation layer present, returns `{ min: 0, max: 0 }`.
     *
     * @returns The min/max value.
     */
    getElevationMinMax(): ElevationRange {
        const elevationLayers = this.getElevationLayers();
        if (elevationLayers.length > 0) {
            let min = null;
            let max = null;

            for (const layer of elevationLayers) {
                const minmax = layer.minmax;
                if (minmax != null) {
                    if (min == null || max == null) {
                        min = min ?? minmax.min;
                        max = max ?? minmax.max;
                    } else {
                        min = Math.min(min, minmax.min);
                        max = Math.max(max, minmax.max);
                    }
                }
            }

            if (min != null && max != null) {
                return { min, max };
            }
        }
        return { min: 0, max: 0 };
    }

    /**
     * Sample the elevation at the specified coordinate.
     *
     * Note: this method does nothing if {@link TerrainOptions.enableCPUTerrain} is not enabled,
     * or if no elevation layer is present on the map, or if the sampling coordinate is not inside
     * the map's extent.
     *
     * Note: sampling might return more than one sample for any given coordinate. You can sort them
     * by {@link entities.ElevationSample.resolution | resolution} to select the best sample for your needs.
     * @param options - The options.
     * @param result - The result object to populate with the samples. If none is provided, a new
     * empty result is created. The existing samples in the array are not removed. Useful to
     * cumulate samples across different maps.
     * @returns The {@link GetElevationResult} containing the updated sample array.
     * If the map has no elevation layer or if {@link TerrainOptions.enableCPUTerrain} is not enabled,
     * this array is left untouched.
     */
    getElevation(
        options: GetElevationOptions,
        result: GetElevationResult = { samples: [], coordinates: options.coordinates },
    ): GetElevationResult {
        result.coordinates = options.coordinates;

        const coordinates = options.coordinates.as(this.extent.crs);

        if (!this.extent.isPointInside(coordinates)) {
            return result;
        }

        if (!this._hasElevationLayer) {
            return result;
        }

        const elevationLayer = this.getElevationLayers()[0];

        if (!elevationLayer.visible) {
            return result;
        }

        if (!this._materialOptions.terrain.enableCPUTerrain) {
            console.warn(
                'Map.getElevation() is only supported when TerrainOptions.enableCPUTerrain is enabled',
            );
            return result;
        }

        this.traverseTiles(tile => {
            if (tile.extent.isPointInside(coordinates)) {
                const sample = tile.getElevation(options);
                if (sample) {
                    result.samples.push({ ...sample, source: this });
                }
            }
        });

        return result;
    }

    /**
     * Traverses all tiles in the hierarchy of this entity.
     *
     * @param callback - The callback.
     * @param root - The raversal root. If undefined, the traversal starts at the root
     * object of this entity.
     */
    traverseTiles(callback: (arg0: TileMesh) => void, root: Object3D | undefined = undefined) {
        const origin = root ?? this.object3d;

        if (origin != null) {
            origin.traverse(o => {
                if (isTileMesh(o)) {
                    callback(o);
                }
            });
        }
    }

    /**
     * @param node - The node to subdivide.
     * @returns True if the node can be subdivided.
     */
    canSubdivide(node: TileMesh): boolean {
        // No problem subdividing if terrain deformation is disabled,
        // since bounding boxes are always up to date (as they don't have an elevation component).
        if (!this._materialOptions.terrain.enabled) {
            return true;
        }

        // Prevent subdivision if node is covered by at least one elevation layer
        // and if node doesn't have a elevation texture yet.
        for (const e of this.getElevationLayers()) {
            // If the elevation layer is not ready, we are still waiting for
            // some information related to the terrain (min/max values).
            if (!e.ready && e.visible && !e.frozen) {
                return false;
            }

            if (!node.canSubdivide()) {
                return false;
            }
        }

        if (node.children.some(n => isTileMesh(n))) {
            // No need to prevent subdivision, since we've already done it before
            return true;
        }

        return true;
    }

    private testTileSSE(tile: TileMesh, sse: SSE | null) {
        if (this.maxSubdivisionLevel <= tile.level) {
            return false;
        }

        if (!sse) {
            return true;
        }

        tmpSseSizes[0] = sse.lengths.x * sse.ratio;
        tmpSseSizes[1] = sse.lengths.y * sse.ratio;

        const threshold = Math.max(this.imageSize.x, this.imageSize.y);
        return tmpSseSizes.some(v => v >= threshold * this.subdivisionThreshold);
    }

    private updateMinMaxDistance(context: Context, node: TileMesh) {
        const bbox = node.getWorldSpaceBoundingBox(tmpBox3);
        const distance = context.distance.plane.distanceToPoint(bbox.getCenter(tmpVector));
        const radius = bbox.getSize(tmpVector).length() * 0.5;
        this._distance.min = Math.min(this._distance.min, distance - radius);
        this._distance.max = Math.max(this._distance.max, distance + radius);
    }
}

export function isMap(o: unknown): o is Map {
    return (o as Map)?.isMap;
}

export default Map;
