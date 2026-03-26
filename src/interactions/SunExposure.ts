/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { BufferAttribute, BufferGeometry, ColorRepresentation, Matrix4, Side } from 'three';

import {
    Box3,
    Box3Helper,
    CameraHelper,
    DataTexture,
    DepthTexture,
    DoubleSide,
    EventDispatcher,
    Float32BufferAttribute,
    FloatType,
    Group,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    OrthographicCamera,
    Plane,
    PlaneGeometry,
    RedFormat,
    Sphere,
    Triangle,
    UnsignedIntType,
    Vector2,
    Vector3,
    WebGLRenderTarget,
    type Object3D,
} from 'three';
import { Lut, MeshSurfaceSampler } from 'three/examples/jsm/Addons.js';

import type Disposable from '../core/Disposable';
import type Instance from '../core/Instance';
import type Progress from '../core/Progress';
import type Entity3D from '../entities/Entity3D';
import type Map from '../entities/Map';
import type { PointCloudAttribute } from '../sources/PointCloudSource';

import ColorMap from '../core/ColorMap';
import Coordinates from '../core/geographic/Coordinates';
import CoordinateSystem from '../core/geographic/CoordinateSystem';
import Extent from '../core/geographic/Extent';
import Sun from '../core/geographic/Sun';
import OperationCounter from '../core/OperationCounter';
import { Vector3Array } from '../core/VectorArray';
import { isEntity3D } from '../entities/Entity3D';
import { isMap } from '../entities/Map';
import PointCloud from '../entities/PointCloud';
import StaticPointCloudSource from '../sources/StaticPointCloudSource';
import { isMesh } from '../utils/predicates';
import PromiseUtils from '../utils/PromiseUtils';
import TextureGenerator from '../utils/TextureGenerator';
import { nonNull } from '../utils/tsutils';

const DEFAULT_COLOR_MAP = new ColorMap({
    colors: new Lut('rainbow').lut,
    min: 0,
    max: 1,
});

interface Limits {
    probes: Box3;
    shadowCasters: Box3;
}

/**
 * The names of the computed variables.
 * - `meanIrradiance` (in Watts/square meter) is the mean irradiance received by the surface over the
 *   time period.
 * - `irradiation` (in Watt-hours/square meter) is the cumulated energy received by the surface over
 *   the time period
 * - `hoursOfSunlight` is the total number of hours that the surface was exposed to direct sunlight.
 */
export type VariableName = 'meanIrradiance' | 'irradiation' | 'hoursOfSunlight';

const attributeDescriptors: Record<VariableName, PointCloudAttribute> = {
    meanIrradiance: {
        name: 'meanIrradiance',
        dimension: 1,
        interpretation: 'unknown',
        size: 4,
        type: 'float',
    },
    irradiation: {
        name: 'irradiation',
        dimension: 1,
        interpretation: 'unknown',
        size: 4,
        type: 'float',
    },
    hoursOfSunlight: {
        name: 'hoursOfSunlight',
        dimension: 1,
        interpretation: 'unknown',
        size: 4,
        type: 'float',
    },
};

const temp = {
    x: new Vector3(),
    y: new Vector3(),
    z: new Vector3(),
    sphere: new Sphere(),
    coordinates: new Coordinates(CoordinateSystem.unknown, 0, 0),
    dimensions: new Vector2(),
    box: new Box3(),
    plane: new Plane(),
    position: new Vector3(),
    normal: new Vector3(),
};

/**
 * The solar constant, in Watts / m².
 * Taken from https://en.wikipedia.org/wiki/Solar_constant
 */
export const SOLAR_CONSTANT = 1361;

/**
 * The amount of solar energy that is absorbed by the atmosphere.
 * 25% is typical for a clear sky.
 */
export const ATMOSPHERIC_ABSORPTION = 0.25;

/**
 * The result of the computation.
 */
export interface ComputationResult {
    /**
     * The generated point cloud. This is the same entity
     * as seen in the preview during computation. This point
     * cloud contains one attribute per solar variable.
     */
    entity: PointCloud;
    /**
     * The computed variables. Note that those variables are already
     * set up in the {@link entity}. However if for some reason you
     * want to use them for other purposes, you can access them directly here.
     */
    variables: Record<VariableName, SolarVariable>;
}

interface SimulationStep {
    date: Date;
    sunDirection: Vector3;
    /** The duration, in seconds */
    duration: number;
}

function createSimulationStep(
    observer: Coordinates,
    date: Date,
    duration: number,
    isGlobe: boolean,
): SimulationStep {
    const sunDirection = isGlobe
        ? Sun.getDirection(date)
        : Sun.getLocalFrameDirection(observer, date);

    return {
        date,
        sunDirection,
        duration,
    };
}

