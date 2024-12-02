import Earcut from 'earcut';
import type { Coordinate } from 'ol/coordinate';
import {
    LineString,
    type Geometry,
    type LinearRing,
    type MultiLineString,
    type MultiPoint,
    type MultiPolygon,
    type Point,
    type Polygon,
} from 'ol/geom';
import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    EventDispatcher,
    MeshBasicMaterial,
    MeshLambertMaterial,
    SpriteMaterial,
    SRGBColorSpace,
    Vector3,
    type Material,
    type Object3D,
    type Texture,
} from 'three';

import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import {
    getFullFillStyle,
    getFullPointStyle,
    getFullStrokeStyle,
    hashStyle,
    type BaseStyle,
    type FillStyle,
    type LineMaterialGenerator,
    type PointMaterialGenerator,
    type PointStyle,
    type StrokeStyle,
    type SurfaceMaterialGenerator,
} from '../../core/FeatureTypes';
import RequestQueue from '../../core/RequestQueue';
import Fetcher from '../../utils/Fetcher';
import LineStringMesh from './LineStringMesh';
import MultiLineStringMesh from './MultiLineStringMesh';
import MultiPointMesh from './MultiPointMesh';
import MultiPolygonMesh from './MultiPolygonMesh';
import PointMesh from './PointMesh';
import PolygonMesh from './PolygonMesh';
import type SimpleGeometryMesh from './SimpleGeometryMesh';
import type { DefaultUserData } from './SimpleGeometryMesh';
import SurfaceMesh from './SurfaceMesh';

const VERT_STRIDE = 3; // 3 elements per vertex position (X, Y, Z)
const X = 0;
const Y = 1;
const Z = 2;

export interface InputMap {
    Point: Point;
    MultiPoint: MultiPoint;
    LineString: LineString;
    MultiLineString: MultiLineString;
    Polygon: Polygon;
    MultiPolygon: MultiPolygon;
}

export interface OutputMap<UserData extends DefaultUserData = DefaultUserData> {
    Point: PointMesh<UserData>;
    MultiPoint: MultiPointMesh<UserData>;
    LineString: LineStringMesh<UserData>;
    MultiLineString: MultiLineStringMesh<UserData>;
    Polygon: PolygonMesh<UserData>;
    MultiPolygon: MultiPolygonMesh<UserData>;
}

export type BaseOptions = {
    /**
     * The point of origin for relative coordinates.
     */
    origin?: Vector3;
    /**
     * Ignores the Z component of coordinates.
     */
    ignoreZ?: boolean;
};

export type PointOptions = BaseOptions & Partial<PointStyle>;
export type PolygonOptions = BaseOptions & {
    fill?: FillStyle;
    stroke?: StrokeStyle;
    extrusionOffset?: number[] | number;
    elevation?: number[] | number;
};
export type LineOptions = BaseOptions & StrokeStyle;

export interface OptionMap {
    Point: PointOptions;
    MultiPoint: PointOptions;
    LineString: LineOptions;
    MultiLineString: LineOptions;
    Polygon: PolygonOptions;
    MultiPolygon: PolygonOptions;
}

function isTexture(o: unknown): o is Texture {
    return (o as Texture)?.isTexture ?? false;
}

const ZERO = new Vector3(0, 0, 0);

/**
 * This methods prepares vertices for three.js with coordinates coming from openlayers.
 *
 * It does 2 things:
 *
 * - flatten the array while removing the last vertex of each rings
 * - builds the new hole indices taking into account vertex removals
 *
 * @param coordinates - The coordinate of the closed shape that form the roof.
 * @param stride - The stride in the coordinate array (2 for XY, 3 for XYZ)
 * @param offset - The offset to apply to vertex positions.
 * the first/last point
 * @param elevation - The elevation.
 */
