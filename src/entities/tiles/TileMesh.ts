import {
    Group,
    MathUtils,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Ray,
    RGBAFormat,
    Sphere,
    UnsignedByteType,
    Vector2,
    Vector3,
    type Box3,
    type BufferGeometry,
    type Intersection,
    type Object3D,
    type Object3DEventMap,
    type Raycaster,
    type Texture,
    type WebGLRenderer,
    type WebGLRenderTarget,
} from 'three';

import type Disposable from '../../core/Disposable';
import type Ellipsoid from '../../core/geographic/Ellipsoid';
import type Extent from '../../core/geographic/Extent';
import type GetElevationOptions from '../../core/GetElevationOptions';
import HeightMap from '../../core/HeightMap';
import ElevationLayer from '../../core/layer/ElevationLayer';
import type Layer from '../../core/layer/Layer';
import type MemoryUsage from '../../core/MemoryUsage';
import type { GetMemoryUsageContext } from '../../core/MemoryUsage';
import OffsetScale from '../../core/OffsetScale';
import Rect from '../../core/Rect';
import type UniqueOwner from '../../core/UniqueOwner';
import { intoUniqueOwner } from '../../core/UniqueOwner';
import { readRGRenderTargetIntoRGBAU8Buffer } from '../../renderer/composition/WebGLComposer';
import type LayeredMaterial from '../../renderer/LayeredMaterial';
import type { MaterialOptions } from '../../renderer/LayeredMaterial';
import MaterialUtils from '../../renderer/MaterialUtils';
import MemoryTracker from '../../renderer/MemoryTracker';
import type RenderingState from '../../renderer/RenderingState';
import type ShadowLayeredMaterial from '../../renderer/ShadowLayeredMaterial';
import type View from '../../renderer/View';
import { isPerspectiveCamera } from '../../utils/predicates';
import type TileCoordinate from './TileCoordinate';
import type TileGeometry from './TileGeometry';
import type { TileGeometryBuilder } from './TileGeometry';
import type { NeighbourList } from './TileIndex';
import type TileVolume from './TileVolume';

const ray = new Ray();
const inverseMatrix = new Matrix4();
const THIS_RECT = new Rect(0, 1, 0, 1);
const tmpSphere = new Sphere();

const helperMaterial = new MeshBasicMaterial({
    color: '#75eba8',
    depthTest: false,
    depthWrite: false,
    wireframe: true,
    transparent: true,
});

const NO_NEIGHBOUR = -99;
const NO_OFFSET_SCALE = new OffsetScale(0, 0, 0, 0);
const tempVec2 = new Vector2();
const tempVec3 = new Vector3();
const tempAbsolutePosition = new Vector3();

export interface TileMeshEventMap extends Object3DEventMap {
    'visibility-changed': unknown;
    dispose: unknown;
}