function getBoxCorners(box: Box3): Vector3[] {
    const c0 = new Vector3(box.min.x, box.min.y, box.min.z);
    const c1 = new Vector3(box.min.x, box.min.y, box.max.z);

    const c2 = new Vector3(box.max.x, box.min.y, box.min.z);
    const c3 = new Vector3(box.max.x, box.min.y, box.max.z);

    const c4 = new Vector3(box.max.x, box.max.y, box.min.z);
    const c5 = new Vector3(box.max.x, box.max.y, box.max.z);

    const c6 = new Vector3(box.min.x, box.max.y, box.min.z);
    const c7 = new Vector3(box.min.x, box.max.y, box.max.z);

    return [c0, c1, c2, c3, c4, c5, c6, c7];
}

function createSimulationSteps(
    observer: Coordinates,
    start: Date,
    end: Date | undefined,
    stepDurationSeconds: number,
    isGlobe: boolean,
): SimulationStep[] {
    const result: SimulationStep[] = [];

    const timeIncrementMs = stepDurationSeconds * 1000;

    if (end != null) {
        const interval = end.valueOf() - start.valueOf();
        let current = 0;
        while (current < interval) {
            const date = new Date(start.getTime() + current);

            result.push(createSimulationStep(observer, date, stepDurationSeconds, isGlobe));

            current += timeIncrementMs;
        }

        result.push(createSimulationStep(observer, end, stepDurationSeconds, isGlobe));
    } else {
        result.push(createSimulationStep(observer, start, stepDurationSeconds, isGlobe));
    }

    return result;
}

function iterateTriangles(
    objects: Object3D[],
    callback: (triangle: Readonly<Triangle>, worldMatrix: Matrix4, side: Side) => void,
): void {
    const tri = new Triangle(new Vector3(), new Vector3(), new Vector3());

    const visitor = (obj: Object3D): void => {
        if (isMesh(obj)) {
            const geom = obj.geometry;
            const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;

            if (!material.visible) {
                return;
            }

            const positions = geom.getAttribute('position');

            if (geom.index == null) {
                for (let i = 0; i < positions.count; i += 3) {
                    const ia = i + 0;
                    const ib = i + 1;
                    const ic = i + 2;

                    tri.a.set(positions.getX(ia), positions.getY(ia), positions.getZ(ia));
                    tri.b.set(positions.getX(ib), positions.getY(ib), positions.getZ(ib));
                    tri.c.set(positions.getX(ic), positions.getY(ic), positions.getZ(ic));

                    tri.a.applyMatrix4(obj.matrixWorld);
                    tri.b.applyMatrix4(obj.matrixWorld);
                    tri.c.applyMatrix4(obj.matrixWorld);

                    callback(tri, obj.matrixWorld, material.side);
                }
            } else {
                const indices = geom.index.array;

                for (let i = 0; i < indices.length; i += 3) {
                    const ia = indices[i + 0];
                    const ib = indices[i + 1];
                    const ic = indices[i + 2];

                    tri.a.set(positions.getX(ia), positions.getY(ia), positions.getZ(ia));
                    tri.b.set(positions.getX(ib), positions.getY(ib), positions.getZ(ib));
                    tri.c.set(positions.getX(ic), positions.getY(ic), positions.getZ(ic));

                    tri.a.applyMatrix4(obj.matrixWorld);
                    tri.b.applyMatrix4(obj.matrixWorld);
                    tri.c.applyMatrix4(obj.matrixWorld);

                    callback(tri, obj.matrixWorld, material.side);
                }
            }
        }
    };

    for (const obj of objects) {
        obj.updateMatrixWorld(true);
        obj.traverseVisible(visitor);
    }
}

/**
 * Describes a single measured value for all probes.
 */
export interface SolarVariable {
    /** The variable values for all probes. Can directly be used
     * as a buffer attribute for a geometry.
     */
    buffer: BufferAttribute;
    /** The average value of the variable across all probes */
    mean: number;
    /** The minimum value of the variable across all probes */
    min: number;
    /** The maximum value of the variable across all probes */
    max: number;
}

interface ProbeCollection {
    origin: Vector3;
    /** The number of probes in this collection */
    length: number;
    /** Probe positions, expressed relative to the origin */
    positions: Vector3Array;
    normals: Vector3Array;
    numIterations: number;
    variables: Record<VariableName, SolarVariable>;
}

function createTerrainGeometry(params: {
    map: Map;
    spatialResolution: number;
    areaOfInterest: Extent;
}): {
    geometry: BufferGeometry;
    widthSegments: number;
    heightSegments: number;
    isFlat: boolean;
    center: Vector3;
} {
    const { map, spatialResolution, areaOfInterest } = params;
    const extent = areaOfInterest.clone().intersect(map.extent);
    const { width, height } = extent.dimensions(temp.dimensions);
    const layers = map.getElevationLayers();

    // If there are no (visible) elevation layers, then the terrain is simply a flat plane,
    // in that case we want the simplest geometry (2 triangles) to speedup computation.
    if (layers.length === 0 || layers.every(l => !l.visible)) {
        return {
            geometry: new PlaneGeometry(width, height),
            isFlat: true,
            widthSegments: 1,
            heightSegments: 1,
            center: extent.centerAsVector3(),
        };
    }

    const res = spatialResolution;
    const MAX_SEGMENTS = 500;
    const widthSegments = Math.min(Math.ceil(width / res), MAX_SEGMENTS);
    const heightSegments = Math.min(Math.ceil(height / res), MAX_SEGMENTS);
    const result = new PlaneGeometry(width, height, widthSegments, heightSegments);

    const uv = result.getAttribute('uv');
    const pos = result.getAttribute('position');

    for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);

        const coordinates = extent.sampleUV(u, v, temp.coordinates);
        const samples = map.getElevation({ coordinates }).samples;
        samples.sort((a, b) => a.resolution - b.resolution);
        const z = samples[0].elevation;
        pos.setZ(i, z);
    }

    result.computeVertexNormals();

    return {
        geometry: result,
        widthSegments,
        heightSegments,
        isFlat: false,
        center: extent.centerAsVector3(),
    };
}