function createFloorVertices(params: {
    coordinates: Array<Array<Array<number>>>;
    stride: number;
    offset: Vector3;
    elevation?: Array<number> | number;
    ignoreZ: boolean;
}) {
    // iterate on polygon and holes
    const holesIndices = [];
    let currentIndex = 0;
    const positions = [];

    const { coordinates, offset, ignoreZ, elevation, stride } = params;

    for (const ring of coordinates) {
        // NOTE: rings coming from openlayers are auto-closing, so we need to remove the last vertex
        // of each ring here
        if (currentIndex > 0) {
            holesIndices.push(currentIndex);
        }
        for (let i = 0; i < ring.length - 1; i++) {
            currentIndex++;
            const coord = ring[i];
            positions.push(coord[X] - offset.x);
            positions.push(coord[Y] - offset.y);
            let z = 0;
            if (!ignoreZ) {
                if (stride === 3) {
                    z = coord[Z];
                } else if (elevation != null) {
                    z = Array.isArray(elevation) ? elevation[i] : elevation;
                }
            }
            z -= offset.z;
            positions.push(z);
        }
    }
    return { flatCoordinates: positions, holes: holesIndices };
}

/**
 * Create a roof, basically a copy of the floor with faces shifted by 'pointcount' elem
 *
 * NOTE: at the moment, this method must be executed before `createWallForRings`, because we copy
 * the indices array as it is.
 *
 * @param positions - a flat array of coordinates
 * @param pointCount - the number of points to read from position, starting with the first vertex
 * @param indices - the indices to duplicate for the roof
 * @param extrusionOffset - the extrusion offset(s) to apply to the roof element.
 */
function createRoof(
    positions: Array<number>,
    pointCount: number,
    indices: Array<number>,
    extrusionOffset: Array<number> | number,
) {
    for (let i = 0; i < pointCount; i++) {
        positions.push(positions[i * VERT_STRIDE + X]);
        positions.push(positions[i * VERT_STRIDE + Y]);
        const zOffset = Array.isArray(extrusionOffset) ? extrusionOffset[i] : extrusionOffset;
        positions.push(positions[i * VERT_STRIDE + Z] + zOffset);
    }
    const iLength = indices.length;
    for (let i = 0; i < iLength; i++) {
        indices.push(indices[i] + pointCount);
    }
}

/**
 * This methods creates vertex and faces for the walls
 *
 * @param positions - The array containing the positions of the vertices.
 * @param start - vertex in positions to start with
 * @param end - vertex in positions to end with
 * @param indices - The index array.
 * @param extrusionOffset - The extrusion distance.
 */
function createWallForRings(
    positions: Array<number>,
    start: number,
    end: number,
    indices: Array<number>,
    extrusionOffset: Array<number> | number,
) {
    // Each side is formed by the A, B, C, D vertices, where A is the current coordinate,
    // and B is the next coordinate (thus the segment AB is one side of the polygon).
    // C and D are the same points but with a Z offset.
    // Note that each side has its own vertices, as vertices of sides are not shared with
    // other sides (i.e duplicated) in order to have faceted normals for each side.
    let vertexOffset = 0;
    const pointCount = positions.length / 3;

    for (let i = start; i < end; i++) {
        const idxA = i * VERT_STRIDE;
        const iB = i + 1 === end ? start : i + 1;
        const idxB = iB * VERT_STRIDE;

        const Ax = positions[idxA + X];
        const Ay = positions[idxA + Y];
        const Az = positions[idxA + Z];

        const Bx = positions[idxB + X];
        const By = positions[idxB + Y];
        const Bz = positions[idxB + Z];

        const zOffsetA = Array.isArray(extrusionOffset) ? extrusionOffset[i] : extrusionOffset;
        const zOffsetB = Array.isArray(extrusionOffset) ? extrusionOffset[iB] : extrusionOffset;

        // +Z top
        //      A                    B
        // (Ax, Ay, zMax) ---- (Bx, By, zMax)
        //      |                    |
        //      |                    |
        // (Ax, Ay, zMin) ---- (Bx, By, zMin)
        //      C                    D
        // -Z bottom

        positions.push(Ax, Ay, Az); // A
        positions.push(Bx, By, Bz); // B
        positions.push(Ax, Ay, Az + zOffsetA); // C
        positions.push(Bx, By, Bz + zOffsetB); // D

        // The indices of the side are the following
        // [A, B, C, C, B, D] to form the two triangles.

        const A = 0;
        const B = 1;
        const C = 2;
        const D = 3;

        const idx = pointCount + vertexOffset;

        indices.push(idx + A);
        indices.push(idx + B);
        indices.push(idx + C);

        indices.push(idx + C);
        indices.push(idx + B);
        indices.push(idx + D);

        vertexOffset += 4;
    }
}

