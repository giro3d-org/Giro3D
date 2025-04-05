import { Box3, BufferAttribute, BufferGeometry, MathUtils, Vector2, Vector3 } from 'three';
import type Extent from '../../core/geographic/Extent';
import type HeightMap from '../../core/HeightMap';
import type MemoryUsage from '../../core/MemoryUsage';
import type { GetMemoryUsageContext } from '../../core/MemoryUsage';
import { getGeometryMemoryUsage } from '../../core/MemoryUsage';
import { getGridBuffers } from './GridBuilder';
import type TileGeometry from './TileGeometry';

const tmpVec2 = new Vector2();
const tmpVec3 = new Vector3();

export function toCartesian(lat: number, lon: number, radius: number, target: Vector3): Vector3 {
    const phi = MathUtils.degToRad(lat);
    const theta = MathUtils.degToRad(lon + 90);

    const cosPhiRadius = Math.cos(phi) * radius;

    target.x = -(cosPhiRadius * Math.cos(theta));
    target.y = cosPhiRadius * Math.sin(theta);
    target.z = Math.sin(phi) * radius;

    return target;
}

export default class PanoramaTileGeometry
    extends BufferGeometry
    implements MemoryUsage, TileGeometry
{
    readonly isMemoryUsage = true as const;
    private readonly _extent: Extent;
    private readonly _origin: Vector3;
    private readonly _radius: number;

    private _segments = 8;

    get vertexCount() {
        return this.getAttribute('position').count;
    }

    get segments(): number {
        return this._segments;
    }

    set segments(v: number) {
        if (this._segments !== v) {
            this._segments = v;
            this.buildBuffers(this);
        }
    }

    get origin(): Vector3 {
        return this._origin;
    }

    get raycastGeometry() {
        return this;
    }

    constructor(params: { extent: Extent; segments: number; radius: number }) {
        super();

        this._segments = params.segments;
        this._extent = params.extent;

        this._radius = params.radius;

        this._origin = toCartesian(
            this._extent.north,
            this._extent.west,
            this._radius,
            new Vector3(),
        );

        if (this._extent.crs !== 'equirectangular') {
            throw new Error(`invalid CRS. Expected 'equirectangular', got: ${this._extent.crs}`);
        }

        this.buildBuffers(this);
    }

    resetHeights(): void {
        // Nothing to do
    }

    applyHeightMap(_heightMap: HeightMap): { min: number; max: number } {
        // Nothing to do
        return { min: 0, max: 0 };
    }

    getMemoryUsage(context: GetMemoryUsageContext) {
        getGeometryMemoryUsage(context, this);
    }

    private buildBuffers(geometry: BufferGeometry) {
        this.dispose();

        const rowVertices = this._segments + 1;

        const dims = this._extent.dimensions(tmpVec2);
        const width = dims.width;
        const height = dims.height;
        const west = this._extent.west;
        const north = this._extent.north;

        // Positions are relative to the origin of the tile
        const origin = this._origin;

        // A shortcut to get ready to use buffers
        const buffers = getGridBuffers(this.segments, false);

        const boundingBox = new Box3().makeEmpty();

        // Those buffers need to be cloned because they are unique per-tile
        const positionBuffer = buffers.positionBuffer.clone();

        // But these one can be reused as they are never modified
        const uvBuffer = buffers.uvBuffer;
        const indexBuffer = buffers.indexBuffer;

        for (let j = 0; j < rowVertices; j++) {
            for (let i = 0; i < rowVertices; i++) {
                const idx = j * rowVertices + i;

                const u = i / this.segments;
                const v = j / this.segments;

                const lon = west + u * width;
                const lat = north - v * height;

                const cartesian = toCartesian(lat, lon, this._radius, tmpVec3);

                const pos = cartesian.sub(origin);

                boundingBox.expandByPoint(pos);

                positionBuffer.set(idx, pos.x, pos.y, pos.z);
            }
        }

        // Per-tile buffers
        geometry.setAttribute('position', new BufferAttribute(positionBuffer.array, 3));

        // Shared buffers
        geometry.setAttribute('uv', new BufferAttribute(uvBuffer.array, 2));
        geometry.setIndex(new BufferAttribute(indexBuffer, 1));

        this.boundingBox = boundingBox;
        this.computeBoundingBox();
    }
}