function collectObjectProbe(
    obj: Object3D,
    origin: Vector3,
    limits: Box3 | Sphere,
    spatialResolution: number,
    positions: Vector3Array,
    normals: Vector3Array,
): void {
    const meshes: Mesh[] = [];
    const sampleArea = spatialResolution * spatialResolution;

    obj.updateMatrixWorld(true);

    // Let's collect the meshes within the volume
    obj.traverseVisible(o => {
        if (isMesh(o)) {
            if (o.geometry.boundingBox == null) {
                o.geometry.computeBoundingBox();
            }
            const localBox = nonNull(o.geometry.boundingBox);
            const worldBox = temp.box.copy(localBox).applyMatrix4(o.matrixWorld);
            if (limits.intersectsBox(worldBox)) {
                meshes.push(o);
            }
        }
    });

    for (const mesh of meshes) {
        let area = 0;

        iterateTriangles([mesh], tri => {
            area += tri.getArea();
        });

        const numSamples = Math.ceil(area / sampleArea) + 1;
        const sampler = new MeshSurfaceSampler(mesh);
        sampler.build();

        for (let i = 0; i < numSamples; i++) {
            sampler.sample(temp.position, temp.normal);
            temp.position.applyMatrix4(mesh.matrixWorld);
            if (limits.containsPoint(temp.position)) {
                temp.position.sub(origin);
                positions.pushVector(temp.position);
                normals.pushVector(temp.normal);
            }
        }
    }
}

function collectProbes(
    objects: (Object3D | Entity3D)[],
    origin: Vector3,
    limits: Box3 | Sphere,
    spatialResolution: number,
): ProbeCollection {
    const INITIAL_SIZE = 8192 * 3;
    const positions = new Vector3Array(new Float32Array(INITIAL_SIZE));
    positions.length = 0;
    const normals = new Vector3Array(new Float32Array(INITIAL_SIZE));
    normals.length = 0;

    for (const obj of objects) {
        const root = isEntity3D(obj) ? obj.object3d : obj;
        collectObjectProbe(root, origin, limits, spatialResolution, positions, normals);
    }

    const numProbes = positions.length;

    return {
        length: normals.length,
        origin,
        positions,
        normals,
        numIterations: 0,

        variables: {
            meanIrradiance: {
                buffer: new Float32BufferAttribute(new Float32Array(numProbes), 1),
                mean: 0,
                min: +Infinity,
                max: -Infinity,
            },
            irradiation: {
                buffer: new Float32BufferAttribute(new Float32Array(numProbes), 1),
                mean: 0,
                min: +Infinity,
                max: -Infinity,
            },
            hoursOfSunlight: {
                buffer: new Float32BufferAttribute(new Float32Array(numProbes), 1),
                mean: 0,
                min: +Infinity,
                max: -Infinity,
            },
        },
    };
}

function collectOptimizedMeshes(
    objects: (Object3D | Entity3D)[],
    origin: Vector3,
    limitsAsExtent: Extent,
    limits: Box3,
    spatialResolution: number,
): { meshes: Mesh[]; disposeFn: VoidFunction } {
    const simulationMaterial = new MeshStandardMaterial({
        color: 'red',
        side: DoubleSide,
    });

    const objectsToDispose: BufferGeometry[] = [];
    const result: Mesh[] = [];

    for (const obj of objects) {
        if (isMap(obj)) {
            // We don't need the full spatial resolution for
            // terrains meshe as we rely on vertex interpolation.
            const res = spatialResolution * 2;
            const terrain = createTerrainGeometry({
                map: obj,
                spatialResolution: res,
                areaOfInterest: limitsAsExtent,
            });
            const mesh = new Mesh(terrain.geometry, simulationMaterial);

            mesh.position.copy(terrain.center);
            mesh.updateMatrixWorld(true);

            result.push(mesh);

            objectsToDispose.push(terrain.geometry);
        } else {
            obj.traverse(o => {
                if (o.visible && isMesh(o)) {
                    o.updateMatrixWorld();

                    const bounds = temp.box.setFromObject(o);

                    if (bounds.intersectsBox(limits)) {
                        const geometry = o.geometry;
                        geometry.computeBoundingBox();

                        const mesh = new Mesh(geometry, simulationMaterial);

                        o.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);

                        mesh.updateMatrixWorld(true);

                        objectsToDispose.push(geometry);

                        result.push(mesh);
                    }
                }
            });
        }
    }

    return { meshes: result, disposeFn: () => objectsToDispose.forEach(obj => obj.dispose()) };
}

