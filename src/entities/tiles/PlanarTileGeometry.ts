import type { Vector2 } from 'three';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type Extent from '../../core/geographic/Extent';
import type HeightMap from '../../core/HeightMap';
import type MemoryUsage from '../../core/MemoryUsage';
import { getGeometryMemoryUsage, type GetMemoryUsageContext } from '../../core/MemoryUsage';
import type TileGeometry from './TileGeometry';

const normalBufferPool = new Map<number, Float32Array>();

function getNormalBuffer(length: number) {
    let buffer = normalBufferPool.get(length);
    if (!buffer) {
        buffer = new Float32Array(length);
        for (let i = 0; i < buffer.length; i += 3) {
            // Z-up vector
            buffer[i + 0] = 0;
            buffer[i + 1] = 0;
            buffer[i + 2] = 1;
        }

        normalBufferPool.set(length, buffer);
    }

    return buffer;
}

export interface TileGeometryOptions {
    extent: Extent;
    segments: number;
}

export interface TileGeometryProperties {
    width: number;
    height: number;
    uvStepX: number;
    uvStepY: number;
    rowStep: number;
    columnStep: number;
    translateX: number;
    translateY: number;
    triangles: number;
    numVertices: number;
}

export function createGrid(props: TileGeometryProperties) {
    const width = props.width;
    const height = props.height;
    const rowStep = props.rowStep;
    const columnStep = props.columnStep;
    const translateX = props.translateX;
    const translateY = props.translateY;
    const uvStepX = props.uvStepX;
    const uvStepY = props.uvStepY;
    const numVertices = props.numVertices;

    const uvs = new Float32Array(numVertices * 2);
    const positions = new Float32Array(numVertices * 3);
    const indexCount = props.triangles * 3;
    const indices =
        positions.length <= 65536 ? new Uint16Array(indexCount) : new Uint32Array(indexCount);

    let posX;
    let h = 0;
    let iPos = 0;
    let uvY = 0.0;
    let indicesNdx = 0;
    let posY = translateY;
    let posNdx;
    let uvNdx;

    // Top border
    //
    for (posX = 0; posX < width; posX++) {
        // Store xy position and and corresponding uv of a pixel data.
        posNdx = iPos * 3;
        positions[posNdx + 0] = posX * rowStep + translateX;
        positions[posNdx + 1] = -posY;
        positions[posNdx + 2] = 0.0;
        uvNdx = iPos * 2;
        uvs[uvNdx + 0] = posX * uvStepX;
        uvs[uvNdx + 1] = uvY;
        iPos += 1;
    }
    // Next rows
    //
    for (h = 1; h < height; h++) {
        posY = h * columnStep + translateY;
        uvY = h * uvStepY;
        // First cell, left border
        posX = 0;
        // Store xy position and and corresponding uv of a pixel data.
        posNdx = iPos * 3;
        positions[posNdx + 0] = posX * rowStep + translateX;
        positions[posNdx + 1] = -posY;
        positions[posNdx + 2] = 0.0;
        uvNdx = iPos * 2;
        uvs[uvNdx + 0] = posX * uvStepX;
        uvs[uvNdx + 1] = uvY;
        iPos += 1;
        // Next cells
        for (posX = 1; posX < width; posX++) {
            // Construct indices as two different triangles from a
            // particular vertex. Use previous and aboves while rolling
            // so discard first row (top border) and first data of each
            // row (left border).
            // x---x       x   .
            //  \  |       | \
            //   \ |       |  \
            // .   x       x---x
            const above = iPos - width;
            const previousPos = iPos - 1;
            const previousAbove = above - 1;
            indices[indicesNdx + 0] = iPos;
            indices[indicesNdx + 1] = previousAbove;
            indices[indicesNdx + 2] = above;
            indices[indicesNdx + 3] = iPos;
            indices[indicesNdx + 4] = previousPos;
            indices[indicesNdx + 5] = previousAbove;
            indicesNdx += 6;
            // Store xy position and and corresponding uv of a pixel data.
            posNdx = iPos * 3;
            positions[posNdx + 0] = posX * rowStep + translateX;
            positions[posNdx + 1] = -posY;
            positions[posNdx + 2] = 0.0;
            uvNdx = iPos * 2;
            uvs[uvNdx + 0] = posX * uvStepX;
            uvs[uvNdx + 1] = uvY;
            iPos += 1;
        }
    }

    return { positions, indices, uvs };
}