class TileMesh
    extends Mesh<TileGeometry, LayeredMaterial, TileMeshEventMap>
    implements Disposable, MemoryUsage
{
    readonly isTileMesh = true as const;
    override readonly type = 'TileMesh' as const;
    readonly isMemoryUsage = true as const;
    readonly extent: Extent;
    readonly textureSize: Vector2;

    override customDepthMaterial: ShadowLayeredMaterial;
    override customDistanceMaterial: ShadowLayeredMaterial;

    readonly coordinate: TileCoordinate;

    private readonly _extentDimensions: Vector2;
    private readonly _geometryBuilder: TileGeometryBuilder<TileGeometry>;
    private readonly _volume: TileVolume;
    private readonly _renderer: WebGLRenderer;
    private readonly _onElevationChanged: (tile: this) => void;

    private _heightMap: UniqueOwner<HeightMap, this> | null = null;
    private _enableTerrainDeformation: boolean;

    private _tileGeometry: TileGeometry;
    private _segments: number;
    private _skirtDepth: number | undefined;
    private _minmax: { min: number; max: number } = { min: -Infinity, max: +Infinity };
    private _shouldUpdateHeightMap = false;
    private _helperRoot: Group | null = null;

    private readonly _helpers: {
        colliderMesh?: Mesh<BufferGeometry, MeshBasicMaterial, Object3DEventMap>;
    } = {};
    private _elevationLayerInfo: {
        layer: ElevationLayer;
        offsetScale: OffsetScale;
        renderTarget: WebGLRenderTarget<Texture>;
    } | null = null;

    disposed = false;
    isLeaf = false;

    getMemoryUsage(context: GetMemoryUsageContext) {
        this.material?.getMemoryUsage(context);

        // We only count what we own, otherwise the same heightmap will be counted more than once.
        if (this._heightMap && this._heightMap.owner === this) {
            context.objects.set(`heightmap-${this._heightMap.owner.id}`, {
                cpuMemory: this._heightMap.payload.buffer.byteLength,
                gpuMemory: 0,
            });
        }

        this.geometry.getMemoryUsage(context);
    }

    get boundingBox(): Box3 {
        if (!this._enableTerrainDeformation || this._elevationLayerInfo?.layer.visible !== true) {
            this._volume.setElevationRange({ min: 0, max: 0 });
        } else {
            this._volume.setElevationRange(this.minmax);
        }
        return this._volume.localBox;
    }

    /**
     * The LOD. Root nodes have LOD 0.
     */
    get lod() {
        return this.coordinate.z;
    }

    getWorldSpaceBoundingBox(target: Box3): Box3 {
        const local = this._volume.getLocalBoundingBox(target);

        this.updateMatrixWorld(true);

        local.applyMatrix4(this.matrixWorld);

        return local;
    }

    getWorldSpaceBoundingSphere(target: Sphere): Sphere {
        this.updateWorldMatrix(true, false);
        return this._volume.getWorldSpaceBoundingSphere(target, this.matrixWorld);
    }

    getBoundingBoxCorners(): Vector3[] {
        this.updateWorldMatrix(true, false);
        return this._volume.getWorldSpaceCorners(this.matrixWorld);
    }

    /**
     * Creates an instance of TileMesh.
     *
     * @param options - Constructor options.
     */
    constructor(params: {
        geometryBuilder: TileGeometryBuilder<TileGeometry>;
        volume: TileVolume;
        /** The tile material. */
        material: LayeredMaterial;
        depthMaterial: ShadowLayeredMaterial;
        distanceMaterial: ShadowLayeredMaterial;
        /** The tile extent. */
        extent: Extent;
        /** The subdivisions. */
        segments: number;
        skirtDepth?: number;
        /** The tile coordinate. */
        coord: TileCoordinate;
        /** The texture size. */
        textureSize: Vector2;
        ellipsoid?: Ellipsoid;
        renderer: WebGLRenderer;
        enableTerrainDeformation: boolean;
        onElevationChanged: (tile: TileMesh) => void;
    }) {
        super(
            params.geometryBuilder(params.extent, params.segments, params.skirtDepth ?? null),
            params.material,
        );

        this._geometryBuilder = params.geometryBuilder;
        this._tileGeometry = this.geometry;
        this._segments = params.segments;
        this._skirtDepth = params.skirtDepth;
        this._renderer = params.renderer;
        this._onElevationChanged = params.onElevationChanged;

        this.matrixAutoUpdate = false;

        this.coordinate = params.coord;
        this.extent = params.extent;
        this.textureSize = params.textureSize;
        this._enableTerrainDeformation = params.enableTerrainDeformation;

        this.customDepthMaterial = params.depthMaterial;
        this.customDistanceMaterial = params.distanceMaterial;

        if (!this.geometry.boundingBox) {
            this.geometry.computeBoundingBox();
        }

        this._volume = params.volume;

        const { z, x, y } = this.coordinate;
        this.name = `tile @ (z=${z}, x=${x}, y=${y})`;

        this.frustumCulled = false;

        // Layer
        this.setDisplayed(false);

        this.material.setUuid(this.id);
        const dim = params.extent.dimensions();
        this._extentDimensions = dim;

        // Sets the default bbox volume
        this.setBBoxZ(-0.5, +0.5);

        MemoryTracker.track(this, this.name);

        this.updateSkirtParameters();
    }

    override onBeforeShadow(): void {
        this.customDepthMaterial.onBeforeRender();
        this.customDistanceMaterial.onBeforeRender();
    }

    private updateSkirtParameters() {
        const skirtDepth = this._skirtDepth;

        if (skirtDepth != null) {
            this.forEachMaterial(material => {
                MaterialUtils.setDefine(material, 'ENABLE_SKIRTS', true);
                const vertexCount = this.geometry.vertexCount;
                const rowSize = this.segments + 1;
                const firstSkirtVertex = rowSize * rowSize;
                const lastSkirtVertex = vertexCount - 1;
                material.uniforms.skirtVertexRange.value = new Vector2(
                    firstSkirtVertex,
                    lastSkirtVertex,
                );
                material.uniforms.skirtElevation.value = skirtDepth;
            });
        } else {
            this.forEachMaterial(material => {
                MaterialUtils.setDefine(material, 'ENABLE_SKIRTS', false);
            });
        }
    }

    get absolutePosition() {
        return this.geometry.origin;
    }

    get showColliderMesh() {
        if (!this._helpers.colliderMesh) {
            return false;
        }
        return this._helpers.colliderMesh.material.visible;
    }

    set showColliderMesh(visible: boolean) {
        if (visible && !this._helpers.colliderMesh) {
            this._helpers.colliderMesh = new Mesh(this.geometry.raycastGeometry, helperMaterial);
            this._helpers.colliderMesh.matrixAutoUpdate = false;
            this._helpers.colliderMesh.name = 'collider helper';
            this.createHelperRootIfNecessary();
            this._helperRoot?.add(this._helpers.colliderMesh);
            this._helpers.colliderMesh.updateMatrix();
            this._helpers.colliderMesh.updateMatrixWorld(true);
        }

        if (!visible && this._helpers.colliderMesh) {
            this._helpers.colliderMesh.removeFromParent();
            this._helpers.colliderMesh = undefined;
        }

        if (this._helpers.colliderMesh) {
            this._helpers.colliderMesh.material.visible = visible;
        }
    }

    get segments() {
        return this._segments;
    }

    set segments(v) {
        if (this._segments !== v) {
            this._segments = v;
            this.forEachMaterial(material => (material.segments = v));
            this.createGeometry();
            this._shouldUpdateHeightMap = true;
        }
    }

    private createHelperRootIfNecessary() {
        if (!this._helperRoot) {
            this._helperRoot = new Group();
            this._helperRoot.name = 'helpers';
            this.add(this._helperRoot);
            this._helperRoot.updateMatrixWorld(true);
        }
    }

    private createGeometry() {
        this.geometry.dispose();
        this.geometry = this._geometryBuilder(this.extent, this.segments, this._skirtDepth ?? null);
        this._tileGeometry = this.geometry;

        if (this._helpers.colliderMesh) {
            this._helpers.colliderMesh.geometry = this.geometry.raycastGeometry;
        }

        this.updateSkirtParameters();
    }

    onLayerVisibilityChanged(layer: Layer) {
        if (layer instanceof ElevationLayer) {
            this._shouldUpdateHeightMap = true;
        }
    }

    addChildTile(tile: TileMesh) {
        // The absolute position here means "absolute position in the cartographic coordinate system", not in the scene.
        const absolutePosition = tempAbsolutePosition.copy(tile.absolutePosition);
        tile.position.copy(absolutePosition.sub(this.absolutePosition));

        this.add(tile);
        tile.updateMatrix();
        tile.updateMatrixWorld();

        if (this._heightMap) {
            const heightMap = this._heightMap.payload;
            const inheritedHeightMap = heightMap.clone();
            const offsetScale = tile.extent.offsetToParent(this.extent);
            heightMap.offsetScale.combine(offsetScale, inheritedHeightMap.offsetScale);
            tile.inheritHeightMap(intoUniqueOwner(inheritedHeightMap, this));
        }
    }

    reorderLayers() {
        this.material.reorderLayers();
    }

    /**
     * Checks that the given raycaster intersects with this tile's volume.
     */
    private checkRayVolumeIntersection(raycaster: Raycaster): boolean {
        const matrixWorld = this.matrixWorld;

        // convert ray to local space of mesh

        inverseMatrix.copy(matrixWorld).invert();
        ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

        // test with bounding box in local space

        // Note that we are not using the bounding box of the geometry, because at this moment,
        // the mesh might still be completely flat, as the heightmap might not be computed yet.
        // This is the whole point of this method: to avoid computing the heightmap if not necessary.
        // So we are using the logical bounding box provided by the volume.
        return ray.intersectsBox(this.boundingBox);
    }

    override raycast(raycaster: Raycaster, intersects: Intersection[]): void {
        // Updating the heightmap is quite costly operation that requires a texture readback.
        // Let's do it only if the ray intersects the volume of this tile.
        if (this.checkRayVolumeIntersection(raycaster)) {
            this.updateHeightMapIfNecessary();

            // We have to distinguish between the rendered geometry and the raycasting geometry.
            // However, three.js does not let use choose which will be used for raycasting,
            // so we temporarily swap the geometry with the raycast geometry to perform raycasting.
            // @ts-expect-error type mismatch is expected and transient
            this.geometry = this._tileGeometry.raycastGeometry;

            super.raycast(raycaster, intersects);

            this.geometry = this._tileGeometry;
        }
    }

    private updateHeightMapIfNecessary(): void {
        if (this._shouldUpdateHeightMap) {
            this._shouldUpdateHeightMap = false;

            if (this._elevationLayerInfo) {
                this.createHeightMap(
                    this._elevationLayerInfo.renderTarget,
                    this._elevationLayerInfo.offsetScale,
                );

                const shouldHeightmapBeActive =
                    this._elevationLayerInfo.layer.visible && this._enableTerrainDeformation;

                if (shouldHeightmapBeActive) {
                    this.applyHeightMap();
                } else {
                    this.resetHeights();
                }
            }
        }
    }

    /**
     * @param neighbour - The neighbour.
     * @param location - Its location in the neighbour array.
     */
    private processNeighbour(neighbour: TileMesh, location: number) {
        const diff = neighbour.lod - this.lod;

        const neighbourTexture = neighbour.material.getElevationTexture();
        const neighbourOffsetScale = neighbour.material.getElevationOffsetScale();

        const offsetScale = this.extent.offsetToParent(neighbour.extent);
        const nOffsetScale = neighbourOffsetScale.combine(offsetScale);

        this.forEachMaterial(material => {
            material.updateNeighbour(location, diff, nOffsetScale, neighbourTexture);
        });
    }

    /**
     * @param neighbours - The neighbours.
     */
    processNeighbours(neighbours: NeighbourList<TileMesh>) {
        for (let i = 0; i < neighbours.length; i++) {
            const neighbour = neighbours[i];
            if (neighbour != null && neighbour.material != null && neighbour.material.visible) {
                this.processNeighbour(neighbour, i);
            } else {
                this.forEachMaterial(material =>
                    material.updateNeighbour(i, NO_NEIGHBOUR, NO_OFFSET_SCALE, null),
                );
            }
        }
    }

    update(materialOptions: MaterialOptions) {
        if (this._heightMap && this._elevationLayerInfo) {
            if (this._enableTerrainDeformation !== materialOptions.terrain.enabled) {
                this._enableTerrainDeformation = materialOptions.terrain.enabled;
                this._shouldUpdateHeightMap = true;
            }
        }

        this.showColliderMesh = materialOptions.showColliderMeshes ?? false;
    }

    isVisible() {
        return this.visible;
    }

    setDisplayed(show: boolean) {
        const currentVisibility = this.material.visible;
        this.material.visible = show && this.material.update();
        if (this._helperRoot) {
            this._helperRoot.visible = this.material.visible;
        }
        if (currentVisibility !== show) {
            this.dispatchEvent({ type: 'visibility-changed' });
        }
    }

    /**
     * @param v - The new opacity.
     */
    set opacity(v: number) {
        this.material.opacity = v;
    }

    setVisibility(show: boolean) {
        const currentVisibility = this.visible;
        this.visible = show;
        if (currentVisibility !== show) {
            this.dispatchEvent({ type: 'visibility-changed' });
        }
    }

    isDisplayed() {
        return this.material.visible;
    }

    /**
     * Updates the rendering state of the tile's material.
     *
     * @param state - The new rendering state.
     */
    changeState(state: RenderingState) {
        this.material.changeState(state);
    }

    static applyChangeState(o: Object3D, s: RenderingState) {
        if ((o as TileMesh).isTileMesh) {
            (o as TileMesh).changeState(s);
        }
    }

    pushRenderState(state: RenderingState) {
        if (this.material.uniforms.renderingState.value === state) {
            return () => {
                /** do nothing */
            };
        }

        const oldState = this.material.uniforms.renderingState.value;
        this.traverse(n => TileMesh.applyChangeState(n, state));

        return () => {
            this.traverse(n => TileMesh.applyChangeState(n, oldState));
        };
    }

    canProcessColorLayer(): boolean {
        return this.material.canProcessColorLayer();
    }

    removeElevationTexture() {
        this._elevationLayerInfo = null;
        this._shouldUpdateHeightMap = true;
        this.material.removeElevationLayer();
    }

    setElevationTexture(
        layer: ElevationLayer,
        elevation: {
            texture: Texture;
            pitch: OffsetScale;
            min?: number;
            max?: number;
            renderTarget: WebGLRenderTarget;
        },
        isFinal = false,
    ) {
        if (this.disposed) {
            return;
        }

        this._elevationLayerInfo = {
            layer,
            offsetScale: elevation.pitch,
            renderTarget: elevation.renderTarget,
        };

        this.material.setElevationTexture(layer, elevation, isFinal);

        this.setBBoxZ(elevation.min, elevation.max);

        this._shouldUpdateHeightMap = true;

        this._onElevationChanged(this);
    }

    getScreenPixelSize(view: View, target?: Vector2): Vector2 {
        target = target ?? new Vector2();

        const sphere = this.getWorldSpaceBoundingSphere(tmpSphere);

        const distance = sphere.center.distanceTo(view.camera.getWorldPosition(tempVec3));

        let height: number;
        let width: number;

        const camera = view.camera;

        if (isPerspectiveCamera(camera)) {
            const fovRads = MathUtils.degToRad(camera.fov);
            height = 2 * Math.tan(fovRads / 2) * distance;
            width = height * camera.aspect;
        } else {
            height = Math.abs(camera.top - camera.bottom);
            width = Math.abs(camera.right - camera.left);
        }

        const diameter = sphere.radius * 2;

        const wRatio = diameter / width;
        const hRatio = diameter / height;

        target.setX(Math.ceil(wRatio * view.width));
        target.setY(Math.ceil(hRatio * view.height));

        return target;
    }

    private createHeightMap(renderTarget: WebGLRenderTarget, offsetScale: OffsetScale) {
        const outputHeight = Math.floor(renderTarget.height);
        const outputWidth = Math.floor(renderTarget.width);

        // One millimeter
        const precision = 0.001;

        // To ensure that all values are positive before encoding
        const offset = -this._minmax.min;

        const buffer = readRGRenderTargetIntoRGBAU8Buffer({
            renderTarget,
            renderer: this._renderer,
            outputWidth,
            outputHeight,
            precision,
            offset,
        });

        const heightMap = new HeightMap(
            buffer,
            outputWidth,
            outputHeight,
            offsetScale,
            RGBAFormat,
            UnsignedByteType,
            precision,
            offset,
        );
        this._heightMap = intoUniqueOwner(heightMap, this);
    }

    private inheritHeightMap(heightMap: UniqueOwner<HeightMap, this>) {
        this._heightMap = heightMap;
        this._shouldUpdateHeightMap = true;

        // Let's get a more precise minmax from the inherited heightmap, but
        // only on the region of the inherited heightmap that matches this tile's extent
        // (otherwise this would not provide any benefit at all);
        const minmax = heightMap.payload.getMinMax(THIS_RECT);
        if (minmax != null) {
            this._minmax = minmax;
        }
    }

    private resetHeights() {
        this.geometry.resetHeights();
        this.setBBoxZ(0, 0);

        this._onElevationChanged(this);
    }

    private applyHeightMap() {
        if (!this._heightMap) {
            return;
        }

        const { min, max } = this.geometry.applyHeightMap(this._heightMap.payload);

        if (min > this._minmax.min && max < this._minmax.max) {
            this.setBBoxZ(min, max);
        }

        if (this._helpers.colliderMesh) {
            this._helpers.colliderMesh.geometry = this.geometry.raycastGeometry;
        }

        this._onElevationChanged(this);
    }

    setBBoxZ(min: number | undefined, max: number | undefined) {
        // 0 is an acceptable value
        if (min == null || max == null) {
            return;
        }
        this._minmax = { min, max };

        if (this._skirtDepth != null) {
            this._minmax.min = Math.min(this._skirtDepth, this._minmax.min);
        }

        this.updateVolume(min, max);
    }

    traverseTiles(callback: (descendant: TileMesh) => void) {
        this.traverse(obj => {
            if (isTileMesh(obj)) {
                callback(obj);
            }
        });
    }

    /**
     * Removes the child tiles and returns the detached tiles.
     */
    detachChildren(): TileMesh[] {
        const childTiles = this.children.filter(c => isTileMesh(c)) as TileMesh[];
        childTiles.forEach(c => c.dispose());
        this.remove(...childTiles);
        return childTiles;
    }

    private updateVolume(min: number, max: number) {
        this._volume.setElevationRange({ min, max });
    }

    get minmax() {
        const range = Math.abs(this._minmax.max - this._minmax.min);
        const width = this._extentDimensions.width;
        const height = this._extentDimensions.height;
        const RATIO = 3;

        // If the current volume is very elongated in the vertical axis,
        // this can cause excessive subdivisions of the tile. Let's compute
        // the heightmap to get a more precise min/max and hopefully a tighter
        // volume. Note that the heightmap will be computed only if it does not
        // exist, avoiding unnecessary computations.
        if (range / Math.max(width, height) > RATIO) {
            this.updateHeightMapIfNecessary();
        }

        return this._minmax;
    }

    getExtent() {
        return this.extent;
    }

    getElevation(params: GetElevationOptions): { elevation: number; resolution: number } | null {
        this.updateHeightMapIfNecessary();

        if (this._heightMap) {
            const uv = this.extent.offsetInExtent(params.coordinates, tempVec2);

            const heightMap = this._heightMap.payload;
            const elevation = heightMap.getValue(uv.x, uv.y);

            if (elevation != null) {
                const dims = this.extent.dimensions(tempVec2);
                const xRes = dims.x / heightMap.width;
                const yRes = dims.y / heightMap.height;
                const resolution = Math.min(xRes, yRes);

                return { elevation, resolution };
            }
        }

        return null;
    }

    /**
     * Gets whether this mesh is currently performing processing.
     *
     * @returns `true` if the mesh is currently performing processing, `false` otherwise.
     */
    get loading() {
        return this.material.loading;
    }

    /**
     * Gets the progress percentage (normalized in [0, 1] range) of the processing.
     *
     * @returns The progress percentage.
     */
    get progress() {
        return this.material.progress;
    }

    /**
     * Search for a common ancestor between this tile and another one. It goes
     * through parents on each side until one is found.
     *
     * @param tile - the tile to evaluate
     * @returns the resulting common ancestor
     */
    findCommonAncestor(tile: TileMesh): TileMesh | null {
        if (tile == null) {
            return null;
        }
        if (tile.lod === this.lod) {
            if (tile.id === this.id) {
                return tile;
            }
            if (tile.lod !== 0) {
                return (this.parent as TileMesh).findCommonAncestor(tile.parent as TileMesh);
            }
            return null;
        }
        if (tile.lod < this.lod) {
            return (this.parent as TileMesh).findCommonAncestor(tile);
        }
        return this.findCommonAncestor(tile.parent as TileMesh);
    }

    isAncestorOf(tile: TileMesh) {
        return tile.findCommonAncestor(this) === this;
    }

    private forEachMaterial(callbackFn: (material: LayeredMaterial) => void) {
        callbackFn(this.material);
        callbackFn(this.customDepthMaterial);
        callbackFn(this.customDistanceMaterial);
    }

    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.dispatchEvent({ type: 'dispose' });

        this.forEachMaterial(m => m.dispose());
        this.geometry.dispose();
    }
}

export function isTileMesh(o: unknown): o is TileMesh {
    return (o as TileMesh).isTileMesh;
}

export default TileMesh;