export interface SunExposureOptions {
    /**
     * The Giro3D instance to use. This must be the same instance
     * as the one that will host the resulting point cloud.
     */
    instance: Instance;
    /**
     * The objects to include in the computation.
     */
    objects: Array<Entity3D | Object3D>;
    /**
     * The area of interest to limit the simulation.
     * The smaller the area of interest, the faster the simulation will be.
     */
    limits: Extent | Box3 | Sphere;
    /**
     * The date at the start of the simulation time range.
     */
    start: Date;
    /**
     * The date at the end of the simulation time range.
     * If unspecified, then the time range will be [start, start]
     * and only one simulation step will be performed.
     */
    end?: Date;
    /**
     * The color map to use on the point cloud preview to display irradiation.
     * Note that once the computation is finished, you
     * can modify the colormaps on the resulting point cloud.
     * @defaultValue a rainbow colormap
     */
    colorMap?: ColorMap;
    /**
     * The spatial resolution, in scene units. This is the
     * average space between simulation probes. If unspecified,
     * a default value is computed from the dimensions of {@link limits}.
     */
    spatialResolution?: number;
    /**
     * If true, show helpers to help visualize the computation steps.
     * Helpers will remain visible until the dispose() method is called.
     * @defaultValue false
     */
    showHelpers?: boolean;
    /**
     * The temporal resolution, in seconds. This is the interval
     * between simulation steps. If {@link end} was not set,
     * then this parameter has no effect.
     * @defaultValue 3600
     */
    temporalResolution?: number;
}

export interface SunExposureEventMap {
    /** Raised when the simulation progress changes */
    progress: { progress: number };
}

interface Output {
    pointCloud: PointCloud;
    source: StaticPointCloudSource;
    irradiance: Float32BufferAttribute;
    hoursOfSunlight: Float32BufferAttribute;
    irradiation: Float32BufferAttribute;
}

function getDefaultSpatialResolution(limits: Extent | Box3 | Sphere): number {
    let size: number;

    if (limits instanceof Extent) {
        const dims = limits.dimensions(temp.dimensions);
        size = Math.max(dims.width, dims.height);
    } else if (limits instanceof Sphere) {
        size = limits.radius * 2;
    } else if (limits instanceof Box3) {
        const size3 = limits.getSize(temp.position);
        size = Math.max(size3.x, size3.y, size3.z);
    } else {
        throw new Error('unsupported limits');
    }

    return Math.ceil(size / 1000);
}

function getBoxFromLimits(limits: Extent | Box3 | Sphere): Box3 {
    if (limits instanceof Extent) {
        return limits.toBox3(-10000, +10000);
    } else if (limits instanceof Sphere) {
        return limits.getBoundingBox(new Box3());
    } else if (limits instanceof Box3) {
        return limits;
    } else {
        throw new Error('unsupported limits');
    }
}

/**
 * Simulates sun exposure on meshes and produces various sun-related measures (see {@link VariableName}).
 *
 * The output is a point cloud that covers the area of interest.
 * Each point represents a _sun probe_ that samples sun exposure at this location.
 *
 * Computation can occurs on a single point in time or within a time range. In that case,
 * the time range is discretized into snapshots that are one `temporalResolution` apart.
 *
 * ### Irradiance and irradiation
 *
 * Irradiance (in Watts / square meter) represents the amount of solar power that reaches a surface at a given time.
 *
 * We first compute the cosine between the probe's normal and the sun direction. If the cosine
 * is zero or less, it means the surface is not exposed to sunlight at all. It thus receives
 * zero watts of solar power.
 *
 * If the cosine is greater than zero, it is used to compute the solar power with a simple formula:
 *
 *      irradiance = cos(angle) * SolarConstant * AtmosphereAbsorption
 *
 * where SolarConstant is the {@link SOLAR_CONSTANT} and AtmosphereAbsorption is the {@link
 * ATMOSPHERIC_ABSORPTION} constant.
 *
 * Thus, at noon UTC during summer solstice and at the northern tropic (23.43° N, 0° E),
 * the irradiance of an horizontal surface will be at its maximum value, which is
 * (SolarConstant * AtmosphereAbsorption), since the cosine of the angle will be 1.
 *
 * Irradiation (in Watt-hours / square meter) is then computed as the integral of the
 * irradiance over the time period (in hours).
 *
 * ### Hours of sunlight
 *
 * This variable is computed by counting the number of time increments that a given probe
 * receives sunlight (i.e is not in the shadow of another object). Those increments do not
 * need to be consecutive. Thus, if a probe receives 0.5 hours of sunlight in the morning,
 * then is in the shade until 16:00, then receives another 2 hours of sunlight in the afternoon,
 * then is occluded by shadow again, then receives 1.5 hours until sunset, its hours of sunlight
 * will be 4 hours (0.5 + 2 + 1.5).
 *
 * ### Remarks and caveats
 *
 * - Be careful when passing `Date` parameters. By default, dates are using the local
 *   time zone. It is advised to pass UTC dates to avoid ambiguity.
 *
 * - Only mesh-like objects (3D models, maps, 3D tiles, etc) are supported.
 *   Point clouds are not supported, as they don't expose surfaces and normals required
 *   for solar exposure computation.
 *
 * - You must include "ground" like meshes so that other meshes (like buildings) are properly
 *   shaded (especially in morning/evening periods) when the sun is low. A simple flat plane
 *   is enough if you don't have anything else. Otherwise you can use a Map with terrain.
 *
 * - Be _very_ careful with the `spatialResolution` parameter. It must be reasonable
 *   and consistent with the dimensions of the area of interest. For example, if the area
 *   of interest is 1000m long, and the spatial resolution is 0.1, then this will create
 *   millions of sun probes, making computation much longer than expected, and using a lot
 *   of memory. It is recommended to start with a high value and then reduce it afterwards.
 */