function createSurfaces(polygon: Polygon, options: PolygonOptions) {
    const stride = polygon.getStride();

    // First we compute the positions of the top vertices (that make the 'floor').
    // note that in some dataset, it's the roof and user needs to extrusionOffset down.
    const coordinates = polygon.getCoordinates();

    const { flatCoordinates, holes } = createFloorVertices({
        coordinates,
        stride,
        ignoreZ: options.ignoreZ ?? false,
        offset: options.origin ?? ZERO,
        elevation: options.elevation,
    });

    const pointCount = flatCoordinates.length / 3;

    const triangles = Earcut(flatCoordinates, holes, 3);

    if (options.extrusionOffset != null) {
        createRoof(flatCoordinates, pointCount, triangles, options.extrusionOffset);

        createWallForRings(
            flatCoordinates,
            0,
            holes[0] || pointCount,
            triangles,
            options.extrusionOffset,
        );

        for (let i = 0; i < holes.length; i++) {
            createWallForRings(
                flatCoordinates,
                holes[i],
                holes[i + 1] || pointCount,
                triangles,
                options.extrusionOffset,
            );
        }
    }

    const positions = new Float32Array(flatCoordinates);

    const indices =
        positions.length <= 65536 ? new Uint16Array(triangles) : new Uint32Array(triangles);

    return { positions, indices };
}

const tempOrigin = new Vector3();

function createPositionBuffer(coordinates: Coordinate[], options: BaseOptions): Float32Array {
    const bufferSize = 3 * coordinates.length;
    const result = new Float32Array(bufferSize);

    const origin = tempOrigin;
    const ignoreZ = options.ignoreZ;

    if (options.origin) {
        origin.copy(options.origin);
    } else {
        origin.set(0, 0, 0);
    }

    for (let i = 0; i < coordinates.length; i++) {
        const p = coordinates[i];

        const i0 = i * 3;

        const x = p[0];
        const y = p[1];
        const z = ignoreZ === true ? 0 : (p[2] ?? 0);

        result[i0 + 0] = x - origin.x;
        result[i0 + 1] = y - origin.y;
        result[i0 + 2] = z - origin.z;
    }

    return result;
}

interface GeometryGeneratorEventMap {
    'texture-loaded': { texture: Texture };
}

/**
 * Generates three.js meshes from OpenLayers geometries.
 *
 * Supported geometries:
 * - Point / MultiPoint
 * - LineString / MultiLineString
 * - Polygon / MultiPolygon, 2D or 3D (extruded).
 *
 * Important note: features with the same styles will share the same material instance, to
 * avoid duplication and improve performance. This means that modifying the material will
 * affect all geometries that use it.
 */
export default class GeometryConverter<
    UserData extends DefaultUserData = DefaultUserData,