/**
 * The PlanarTileGeometry provides a new buffer geometry for each
 * {@link TileMesh} of a
 * {@link Map} object.
 *
 * It is implemented for performance using a rolling approach.
 * The rolling approach is a special case of the sliding window algorithm with
 * a single value window where we iterate (roll, slide) over the data array to
 * compute everything in a single pass (complexity O(n)).
 * By default it produces square geometries but providing different width and height
 * allows for rectangular tiles creation.
 *
 * ```js
 * // Inspired from Map.requestNewTile
 * const extent = new Extent('EPSG:3857', -1000, -1000, 1000, 1000);
 * const paramsGeometry = { extent, segment: 8 };
 * const geometry = new TileGeometry(paramsGeometry);
 * ```
 */
class PlanarTileGeometry extends BufferGeometry implements MemoryUsage, TileGeometry {
    readonly isMemoryUsage = true as const;
    private readonly _dimensions: Vector2;
    private _segments: number;
    private _props: TileGeometryProperties;
    private _extent: Extent;

    getMemoryUsage(context: GetMemoryUsageContext) {
        getGeometryMemoryUsage(context, this);
    }

    get origin() {
        return this._extent.centerAsVector3(new Vector3());
    }

    get raycastGeometry() {
        // No distinction between the raycast geometry and the rendered geometry.
        return this;
    }

    /**
     * @param params - Parameters to construct the grid. Should contain an extent
     *  and a size, either a number of segment or a width and an height in pixels.
     */
    constructor(params: TileGeometryOptions) {
        super();
        this._extent = params.extent;
        // Still mandatory to have on the geometry ?
        this._dimensions = params.extent.dimensions();
        // Compute properties of the grid, square or rectangular.
        this._segments = params.segments;
        this._props = this.updateProps();
        this.computeBuffers(this._props);
        // Compute the Oriented Bounding Box for spatial operations
        this.computeBoundingBox();
    }

    private updateProps() {
        const width = this._segments + 1;
        const height = this._segments + 1;
        const dimension = this._dimensions;
        const uvStep = 1 / this._segments;
        const uvStepY = 1 / this._segments;
        const rowStep = uvStep * dimension.x;
        const columnStep = uvStepY * -dimension.y;
        this._props = {
            width,
            height,
            uvStepX: uvStep,
            uvStepY,
            rowStep,
            columnStep,
            translateX: -this._segments * 0.5 * rowStep,
            translateY: -this._segments * 0.5 * columnStep,
            triangles: this._segments * this._segments * 2,
            numVertices: width * height,
        };
        return this._props;
    }

    get segments() {
        return this._segments;
    }

    set segments(v) {
        if (this._segments !== v) {
            this._segments = v;
            this.updateProps();
            this.computeBuffers(this._props);
        }
    }

    resetHeights() {
        const positions = this.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            positions.setZ(i, 0);
        }
        positions.needsUpdate = true;
        this.computeBoundingBox();
    }

    applyHeightMap(heightMap: HeightMap): { min: number; max: number } {
        /**
         * Returns the elevation by sampling the heightmap at the (u, v) coordinate.
         * Note: the sampling does not perform any interpolation.
         */
        function getElevation(u: number, v: number): number {
            if (heightMap == null) {
                return 0;
            }

            return heightMap.getValue(u, v, true) ?? 0;
        }

        const segments = this._segments;

        const step = 1 / segments;

        const positions = this.getAttribute('position');

        let min = +Infinity;
        let max = -Infinity;

        const verticesPerRow = segments + 1;

        for (let i = 0; i < verticesPerRow; i++) {
            for (let j = 0; j < verticesPerRow; j++) {
                const u = i * step;
                const v = j * step;

                const z = getElevation(u, v);

                min = Math.min(z, min);
                max = Math.max(z, max);

                const idx = i + j * verticesPerRow;
                positions.setZ(idx, z);
            }
        }

        positions.needsUpdate = true;
        this.computeBoundingBox();
        this.computeBoundingSphere();

        return { min, max };
    }

    /**
     * Construct a simple grid buffer geometry using a fast rolling approach.
     *
     * @param props - Properties of the TileGeometry grid, as prepared by this.prepare.
     */
    protected computeBuffers(props: TileGeometryProperties) {
        const { positions, indices, uvs } = createGrid(props);

        this.setAttribute('uv', new BufferAttribute(uvs, 2));
        this.setAttribute('position', new BufferAttribute(positions, 3));
        this.setAttribute('normal', new BufferAttribute(getNormalBuffer(positions.length), 3));
        this.setIndex(new BufferAttribute(indices, 1));
    }
}

export default PlanarTileGeometry;