export class SunExposure
    extends EventDispatcher<SunExposureEventMap>
    implements Progress, Disposable
{
    private readonly _opCounter = new OperationCounter();
    private readonly _start: Date;
    private readonly _end: Date | undefined;
    private readonly _temporalResolution: number;
    private readonly _limits: Extent | Sphere | Box3;
    private readonly _instance: Instance;
    private readonly _root: Group;
    private readonly _showHelpers: boolean;
    private readonly _objects: Array<Object3D | Entity3D>;
    private readonly _spatialResolution: number;
    private readonly _colorMap: ColorMap;
    private readonly _toDispose: Array<VoidFunction> = [];

    public get loading(): boolean {
        return this._opCounter.loading;
    }

    public get progress(): number {
        return this._opCounter.progress;
    }

    public constructor(params: SunExposureOptions) {
        super();

        this._instance = params.instance;
        this._start = params.start;
        this._end = params.end;
        this._colorMap = params.colorMap ?? DEFAULT_COLOR_MAP;
        this._objects = params.objects;
        this._limits = params.limits;
        this._temporalResolution = params.temporalResolution ?? 3600;
        this._root = new Group();
        this._root.name = 'SunExposure';
        this._instance.add(this._root);
        this._showHelpers = params.showHelpers ?? false;
        this._spatialResolution =
            params.spatialResolution ?? getDefaultSpatialResolution(this._limits);

        this._opCounter.addEventListener('changed', () =>
            this.dispatchEvent({ type: 'progress', progress: this.progress }),
        );
    }

    private createShadowMapCamera(
        limits: Limits,
        origin: Vector3,
        direction: Vector3,
    ): OrthographicCamera {
        const diagonal = limits.shadowCasters.min.distanceTo(limits.shadowCasters.max);
        const distanceToOrigin = diagonal * 5;
        const sunPos = temp.position.copy(origin).addScaledVector(direction, distanceToOrigin);

        const camera = new OrthographicCamera();
        camera.position.copy(sunPos);
        camera.lookAt(origin);
        camera.updateMatrixWorld(true);

        camera.matrixWorld.extractBasis(temp.x, temp.y, temp.z);
        const rightPlane = new Plane().setFromNormalAndCoplanarPoint(temp.x, origin);
        const leftPlane = rightPlane.clone().negate();
        const topPlane = new Plane().setFromNormalAndCoplanarPoint(temp.y, origin);
        const depthPlane = new Plane().setFromNormalAndCoplanarPoint(
            temp.z,
            camera.getWorldPosition(temp.position),
        );
        const bottomPlane = topPlane.clone().negate();

        const corners = getBoxCorners(limits.probes);

        let left = 0;
        let right = 0;
        let top = 0;
        let bottom = 0;
        let near = +Infinity;
        let far = 0;

        // Let's compute the tightest frustum around the bounding box
        // in order to limit the number of useless pixels in the depth texture.
        for (let i = 0; i < corners.length; i++) {
            const p = corners[i];

            right = Math.max(right, Math.abs(rightPlane.distanceToPoint(p)));
            left = Math.max(left, Math.abs(leftPlane.distanceToPoint(p)));
            top = Math.max(top, Math.abs(topPlane.distanceToPoint(p)));
            bottom = Math.max(bottom, Math.abs(bottomPlane.distanceToPoint(p)));

            const depth = Math.abs(depthPlane.distanceToPoint(p));
            far = Math.max(far, depth);
        }

        // The near plane is special because we want to ensure that
        // objects that are just outside the probe limits still cast
        // shadows on the probes. So we have to make sure the near
        // plane is not too close to the probes.
        near = limits.shadowCasters.distanceToPoint(sunPos);

        const margin = 1;
        camera.right = right + margin;
        camera.left = -left - margin;
        camera.top = top + margin;
        camera.bottom = -bottom - margin;
        camera.near = near - margin;
        camera.far = far + margin;
        camera.updateProjectionMatrix();

        return camera;
    }

    private createDepthMapHelper(
        camera: OrthographicCamera,
        depths: Float32Array,
        width: number,
        height: number,
    ): void {
        const tex = new DataTexture(depths, width, height, RedFormat, FloatType);
        tex.needsUpdate = true;

        this._toDispose.push(() => tex.dispose());

        const textureHelper = new Mesh(
            new PlaneGeometry(),
            new MeshBasicMaterial({
                map: tex,
            }),
        );
        const dir = camera.getWorldDirection(temp.normal);
        const helperPosition = camera.position.clone().addScaledVector(dir, camera.near);
        textureHelper.position.copy(helperPosition);
        textureHelper.lookAt(camera.position);
        textureHelper.scale.set(camera.right - camera.left, camera.top - camera.bottom, 1);
        textureHelper.updateMatrixWorld(true);
        textureHelper.name = 'depth texture';

        this._root.add(textureHelper);
    }

    private async processStep(params: {
        step: SimulationStep;
        origin: Vector3;
        limits: Limits;
        probes: ProbeCollection;
        scene: Object3D;
    }): Promise<void> {
        // The general algorithm follows those steps:
        //
        // 1. Create a depth/shadow map at the location of the "sun"
        // 2. For each probe, compare the "depth" of the probe with the value in the depth map
        //    a) if the probe depth is smaller that the value in the depth map, the probe is
        //       exposed to sunlight. We can then compute solar values (irradiance, irradiation,
        //       hours of sunshine...). Solar values are computed from the angle between the normal
        //       of the probe (which represents the normal of the original surface that was sampled
        //       to create the probe) and the sun ray direction.
        //    b) if the probe depth is greater than the value in the depth map, the probe receives
        //       0 watts of solar power this step.

        const { step, origin, limits, probes, scene } = params;

        // We negate the vector because we want the vectors that
        // come from the scene and looks at the sun to compute
        // angle between surface normals and the sun rays.
        const direction = step.sunDirection.clone().negate();

        const camera = this.createShadowMapCamera(limits, origin, direction);

        if (this._showHelpers) {
            const helper = new CameraHelper(camera);

            helper.update();
            helper.updateMatrixWorld(true);

            this._root.add(helper);
        }

        // The base depth map texture size.
        // This should be sufficent for most use cases, but can be
        // adjusted up to 4096 (which is the upper limit that WebGL
        // guarantees for platform-independent texture size).
        const BASE_SIZE = 2048;
        const frustumWidth = camera.right - camera.left;
        const frustumHeight = camera.top - camera.bottom;
        const aspect = frustumWidth / frustumHeight;
        const width = aspect > 1 ? BASE_SIZE : Math.round(BASE_SIZE * aspect);
        const height = aspect > 1 ? Math.round(BASE_SIZE / aspect) : BASE_SIZE;

        const depthTexture = new DepthTexture(width, height, UnsignedIntType);
        const target = new WebGLRenderTarget(width, height, { depthTexture });

        this._toDispose.push(() => target.dispose());
        this._toDispose.push(() => depthTexture.dispose());

        const renderer = this._instance.renderer;

        // Let's render the simplified simulation scene to the depth texture.
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);

        // Since we have to actually sample the texture CPU-side, we have to read it back.
        const depths = await TextureGenerator.readDepthTexture(depthTexture, renderer);

        if (this._showHelpers) {
            this.createDepthMapHelper(camera, depths, width, height);
        }

        const intervalHour = step.duration / 3600;

        // 1% tolerance to avoid artifacts where probes look like their are behind
        // their own surface due to floating point precision issues.
        const tolerance = 0.01;

        // Note: atmospheric absorption could be an input of the computation
        // so that users can set it to different weather situations (cloudy day).
        const baseIrradiance = SOLAR_CONSTANT * (1 - ATMOSPHERIC_ABSORPTION);

        // Now we iterate over each probe and ask 3 questions:
        // 1. Is the probe even possibly lit ?
        // 2. Is the probe in the shadow area ?
        // 3. How much power does the probe receive this step ?
        for (let i = 0; i < probes.length; i++) {
            const nx = probes.normals.array[i * 3 + 0];
            const ny = probes.normals.array[i * 3 + 1];
            const nz = probes.normals.array[i * 3 + 2];
            const normal = temp.normal.set(nx, ny, nz);

            const dot = normal.dot(direction);

            // Is the probe even lit at all ?
            // The probe is pointing away from sunlight,
            // don't even bother with depth map lookup.
            if (dot < 0) {
                continue;
            }

            // Get the world space position of the probe.
            const px = probes.positions.array[i * 3 + 0];
            const py = probes.positions.array[i * 3 + 1];
            const pz = probes.positions.array[i * 3 + 2];
            const position = temp.position.set(px + origin.x, py + origin.y, pz + origin.z);

            // Project the probe position into the camera's NDC space.
            const ndc = position.project(camera);

            // Get the pixel coordinate in the depth map that this probe belongs to.
            const x = Math.round(MathUtils.mapLinear(position.x, -1, +1, 0, width - 1));
            const y = Math.round(MathUtils.mapLinear(position.y, -1, +1, 0, height - 1));

            // Sample the depth map at this pixel.
            const depth = depths[y * width + x];

            // The NDC goes from -1 to +1, so we have to normalize it to [0, 1] to have
            // the correct probe depth.
            const probeDepth = MathUtils.mapLinear(ndc.z, -1, +1, 0, 1);

            // If the probe depth is smaller than the depth map value, it means that
            // the probe is directly exposed to the sunlight.
            // Here we use the tolerance to allow a typical case where probes are seen
            // as "behind" their own sample surface due to floating point precision.
            const sunLit = probeDepth - tolerance <= depth;

            // The probe is in the shadow, it receives zero energy this step.
            // We can skip solar parameter computation since they would be equal to zero anyway.
            if (!sunLit) {
                continue;
            }

            // The probe is in the sunlight. We can compute the solar parameters:
            // 1. irradiance (in W/m² how much power does it receive this step ?)
            // 2. irradiation (in Wh/m², cumulated irradiance over the time range)
            // 3. hours of sunshine (in hours, the total duration this probe was
            //    under the sunlight).

            // For irradiance, we use a very simple model.
            // Let's compute the irradiance of the probe at this moment in time.
            const irradiance = baseIrradiance * dot;

            // Now we can compute a bunch of sun-related parameters:
            // - irradiance (how much energy hits the surface at a given time)
            // - irradiation (cumulated energy over time)
            // - exposure time (number of hours that a given probe has been sunlit)

            // Irradiance (Watt / m²)
            // Note that we are interested in the mean irradiance per probe,
            // so we will compute it at the end of the simulation.
            probes.variables.meanIrradiance.buffer.array[i] += irradiance;

            // Irradiation (Watt-hour / m²)
            // Irradiation is the integral of irradiance over the period of time.
            // We can compute it as we iterate over the interval.
            const irradiation = probes.variables.irradiation;
            const newValue = irradiation.buffer.array[i] + irradiance * intervalHour;
            irradiation.buffer.array[i] = newValue;
            irradiation.max = Math.max(irradiation.max, newValue);
            irradiation.min = Math.min(irradiation.min, newValue);

            // Hours of sunlight
            probes.variables.hoursOfSunlight.buffer.array[i] += intervalHour;
        }

        // This value will be used later to compute the mean irradiance.
        probes.numIterations++;

        // Give the opportunity to update the preview point cloud.
        this._instance.notifyChange();
    }

    private computeTightBounds(): Box3 {
        const limits = this._objects.map(obj => {
            if (isEntity3D(obj)) {
                return new Box3().setFromObject(obj.object3d);
            } else {
                obj.updateMatrixWorld(true);
                return new Box3().setFromObject(obj, true);
            }
        });

        const limit = limits.reduce((prev, curr) => prev.union(curr));
        limit.expandByScalar(10);

        const inputLimits = getBoxFromLimits(this._limits);
        const box = limit.intersect(inputLimits);

        return box;
    }

    private createBoundsHelper(bounds: Box3, color: ColorRepresentation): void {
        const boxHelper = new Box3Helper(bounds, color);
        this._root.add(boxHelper);
        boxHelper.updateMatrixWorld(true);
        this._instance.notifyChange();
    }

    private async createOutputPointCloud(
        bounds: Box3,
        origin: Vector3,
        probes: ProbeCollection,
    ): Promise<Output> {
        const irradiation = probes.variables.irradiation.buffer;
        const irradiance = probes.variables.meanIrradiance.buffer;
        const hoursOfSunlight = probes.variables.hoursOfSunlight.buffer;

        const source = new StaticPointCloudSource({
            spacing: this._spatialResolution,
            positions: new Float32BufferAttribute(probes.positions.toFloat32Array(), 3),
            origin: origin,
            bounds,
            attributes: [
                { attribute: attributeDescriptors['meanIrradiance'], data: irradiance },
                { attribute: attributeDescriptors['irradiation'], data: irradiation },
                { attribute: attributeDescriptors['hoursOfSunlight'], data: hoursOfSunlight },
            ],
        });

        const pointCloud = new PointCloud({
            source,
        });

        await this._instance.add(pointCloud);

        pointCloud.setActiveAttribute('irradiation');

        pointCloud.setAttributeColorMap('irradiation', this._colorMap);
        pointCloud.setAttributeColorMap('meanIrradiance', this._colorMap);
        pointCloud.setAttributeColorMap('hoursOfSunlight', this._colorMap);

        return { pointCloud, source, irradiation, irradiance, hoursOfSunlight };
    }

    private computeVariableStatistics(variable: SolarVariable): void {
        let min = +Infinity;
        let max = -Infinity;
        let mean = 0;

        for (let i = 0; i < variable.buffer.array.length; i++) {
            const v = variable.buffer.array[i];
            min = Math.min(min, v);
            max = Math.max(max, v);
            mean += v;
        }

        variable.mean = mean / variable.buffer.array.length;
        variable.min = min - 0.01;
        variable.max = max + 0.01;
    }

    private async runSimulationStep(params: {
        step: SimulationStep;
        probes: ProbeCollection;
        limits: Limits;
        origin: Vector3;
        output: Output;
        scene: Object3D;
        signal?: AbortSignal;
    }): Promise<void> {
        const { limits, step, output, probes, signal, scene, origin } = params;
        await PromiseUtils.delay(15)
            .then(async (): Promise<void> => {
                if (signal?.aborted === true) {
                    return;
                }

                await this.processStep({
                    step,
                    limits,
                    origin,
                    probes,
                    scene,
                });

                // Let's update the preview point cloud
                this._colorMap.min = probes.variables.irradiation.min - 0.01;
                this._colorMap.max = probes.variables.irradiation.max + 0.01; // the epsilon to avoid null intervals

                output.irradiation.needsUpdate = true;
                output.source.update();

                this._instance.notifyChange();
            })
            .finally(() => this._opCounter.decrement());
    }

    /**
     * Starts the computation.
     */
    public async compute(options?: {
        /** An optional signal to abort the computation */
        signal?: AbortSignal;
    }): Promise<ComputationResult> {
        // This array will store dispose functions for early cancellations.
        const cancellationDisposals: Array<VoidFunction> = [];

        const signal = options?.signal;

        signal?.addEventListener('abort', () => {
            this.dispose();
            cancellationDisposals.forEach(f => f());
            console.log('computation aborted');
        });

        const crs = this._instance.coordinateSystem;

        // Start the sun exposure computation.

        // The first step is to compute the limit volumes
        // of computation. We define two volumes:
        // - the tight volume that contains the probes
        // - a bigger volume for shadow casters
        const probeBounds = this.computeTightBounds();

        // The bounds to collect meshes is bigger than the bounds used for probes
        // because we want to ensure that neighbouring meshes do contribute to shadows.
        // For example if the neighbouring area has high-rise buildings, they must be included.
        const tightBoundSize = probeBounds.getBoundingSphere(temp.sphere).radius;
        const shadowCasterBounds = probeBounds.clone().expandByScalar(tightBoundSize * 1.5);
        const meshBoundsAsExtent = Extent.fromBox3(crs, shadowCasterBounds);

        const limits: Limits = {
            probes: probeBounds,
            shadowCasters: shadowCasterBounds,
        };

        const origin = limits.probes.getCenter(new Vector3());
        const originAsCoordinates = new Coordinates(crs, origin.x, origin.y, origin.z);

        const isGlobe = this._instance.coordinateSystem.isEpsg(4978);

        // Then, discretize the time interval into separate
        // steps, each with a date and sun direction.
        const steps = createSimulationSteps(
            originAsCoordinates,
            this._start,
            this._end,
            this._temporalResolution,
            isGlobe,
        );

        // Let's collect the meshes that will be used in the simulation.
        // We limit the meshes that intersect the bounds.
        // Note that we are not altering the original objects at all.
        const { meshes, disposeFn } = collectOptimizedMeshes(
            this._objects,
            origin,
            meshBoundsAsExtent,
            shadowCasterBounds,
            this._spatialResolution,
        );

        // Then, collect probes on the surface of the meshes
        // within the tight bounds.
        const probes = collectProbes(meshes, origin, limits.probes, this._spatialResolution);

        this._toDispose.push(disposeFn);

        const scene = new Group();
        scene.name = 'meshes';
        scene.add(...meshes);

        if (this._showHelpers) {
            this.createBoundsHelper(limits.probes, 'red');
            this.createBoundsHelper(limits.shadowCasters, 'green');

            // The simulation scene is added to the scenegraph to be visualized.
            this._root.add(scene);

            scene.updateMatrixWorld(true);

            this._instance.notifyChange();

            await PromiseUtils.delay(50);
        }

        this._opCounter.increment(steps.length);

        // Now we build the point cloud that will display the probes.
        const output = await this.createOutputPointCloud(limits.probes, origin, probes);

        cancellationDisposals.push(() => this._instance.remove(output.pointCloud));

        signal?.throwIfAborted();

        // Let's run the simulation steps
        for (const step of steps) {
            await this.runSimulationStep({
                step,
                probes,
                origin,
                limits,
                output,
                scene,
                signal: options?.signal,
            });

            signal?.throwIfAborted();
        }

        signal?.throwIfAborted();

        // Now that the computation is finished, we can compute the mean irradiance
        // from the cumulated irradiances.
        const irradiances = probes.variables.meanIrradiance.buffer.array;

        for (let i = 0; i < irradiances.length; i++) {
            const cumulated = irradiances[i];
            irradiances[i] = cumulated / probes.numIterations;
        }

        this.computeVariableStatistics(probes.variables.meanIrradiance);
        this.computeVariableStatistics(probes.variables.irradiation);
        this.computeVariableStatistics(probes.variables.hoursOfSunlight);

        output.irradiation.needsUpdate = true;
        output.irradiance.needsUpdate = true;
        output.hoursOfSunlight.needsUpdate = true;

        output.source.update();

        return {
            entity: output.pointCloud,
            variables: probes.variables,
        };
    }

    public dispose(): void {
        this._toDispose.forEach(fn => fn());
        this._toDispose.length = 0;
        this._instance.remove(this._root);
    }
}

export default SunExposure;