> extends EventDispatcher<GeometryGeneratorEventMap> {
    private readonly _materialCache: Map<unknown, Material> = new Map();
    private readonly _downloadQueue = new RequestQueue();
    private readonly _downloadedTextures: Map<string, Texture> = new Map();
    private readonly _shadedSurfaceMaterialGenerator: SurfaceMaterialGenerator;
    private readonly _unshadedSurfaceMaterialGenerator: SurfaceMaterialGenerator;
    private readonly _lineMaterialGenerator: LineMaterialGenerator;
    private readonly _pointMaterialGenerator: PointMaterialGenerator;
    private _disposed = false;

    constructor(options?: {
        shadedSurfaceMaterialGenerator?: SurfaceMaterialGenerator;
        unshadedSurfaceMaterialGenerator?: SurfaceMaterialGenerator;
        lineMaterialGenerator?: LineMaterialGenerator;
        pointMaterialGenerator?: PointMaterialGenerator;
    }) {
        super();

        this._shadedSurfaceMaterialGenerator =
            options?.shadedSurfaceMaterialGenerator ?? this.getShadedSurfaceMaterial.bind(this);

        this._unshadedSurfaceMaterialGenerator =
            options?.unshadedSurfaceMaterialGenerator ?? this.getUnshadedSurfaceMaterial.bind(this);

        this._lineMaterialGenerator =
            options?.lineMaterialGenerator ?? this.getLineMaterial.bind(this);

        this._pointMaterialGenerator =
            options?.pointMaterialGenerator ?? this.getSpriteMaterial.bind(this);
    }

    /**
     * Gets whether this generator is disposed. A disposed generator can no longer be used.
     */
    get disposed() {
        return this._disposed;
    }

    get materialCount() {
        return this._materialCache.size;
    }

    // Convenience overloads
    /**
     * Converts a {@link Point}.
     * @param geometry - The `Point` to convert.
     * @param options  - The options.
     */
    build(geometry: Point, options?: PointOptions): PointMesh<UserData>;

    /**
     * Converts a {@link MultiPoint}.
     * @param geometry - The `MultiPoint` to convert.
     * @param options  - The options.
     */
    build(geometry: MultiPoint, options?: PointOptions): MultiPointMesh<UserData>;

    /**
     * Converts a {@link MultiPoint} or {@link Point}.
     * @param geometry - The `MultiPoint` or `Point` to convert.
     * @param options  - The options.
     */
    build(geometry: Point | MultiPoint, options?: PointOptions): SimpleGeometryMesh<UserData>;

    /**
     * Converts a {@link Polygon}.
     * @param geometry - The `Polygon` to convert.
     * @param options  - The options.
     */
    build(geometry: Polygon, options?: PolygonOptions): PolygonMesh<UserData>;

    /**
     * Converts a {@link MultiPolygon}.
     *
     * Note: if the `MultiPolygon` has only one polygon, then a {@link PolygonMesh} is returned instead of a {@link MultiPolygonMesh}.
     * @param geometry - The `MultiPolygon` to convert.
     * @param options  - The options.
     */
    build(
        geometry: MultiPolygon,
        options?: PolygonOptions,
    ): PolygonMesh<UserData> | MultiPolygonMesh<UserData>;

    /**
     * Converts a {@link Polygon}.
     * @param geometry - The `Polygon` to convert.
     * @param options  - The options.
     */
    build(geometry: Polygon | MultiPolygon, options?: PolygonOptions): SimpleGeometryMesh<UserData>;

    /**
     * Converts a {@link LineString}.
     * @param geometry - The `LineString` to convert.
     * @param options  - The options.
     */
    build(geometry: LineString, options?: LineOptions): LineStringMesh<UserData>;

    /**
     * Converts a {@link MultiLineString}.
     *
     * Note: if the `MultiLineString` has only one polygon, then a {@link LineStringMesh} is returned instead of a {@link MultiLineStringMesh}.
     * @param geometry - The `MultiLineString` to convert.
     * @param options  - The options.
     */
    build(
        geometry: MultiLineString,
        options?: LineOptions,
    ): MultiLineStringMesh<UserData> | LineStringMesh<UserData>;

    /**
     * Converts a {@link MultiLineString} or {@link LineString}.
     *
     * Note: if the `MultiLineString` has only one polygon, then a {@link LineStringMesh} is returned instead of a {@link MultiLineStringMesh}.
     * @param geometry - The `MultiLineString` or `LineString` to convert.
     * @param options  - The options.
     */
    build(
        geometry: LineString | MultiLineString,
        options?: LineOptions,
    ): SimpleGeometryMesh<UserData>;

    /**
     * Create 3D objects from the input geometry and options.
     * @param geometry - The geometry to transform.
     * @param options - The options.
     * @returns The generated 3D object(s).
     */
    build<K extends keyof OutputMap>(
        geometry: InputMap[K],
        options?: OptionMap[K],
    ): OutputMap<UserData>[K] {
        type ReturnType = OutputMap<UserData>[K];

        options = options ?? {};

        this.setDefaultOrigin(geometry, options);

        let result: ReturnType;

        switch (geometry.getType()) {
            case 'LineString':
                result = this.buildLineString(
                    geometry as LineString,
                    options as LineOptions,
                ) as ReturnType;
                break;
            case 'MultiLineString':
                result = this.buildMultiLineString(
                    geometry as MultiLineString,
                    options as LineOptions,
                ) as ReturnType;
                break;
            case 'Point':
                result = this.buildPoint(geometry as Point, options as PointOptions) as ReturnType;
                break;
            case 'MultiPoint':
                result = this.buildMultiPoint(
                    geometry as MultiPoint,
                    options as PointOptions,
                ) as ReturnType;
                break;
            case 'Polygon':
                result = this.buildPolygon(
                    geometry as Polygon,
                    options as PolygonOptions,
                ) as ReturnType;
                break;
            case 'MultiPolygon':
                result = this.buildMultiPolygon(
                    geometry as MultiPolygon,
                    options as PolygonOptions,
                ) as ReturnType;
                break;
            default:
                throw new Error('unimplemented');
        }

        this.finalize(result, options);

        return result;
    }

    updatePolygonMesh(mesh: PolygonMesh, options: PolygonOptions) {
        if (options.stroke && mesh.linearRings == null) {
            // If the style is added, we have to create the rings
            const rings = this.getPolygonRings(mesh.source, options);
            mesh.linearRings = rings;
        } else if (!options.stroke && mesh.linearRings != null) {
            // If the style is removed, we have to remove the rings
            mesh.linearRings = null;
        } else if (mesh.linearRings) {
            // Else, just update the existing rings with the new style
            const stroke = getFullStrokeStyle(options.stroke);
            const lineMaterial = this._lineMaterialGenerator(stroke);
            mesh.linearRings.forEach(ring =>
                ring.update({
                    material: lineMaterial,
                    opacity: stroke.opacity,
                    renderOrder: stroke.renderOrder,
                }),
            );
        }

        if (!options.fill && mesh.surface != null) {
            // If there is a surface, but no surface style, we must hide the existing surface
            mesh.surface.visible = false;
        } else if (options.fill && mesh.surface == null) {
            // If the surface does not exist, we have to create it
            const surface = this.getSurfaceMesh(mesh.source, options);
            mesh.surface = surface;
        } else if (options.fill && mesh.surface) {
            const fill = getFullFillStyle(options.fill);

            const surfacematerial = mesh.isExtruded
                ? this._shadedSurfaceMaterialGenerator(fill)
                : this._unshadedSurfaceMaterialGenerator(fill);

            mesh.surface.update({
                material: surfacematerial,
                opacity: fill.opacity,
                renderOrder: fill.renderOrder,
            });
        }
    }

    updateMultiPolygonMesh(mesh: MultiPolygonMesh, options: PolygonOptions) {
        mesh.traversePolygons(obj => this.updatePolygonMesh(obj, options));
    }

    updateMultiLineStringMesh(mesh: MultiLineStringMesh, options: LineOptions) {
        mesh.traverseLineStrings(obj => this.updateLineStringMesh(obj, options));
    }

    updateLineStringMesh(mesh: LineStringMesh, options: LineOptions) {
        const style = getFullStrokeStyle(options);
        const lineMaterial = this._lineMaterialGenerator(style);

        mesh.update({
            material: lineMaterial,
            opacity: style.opacity,
            renderOrder: style.renderOrder,
        });
    }

    updatePointMesh(mesh: PointMesh, style: Partial<PointStyle>) {
        const fullStyle = getFullPointStyle(style);
        const material = this._pointMaterialGenerator(fullStyle);
        mesh.update({
            material,
            pointSize: fullStyle.pointSize,
            opacity: fullStyle.opacity,
            renderOrder: fullStyle.renderOrder,
        });
    }

    updateSurfaceMesh(mesh: SurfaceMesh, options: PolygonOptions) {
        if (mesh.parent == null) {
            throw new Error('mesh has no parent polygon');
        }
        this.updatePolygonMesh(mesh.parent, options);
    }

    /**
     * Perform the last transformation on generated objects.
     * @param object - The object to finalize.
     * @param options - Options
     */
    private finalize(object: Object3D, options: BaseOptions & BaseStyle) {
        if (options.origin) {
            object.position.copy(options.origin);
        }

        object.traverse(desc => {
            desc.updateMatrix();
        });
        object.updateMatrixWorld(true);
    }

    private getSurfaceGeometry(polygon: Polygon, options: PolygonOptions): BufferGeometry {
        const { positions, indices } = createSurfaces(polygon, options);

        const surfaceGeometry = new BufferGeometry();
        surfaceGeometry.setAttribute('position', new BufferAttribute(positions, 3));
        surfaceGeometry.setIndex(new BufferAttribute(indices, 1));

        surfaceGeometry.computeBoundingBox();
        surfaceGeometry.computeBoundingSphere();

        return surfaceGeometry;
    }

    /**
     * If origin has not be set, compute a default origin point by taking the first
     * coordinate of the geometry.
     */
    private setDefaultOrigin(geometry: Geometry, options: BaseOptions) {
        if (options.origin != null) {
            return;
        }

        let first: Coordinate;

        switch (geometry.getType()) {
            case 'LineString':
            case 'LinearRing':
            case 'Polygon':
            case 'MultiLineString':
            case 'MultiPolygon':
                first = (
                    geometry as LineString | LinearRing | Polygon | MultiLineString | MultiPolygon
                ).getFirstCoordinate();
                break;
            default:
                // TODO What to do with other types (GeometryCollection) ?
                return;
        }

        if (first != null) {
            const x = first[0] ?? 0;
            const y = first[1] ?? 0;
            const z = first[2] ?? 0;

            options.origin = new Vector3(x, y, z);
        }
    }

    private getSurfaceMesh(polygon: Polygon, options: PolygonOptions): SurfaceMesh {
        // In the case of 3D surfaces, we opt for a shaded material,
        // whereas in the case of flat polygons, we use an unshaded material.
        const fill = getFullFillStyle(options.fill);

        const material =
            options.extrusionOffset != null
                ? this._shadedSurfaceMaterialGenerator(fill)
                : this._unshadedSurfaceMaterialGenerator(fill);

        const geometry = this.getSurfaceGeometry(polygon, options);

        const surface = new SurfaceMesh({ geometry, material, opacity: fill.opacity });

        // Surfaces can either be extruded (3D) or non-extruded (2D).
        if (options.extrusionOffset != null) {
            geometry.computeVertexNormals();
        }

        surface.renderOrder = fill.renderOrder;

        return surface;
    }

    private getPolygonRings(polygon: Polygon, options: PolygonOptions): LineStringMesh[] {
        const ringCount = polygon.getLinearRingCount();
        const linearRings: LineStringMesh[] = [];
        for (let i = 0; i < ringCount; i++) {
            const inputRing = polygon.getLinearRing(i);
            if (inputRing) {
                const lineString = new LineString(inputRing.getCoordinates());
                const ring = this.buildLineString(lineString, {
                    origin: options.origin,
                    ignoreZ: options.ignoreZ,
                    ...options.stroke,
                });
                linearRings.push(ring);
            }
        }

        return linearRings;
    }

    private buildPolygon(polygon: Polygon, options: PolygonOptions): PolygonMesh {
        let surface: SurfaceMesh | undefined = undefined;
        let linearRings: LineStringMesh[] | undefined = undefined;

        if (options.fill) {
            surface = this.getSurfaceMesh(polygon, options);
        }

        // If line style is specified, we draw the linear rings of the polygon
        if (options.stroke) {
            linearRings = this.getPolygonRings(polygon, options);
        }

        const result = new PolygonMesh({
            source: polygon,
            surface,
            linearRings,
            isExtruded: options.extrusionOffset != null,
        });

        return result;
    }

    private buildMultiPolygon(
        multiPolygon: MultiPolygon,
        options: PolygonOptions,
    ): MultiPolygonMesh | PolygonMesh {
        const inputGeometries = multiPolygon.getPolygons();

        // Optimization
        if (inputGeometries.length === 1) {
            return this.buildPolygon(inputGeometries[0], options);
        }

        const polygons: PolygonMesh[] = [];
        for (const polygon of inputGeometries) {
            const p = this.buildPolygon(polygon, options);

            polygons.push(p);
        }

        const result = new MultiPolygonMesh(polygons);

        return result;
    }

    private buildPointMesh(point: Point, options: PointOptions): PointMesh {
        const style = getFullPointStyle(options);
        const material = this._pointMaterialGenerator(style);

        const coordinate = point.getCoordinates();

        const pointMesh = new PointMesh({
            material,
            opacity: style.opacity,
            pointSize: style.pointSize,
        });

        pointMesh.renderOrder = style.renderOrder;

        pointMesh.position.setX(coordinate[0] ?? 0);
        pointMesh.position.setY(coordinate[1] ?? 0);
        pointMesh.position.setZ(coordinate[2] ?? 0);

        return pointMesh;
    }

    private buildPoint(point: Point, options: PointOptions): PointMesh {
        return this.buildPointMesh(point, options);
    }

    private buildMultiPoint(multiPoint: MultiPoint, options: PointOptions): MultiPointMesh {
        return new MultiPointMesh(multiPoint.getPoints().map(p => this.buildPointMesh(p, options)));
    }

    private getShadedSurfaceMaterial(style: Required<FillStyle>): MeshLambertMaterial {
        if (style == null) {
            throw new Error('missing style');
        }

        const key = hashStyle('shaded-surface', style);

        if (this._materialCache.has(key)) {
            return this._materialCache.get(key) as MeshLambertMaterial;
        }

        const { color, opacity, depthTest } = style;

        const material = new MeshLambertMaterial({
            color,
            opacity,
            transparent: opacity < 1,
            side: DoubleSide,
            depthTest,
            depthWrite: depthTest,
        });

        this._materialCache.set(key, material);

        return material;
    }

    private getUnshadedSurfaceMaterial(style: Required<FillStyle>): MeshBasicMaterial {
        if (style == null) {
            throw new Error('missing style');
        }

        const key = hashStyle('unshaded-surface', style);

        if (this._materialCache.has(key)) {
            return this._materialCache.get(key) as MeshBasicMaterial;
        }

        const { color, opacity, depthTest } = style;

        const material = new MeshBasicMaterial({
            color,
            opacity,
            transparent: opacity < 1,
            side: DoubleSide,
            depthTest,
            depthWrite: depthTest,
        });

        this._materialCache.set(key, material);

        return material;
    }

    private getSpriteMaterial(style: Required<PointStyle>): SpriteMaterial {
        if (style == null) {
            throw new Error('missing style');
        }

        // TODO support point shapes
        // TODO support image placement (hotspot)
        const styleKey = hashStyle('sprite', style);

        if (this._materialCache.has(styleKey)) {
            return this._materialCache.get(styleKey) as SpriteMaterial;
        }

        const { color, opacity, sizeAttenuation, depthTest } = style;

        const result = new SpriteMaterial({
            color,
            opacity,
            transparent: true,
            sizeAttenuation,
            depthTest,
            depthWrite: depthTest,
            map:
                style.image != null
                    ? isTexture(style.image)
                        ? style.image
                        : this.getCachedTexture(style.image)
                    : null,
        });

        // Download image from URL
        if (typeof style.image === 'string' && result.map == null) {
            // Hide material until the image is loaded to avoid displaying a blank square.
            result.visible = false;

            // Download the image
            this.loadRemoteTexture(style.image)
                .then(texture => {
                    result.map = texture;
                    result.needsUpdate = true;
                    result.visible = true;
                    result.transparent = true;
                })
                .catch(console.error);
        }

        this._materialCache.set(styleKey, result);

        return result;
    }

    private getCachedTexture(url: string): Texture | null {
        const cached = this._downloadedTextures.get(url);
        if (cached) {
            return cached;
        }

        return null;
    }

    private loadRemoteTexture(url: string): Promise<Texture> {
        const cached = this._downloadedTextures.get(url);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this._downloadQueue.enqueue({
            id: url,
            request: () => this.fetchTexture(url),
        });
    }

    private fetchTexture(url: string): Promise<Texture> {
        // Download the image
        return Fetcher.texture(url, { flipY: true }).then(texture => {
            texture.colorSpace = SRGBColorSpace;
            this._downloadedTextures.set(url, texture);
            texture.generateMipmaps = true;
            this.dispatchEvent({ type: 'texture-loaded', texture });
            return texture;
        });
    }

    private getLineMaterial(style: Required<StrokeStyle>): LineMaterial {
        if (style == null) {
            throw new Error('missing style');
        }

        const styleKey = hashStyle('line', style);

        if (this._materialCache.has(styleKey)) {
            return this._materialCache.get(styleKey) as LineMaterial;
        }

        const { color, lineWidth, opacity, lineWidthUnits, depthTest } = style;

        const material = new LineMaterial({
            color,
            linewidth: lineWidth, // Notice the different case
            opacity,
            transparent: opacity < 1,
            worldUnits: lineWidthUnits === 'world',
            depthTest,
            depthWrite: depthTest,
        });

        this._materialCache.set(styleKey, material);

        return material;
    }

    private getLineGeometry(coordinates: Coordinate[], options: BaseOptions): LineGeometry {
        const result = new LineGeometry();
        result.setPositions(createPositionBuffer(coordinates, options));
        result.computeBoundingBox();

        return result;
    }

    private buildLineString(
        geometry: LineString,
        options: OptionMap['LineString'],
    ): LineStringMesh {
        const fullStyle = getFullStrokeStyle(options);
        const lineStringMesh = new LineStringMesh(
            this.getLineGeometry(geometry.getCoordinates(), options),
            this._lineMaterialGenerator(fullStyle),
            fullStyle.opacity,
        );

        lineStringMesh.renderOrder = fullStyle.renderOrder;

        return lineStringMesh;
    }

    private buildMultiLineString(
        geometry: MultiLineString,
        options: OptionMap['MultiLineString'],
    ): MultiLineStringMesh | LineStringMesh {
        const lineStrings = geometry.getLineStrings();

        // Optimization
        if (lineStrings.length === 1) {
            return this.buildLineString(lineStrings[0], options);
        }

        const meshes: LineStringMesh[] = [];
        for (const line of lineStrings) {
            const lineStringMesh = this.buildLineString(line, options);

            meshes.push(lineStringMesh);
        }

        return new MultiLineStringMesh(meshes);
    }

    /**
     * Disposes this generator and all cached materials. Once disposed, this generator cannot be used anymore.
     */
    dispose({
        disposeTextures = true,
        disposeMaterials = true,
    }: {
        /** Dispose the textures created by this generator */
        disposeTextures?: boolean;
        /** Dispose the materials created by this generator */
        disposeMaterials?: boolean;
    }) {
        if (this._disposed) {
            return;
        }
        if (disposeTextures) {
            this._downloadedTextures.forEach(texture => texture.dispose());
        }
        if (disposeMaterials) {
            this._materialCache.forEach(material => material.dispose());
        }
        this._downloadedTextures.clear();
        this._materialCache.clear();
    }
}
