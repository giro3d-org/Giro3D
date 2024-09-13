import type { TypedArray } from 'three';
import { Box3, Vector2, Vector3 } from 'three';
import ProjUtils from '../../utils/ProjUtils';
import { nonNull } from '../../utils/tsutils';
import OffsetScale from '../OffsetScale';
import Coordinates, {
    assertCrsIsValid,
    crsIsGeocentric,
    crsIsGeographic,
    is4326,
} from './Coordinates';

const tmpXY = new Vector2();

const CARDINAL = {
    WEST: 0,
    EAST: 1,
    SOUTH: 2,
    NORTH: 3,
};

export function reasonnableEpsilonForCRS(crs: string, width: number, height: number) {
    if (is4326(crs)) {
        return 0.01;
    }
    return 0.01 * Math.min(width, height);
}

const cardinals: Vector2[] = [
    new Vector2(),
    new Vector2(),
    new Vector2(),
    new Vector2(),
    new Vector2(),
    new Vector2(),
    new Vector2(),
    new Vector2(),
];

/**
 * Possible values to define an extent.
 *  The following combinations are supported:
 * - 2 coordinates for the min and max corners of the extent
 * - 4 numerical values for the `minx`, `maxx`, `miny`, `maxy`
 * - an object with `west`, `east`, `south`, `north` properties
 */
export type ExtentParameters =
    | [Coordinates, Coordinates]
    | [number, number, number, number]
    | [{ west: number; east: number; south: number; north: number }];

/**
 * An object representing a spatial extent. It encapsulates a Coordinate Reference System id (CRS)
 * and coordinates.
 *
 * It leverages [proj4js](https://github.com/proj4js/proj4js) to do the heavy-lifting of defining
 * and transforming coordinates between reference systems. As a consequence, every EPSG code known
 * by proj4js can be used out of the box, as such:
 *
 *     // an extent defined by bottom-left longitude 0 and latitude 0 and top-right longitude 1 and
 *     // latitude 1
 *     const extent = new Extent('EPSG:4326', 0, 0, 1, 1);
 *
 * For other EPSG codes, you must register them with `Instance.registerCRS()` :
 *
 * ```js
 *     Instance.registerCRS('EPSG:3946',
 *         '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 + \
 *         ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
 *
 *     extent = new Extent(
 *                  'EPSG:3946',
 *                  1837816.94334, 1847692.32501,
 *                  5170036.4587, 5178412.82698);
 * ```
 */
class Extent {
    private readonly _values: Float64Array;
    private _crs: string;

    /**
     * Constructs an Extent object.
     *
     * @param crs - The CRS code the coordinates are expressed in. Every EPSG code known by
     * [proj4js](https://github.com/proj4js/proj4js) can be used directly.
     * For others, you must manually register them.
     * Please refer to [proj4js](https://github.com/proj4js/proj4js) doc for more information.
     * @param values - The extent values.
     */
    constructor(crs: string, ...values: ExtentParameters) {
        this._values = new Float64Array(4);
        this._crs = crs;
        this.set(crs, ...values);
    }

    /**
     * Returns an extent centered at the specified coordinate, and with the specified size.
     *
     * @param crs - The CRS identifier.
     * @param center - The center.
     * @param width - The width, in CRS units.
     * @param height - The height, in CRS units.
     * @returns The produced extent.
     */
    static fromCenterAndSize(
        crs: string,
        center: { x: number; y: number },
        width: number,
        height: number,
    ) {
        const minX = center.x - width / 2;
        const maxX = center.x + width / 2;
        const minY = center.y - height / 2;
        const maxY = center.y + height / 2;

        return new Extent(crs, minX, maxX, minY, maxY);
    }

    get values() {
        return this._values;
    }

    /**
     * Returns `true` if the two extents are equal.
     *
     * @param other - The extent to compare.
     * @param epsilon - The optional comparison epsilon.
     * @returns `true` if the extents are equal, otherwise `false`.
     */
    equals(other: Extent, epsilon = 0.00001) {
        return (
            other._crs === this._crs &&
            Math.abs(other._values[0] - this._values[0]) <= epsilon &&
            Math.abs(other._values[1] - this._values[1]) <= epsilon &&
            Math.abs(other._values[2] - this._values[2]) <= epsilon &&
            Math.abs(other._values[3] - this._values[3]) <= epsilon
        );
    }

    /**
     * Checks the validity of the extent.
     *
     * @returns `true` if the extent is valid, `false` otherwise.
     */
    isValid() {
        if (
            !(
                Number.isFinite(this.west) &&
                Number.isFinite(this.east) &&
                Number.isFinite(this.south) &&
                Number.isFinite(this.north)
            )
        ) {
            return false;
        }

        // Geographic coordinate systems may allow a greater "west" than "east"
        // to account for the wrap around the 180° longitude line.
        if (!crsIsGeographic(this.crs)) {
            if (this.west > this.east) {
                return false;
            }
        }

        if (this.south > this.north) {
            return false;
        }

        return true;
    }

    /**
     * Clones this object.
     *
     * @returns a copy of this object.
     */
    clone() {
        const minx = this._values[CARDINAL.WEST];
        const maxx = this._values[CARDINAL.EAST];
        const miny = this._values[CARDINAL.SOUTH];
        const maxy = this._values[CARDINAL.NORTH];
        const result = new Extent(this._crs, minx, maxx, miny, maxy);
        return result;
    }

    /**
     * Returns an extent with a relative margin added.
     *
     * @param marginRatio - The margin, in normalized value ([0, 1]).
     * A margin of 1 means 100% of the width or height of the extent.
     * @example
     * const extent = new Extent('EPSG:3857', 0, 100, 0, 100);
     * const margin = extent.withRelativeMargin(0.1);
     * //  new Extent('EPSG:3857', -10, 110, -10, 110);
     * @returns a new extent with a specified margin applied.
     */
    withRelativeMargin(marginRatio: number) {
        const w = Math.abs(this.west - this.east);
        const h = Math.abs(this.north - this.south);

        return this.withMargin(marginRatio * w, marginRatio * h);
    }

    /**
     * Returns an extent with a margin.
     *
     * @param x - The horizontal margin, in CRS units.
     * @param y - The vertical margin, in CRS units.
     * @example
     * const extent = new Extent('EPSG:3857', 0, 100, 0, 100);
     * const margin = extent.withMargin(10, 15);
     * //  new Extent('EPSG:3857', -10, 110, -15, 115);
     * @returns a new extent with a specified margin applied.
     */
    withMargin(x: number, y: number) {
        const w = this.west - x;
        const e = this.east + x;
        const n = this.north + y;
        const s = this.south - y;

        return new Extent(this.crs, w, e, s, n);
    }

    /**
     * Converts this extent into another CRS.
     * If `crs` is the same as the current CRS, the original object is returned.
     *
     * @param crs - the new CRS
     * @returns the converted extent.
     */
    as(crs: string): this | Extent {
        assertCrsIsValid(crs);

        if (this._crs !== crs && !(is4326(this._crs) && is4326(crs))) {
            // Compute min/max in x/y by projecting 8 cardinal points,
            // and then taking the min/max of each coordinates.
            const c = this.centerAsVector2(tmpXY);
            const cx = c.x;
            const cy = c.y;
            const e = this.east;
            const w = this.west;
            const n = this.north;
            const s = this.south;

            cardinals[0].set(w, n);
            cardinals[1].set(cx, n);
            cardinals[2].set(e, n);
            cardinals[3].set(e, cy);
            cardinals[4].set(e, s);
            cardinals[5].set(cx, s);
            cardinals[6].set(w, s);
            cardinals[7].set(w, cy);

            let north = -Infinity;
            let south = Infinity;
            let east = -Infinity;
            let west = Infinity;

            // convert the coordinates
            ProjUtils.transformVectors(this._crs, crs, cardinals);

            // loop over the coordinates
            for (let i = 0; i < cardinals.length; i++) {
                north = Math.max(north, cardinals[i].y);
                south = Math.min(south, cardinals[i].y);
                east = Math.max(east, cardinals[i].x);
                west = Math.min(west, cardinals[i].x);
            }
            return new Extent(crs, {
                north,
                south,
                east,
                west,
            });
        }

        return this;
    }

    offsetToParent(other: Extent, target = new OffsetScale()) {
        if (this.crs !== other.crs) {
            throw new Error('unsupported mix');
        }

        const oDim = other.dimensions();
        const dim = this.dimensions();

        const originX = Math.round((1000 * (this.west - other.west)) / oDim.x) * 0.001;
        const originY = Math.round((1000 * (this.south - other.south)) / oDim.y) * 0.001;

        const scaleX = Math.round((1000 * dim.x) / oDim.x) * 0.001;
        const scaleY = Math.round((1000 * dim.y) / oDim.y) * 0.001;

        return target.set(originX, originY, scaleX, scaleY);
    }

    /**
     * @returns the horizontal coordinate of the westernmost side
     */
    get west() {
        return this._values[CARDINAL.WEST];
    }

    /**
     * @returns the horizontal coordinate of the easternmost side
     */
    get east() {
        return this._values[CARDINAL.EAST];
    }

    /**
     * @returns the horizontal coordinate of the northernmost side
     */
    get north() {
        return this._values[CARDINAL.NORTH];
    }

    /**
     * @returns the horizontal coordinate of the southermost side
     */
    get south() {
        return this._values[CARDINAL.SOUTH];
    }

    /**
     * @returns the coordinates of the top left corner
     */
    topLeft() {
        return new Coordinates(this.crs, this.west, this.north, 0);
    }

    /**
     * @returns the coordinates of the top right corner
     */
    topRight() {
        return new Coordinates(this.crs, this.east, this.north, 0);
    }

    /**
     * @returns the coordinates of the bottom right corner
     */
    bottomRight() {
        return new Coordinates(this.crs, this.east, this.south, 0);
    }

    /**
     * @returns the coordinates of the bottom right corner
     */
    bottomLeft() {
        return new Coordinates(this.crs, this.west, this.south, 0);
    }

    /**
     * Gets the coordinate reference system of this extent.
     */
    get crs(): string {
        return this._crs;
    }

    /**
     * Sets `target` with the center of this extent.
     *
     * @param target - the coordinate to set with the center's coordinates.
     * If none provided, a new one is created.
     * @returns the modified object passed in argument.
     */
    center(target?: Coordinates): Coordinates {
        const center = this.centerAsVector2(tmpXY);

        let result;

        if (target) {
            result = target;
            result.set(this._crs, center.x, center.y, 0);
        } else {
            result = new Coordinates(this._crs, center.x, center.y, 0);
        }

        return result;
    }

    /**
     * Sets `target` with the center of this extent.
     *
     * @param target - the vector to set with the center's coordinates.
     * If none provided, a new one is created.
     * @returns the modified object passed in argument.
     */
    centerAsVector2(target?: Vector2): Vector2 {
        const dim = this.dimensions(tmpXY);

        const x = this._values[0] + dim.x * 0.5;
        const y = this._values[2] + dim.y * 0.5;

        let result;

        if (target) {
            result = target;
            result.set(x, y);
        } else {
            result = new Vector2(x, y);
        }

        return result;
    }

    /**
     * Sets `target` with the center of this extent.
     * Note: The z coordinate of the resulting vector will be set to zero.
     *
     * @param target - the vector to set with the center's coordinates.
     * If none provided, a new one is created.
     * @returns the modified object passed in argument.
     */
    centerAsVector3(target?: Vector3): Vector3 {
        const center = this.centerAsVector2(tmpXY);

        let result;

        if (target) {
            result = target;
            result.set(center.x, center.y, 0);
        } else {
            result = new Vector3(center.x, center.y, 0);
        }

        return result;
    }

    /**
     * Sets the target with the width and height of this extent.
     * The `x` property will be set with the width,
     * and the `y` property will be set with the height.
     *
     * @param target - the optional target to set with the result.
     * @returns the modified object passed in argument,
     * or a new object if none was provided.
     */
    dimensions(target: Vector2 = new Vector2()): Vector2 {
        target.x = Math.abs(this.east - this.west);
        target.y = Math.abs(this.north - this.south);
        return target;
    }

    /**
     * Checks whether the specified coordinate is inside this extent.
     *
     * @param coord - the coordinate to test
     * @param epsilon - the precision delta (+/- epsilon)
     * @returns `true` if the coordinate is inside the bounding box
     */
    isPointInside(coord: Coordinates, epsilon = 0) {
        const c = this.crs === coord.crs ? coord : coord.as(this.crs);
        // TODO this ignores altitude
        if (crsIsGeographic(this.crs)) {
            return (
                c.longitude <= this.east + epsilon &&
                c.longitude >= this.west - epsilon &&
                c.latitude <= this.north + epsilon &&
                c.latitude >= this.south - epsilon
            );
        }
        return (
            c.x <= this.east + epsilon &&
            c.x >= this.west - epsilon &&
            c.y <= this.north + epsilon &&
            c.y >= this.south - epsilon
        );
    }

    /**
     * Tests whether this extent is contained in another extent.
     *
     * @param other - the other extent to test
     * @param epsilon - the precision delta (+/- epsilon).
     * If this value is not provided, a reasonable epsilon will be computed.
     * @returns `true` if this extent is contained in the other extent.
     */
    isInside(other: Extent, epsilon: number | null = null) {
        const o = other.as(this._crs);
        // 0 is an acceptable value for epsilon:
        const dims = this.dimensions(tmpXY);
        epsilon = epsilon == null ? reasonnableEpsilonForCRS(this._crs, dims.x, dims.y) : epsilon;
        return (
            this.east - o.east <= epsilon &&
            o.west - this.west <= epsilon &&
            this.north - o.north <= epsilon &&
            o.south - this.south <= epsilon
        );
    }

    /**
     * Returns `true` if this bounding box intersect with the bouding box parameter
     *
     * @param bbox - the bounding box to test
     * @returns `true` if this bounding box intersects with the provided bounding box
     */
    intersectsExtent(bbox: Extent) {
        const other = bbox.as(this.crs);
        return !(
            this.west >= other.east ||
            this.east <= other.west ||
            this.south >= other.north ||
            this.north <= other.south
        );
    }

    /**
     * Set this extent to the intersection of itself and other
     *
     * @param other - the bounding box to intersect
     * @returns the modified extent
     */
    intersect(other: Extent): this {
        if (!this.intersectsExtent(other)) {
            this.set(this.crs, 0, 0, 0, 0);
            return this;
        }
        // TODO use an intermediate tmp instance for .as
        if (other.crs !== this.crs) {
            other = other.as(this.crs);
        }
        this.set(
            this.crs,
            Math.max(this.west, other.west),
            Math.min(this.east, other.east),
            Math.max(this.south, other.south),
            Math.min(this.north, other.north),
        );

        return this;
    }

    /**
     * Returns an extent that is adjusted so that its edges land exactly at the border
     * of the grid pixels. Optionally, you can specify the minimum pixel size of the
     * resulting extent.
     *
     * @param gridExtent - The grid extent.
     * @param gridWidth - The grid width, in pixels.
     * @param gridHeight - The grid height, in pixels.
     * @param minPixWidth - The minimum width, in pixels, of the resulting extent.
     * @param minPixHeight - The minimum height, in pixels, of the resulting extent.
     * @returns The adjusted extent and pixel
     * size of the adjusted extent.
     */
    fitToGrid(
        gridExtent: Extent,
        gridWidth: number,
        gridHeight: number,
        minPixWidth?: number,
        minPixHeight?: number,
    ): { extent: Extent; width: number; height: number } {
        const gridDims = gridExtent.dimensions(tmpXY);
        const pixelWidth = gridDims.x / gridWidth;
        const pixelHeight = gridDims.y / gridHeight;

        let leftPixels = (this.west - gridExtent.west) / pixelWidth;
        let rightPixels = (this.east - gridExtent.west) / pixelWidth;
        let bottomPixels = (this.south - gridExtent.south) / pixelHeight;
        let topPixels = (this.north - gridExtent.south) / pixelHeight;

        if (minPixWidth !== undefined && minPixHeight !== undefined) {
            const pixelCountX = rightPixels - leftPixels;
            const pixelCountY = topPixels - bottomPixels;
            if (pixelCountX < minPixWidth) {
                const margin = (minPixWidth - pixelCountX) / 2;
                leftPixels -= margin;
                rightPixels += margin;
            }
            if (pixelCountY < minPixHeight) {
                const margin = (minPixHeight - pixelCountY) / 2;
                bottomPixels -= margin;
                topPixels += margin;
            }
        }

        leftPixels = Math.max(0, Math.floor(leftPixels));
        rightPixels = Math.min(gridWidth, Math.ceil(rightPixels));
        bottomPixels = Math.max(0, Math.floor(bottomPixels));
        topPixels = Math.min(gridHeight, Math.ceil(topPixels));

        const west = gridExtent.west + leftPixels * pixelWidth;
        const east = gridExtent.west + rightPixels * pixelWidth;
        const south = gridExtent.south + bottomPixels * pixelHeight;
        const north = gridExtent.south + topPixels * pixelHeight;

        return {
            extent: new Extent(this.crs, west, east, south, north),
            width: rightPixels - leftPixels,
            height: topPixels - bottomPixels,
        };
    }

    /**
     * Set the coordinate reference system and values of this
     * extent.
     *
     * @param crs - the new CRS
     * @param values - the new values
     * @returns this object modified
     */
    set(crs: string, ...values: ExtentParameters): this {
        this._crs = crs;

        if (
            values.length === 2 &&
            values[0] instanceof Coordinates &&
            values[1] instanceof Coordinates
        ) {
            [this._values[CARDINAL.WEST], this._values[CARDINAL.SOUTH]] = values[0].values;
            [this._values[CARDINAL.EAST], this._values[CARDINAL.NORTH]] = values[1].values;
        } else if (values.length === 1 && values[0].west !== undefined) {
            this._values[CARDINAL.WEST] = values[0].west;
            this._values[CARDINAL.EAST] = values[0].east;
            this._values[CARDINAL.SOUTH] = values[0].south;
            this._values[CARDINAL.NORTH] = values[0].north;
        } else if (values.length === 4) {
            this._values[CARDINAL.WEST] = values[CARDINAL.WEST];
            this._values[CARDINAL.EAST] = values[CARDINAL.EAST];
            this._values[CARDINAL.SOUTH] = values[CARDINAL.SOUTH];
            this._values[CARDINAL.NORTH] = values[CARDINAL.NORTH];
        } else {
            throw new Error(`Unsupported constructor args '${values}'`);
        }
        return this;
    }

    copy(other: Extent): this {
        this._crs = other.crs;
        this._values[CARDINAL.WEST] = other._values[CARDINAL.WEST];
        this._values[CARDINAL.EAST] = other._values[CARDINAL.EAST];
        this._values[CARDINAL.SOUTH] = other._values[CARDINAL.SOUTH];
        this._values[CARDINAL.NORTH] = other._values[CARDINAL.NORTH];
        return this;
    }

    /** @internal */
    static unionMany(...extents: Extent[]): Extent | null {
        if (extents == null || extents.length === 0) {
            return null;
        }

        if (extents.length === 1) {
            return extents[0].clone();
        }

        let south = +Infinity;
        let north = -Infinity;
        let east = -Infinity;
        let west = +Infinity;
        let valid = false;
        let crs: string | null = null;

        for (let i = 0; i < extents.length; i++) {
            const e = nonNull(extents[i]);

            valid = true;
            if (crs != null) {
                if (crs !== e.crs) {
                    throw new Error(
                        `Unsupported union between different CRSes (${e.crs} and ${crs} differ)`,
                    );
                }
            } else {
                crs = e.crs;
            }

            south = Math.min(e.south, south);
            north = Math.max(e.north, north);
            east = Math.max(e.east, east);
            west = Math.min(e.west, west);
        }

        if (valid) {
            return new Extent(extents[0].crs, west, east, south, north);
        } else {
            return null;
        }
    }

    union(extent: Extent | null | undefined): void {
        if (extent == null) {
            return;
        }

        if (extent.crs !== this.crs) {
            throw new Error(
                `unsupported union between different CRSes (${extent.crs} and ${this.crs} differ)`,
            );
        }
        const west = extent.west;
        if (west < this.west) {
            this._values[CARDINAL.WEST] = west;
        }

        const east = extent.east;
        if (east > this.east) {
            this._values[CARDINAL.EAST] = east;
        }

        const south = extent.south;
        if (south < this.south) {
            this._values[CARDINAL.SOUTH] = south;
        }

        const north = extent.north;
        if (north > this.north) {
            this._values[CARDINAL.NORTH] = north;
        }
    }

    /**
     * Expands the extent to contain the specified coordinates.
     *
     * @param coordinates - The coordinates to include
     */
    expandByPoint(coordinates: Coordinates): void {
        const coords = coordinates.as(this.crs);
        const we = coords.values[0];
        if (we < this.west) {
            this._values[CARDINAL.WEST] = we;
        }
        if (we > this.east) {
            this._values[CARDINAL.EAST] = we;
        }
        const sn = coords.values[1];
        if (sn < this.south) {
            this._values[CARDINAL.SOUTH] = sn;
        }
        if (sn > this.north) {
            this._values[CARDINAL.NORTH] = sn;
        }
    }

    /**
     * Moves the extent by the provided `x` and `y` values.
     *
     * @param x - the horizontal shift
     * @param y - the vertical shift
     * @returns the modified extent.
     */
    shift(x: number, y: number): this {
        this._values[CARDINAL.WEST] += x;
        this._values[CARDINAL.EAST] += x;
        this._values[CARDINAL.SOUTH] += y;
        this._values[CARDINAL.NORTH] += y;
        return this;
    }

    /**
     * Constructs an extent from the specified box.
     *
     * @param crs - the coordinate reference system of the new extent.
     * @param box - the box to read values from
     * @returns the constructed extent.
     */
    static fromBox3(crs: string, box: Box3): Extent {
        return new this(crs, {
            west: box.min.x,
            east: box.max.x,
            south: box.min.y,
            north: box.max.y,
        });
    }

    /**
     * Returns a [Box3](https://threejs.org/docs/?q=box3#api/en/math/Box3) that matches this extent.
     *
     * @param minHeight - The min height of the box.
     * @param maxHeight - The max height of the box.
     * @returns The box.
     */
    toBox3(minHeight: number, maxHeight: number): Box3 {
        const min = new Vector3(this.west, this.south, minHeight);
        const max = new Vector3(this.east, this.north, maxHeight);
        const box = new Box3(min, max);
        return box;
    }

    /**
     * Returns the normalized offset from bottom-left in extent of this Coordinates
     *
     * @param coordinate - the coordinate
     * @param target - optional `Vector2` target.
     * If not present a new one will be created.
     * @returns normalized offset in extent
     * @example
     * extent.offsetInExtent(extent.center())
     * // returns `(0.5, 0.5)`.
     */
    offsetInExtent(coordinate: Coordinates, target = new Vector2()) {
        if (coordinate.crs !== this.crs) {
            throw new Error('unsupported mix');
        }

        const dimX = Math.abs(this.east - this.west);
        const dimY = Math.abs(this.north - this.south);

        const x = crsIsGeocentric(coordinate.crs) ? coordinate.x : coordinate.longitude;
        const y = crsIsGeocentric(coordinate.crs) ? coordinate.y : coordinate.latitude;

        const originX = (x - this.west) / dimX;
        const originY = (y - this.south) / dimY;

        target.set(originX, originY);
        return target;
    }

    /**
     * Divides this extent into a regular grid.
     * The number of points in each direction is equal to the number of subdivisions + 1.
     * The points are laid out row-wise, from west to east, and north to south:
     *
     * ```
     * 1 -- 2
     * |    |
     * 3 -- 4
     * ```
     *
     * @param xSubdivs - The number of grid subdivisions in the x-axis.
     * @param ySubdivs - The number of grid subdivisions in the y-axis.
     * @param target - The array to fill.
     * @param stride - The number of elements per item (2 for XY, 3 for XYZ).
     * @returns the target.
     */
    toGrid<T extends TypedArray>(xSubdivs: number, ySubdivs: number, target: T, stride: number): T {
        const dims = this.dimensions(tmpXY);
        const west = this.west;
        const north = this.north;

        // The size of an horizontal/vertical step
        const xStep = dims.x / xSubdivs;
        const yStep = dims.y / ySubdivs;

        // The number of vertices in each direction
        const xCount = xSubdivs + 1;
        const yCount = ySubdivs + 1;

        for (let j = 0; j < yCount; j++) {
            for (let i = 0; i < xCount; i++) {
                const x = west + xStep * i;
                const y = north - yStep * j;

                const index = stride * (xCount * j + i);
                target[index + 0] = x;
                target[index + 1] = y;
            }
        }

        return target;
    }

    /**
     * Subdivides this extents into x and y subdivisions.
     *
     * Notes:
     * - Subdivisions must be strictly positive.
     * - If both subvisions are `1`, an array of one element is returned,
     *  containing a copy of this extent.
     *
     * @param xSubdivs - The number of subdivisions on the X/longitude axis.
     * @param ySubdivs - The number of subdivisions on the Y/latitude axis.
     * @returns the resulting extents.
     * @example
     * const extent = new Extent('EPSG:3857', 0, 100, 0, 100);
     * extent.split(2, 1);
     * // [0, 50, 0, 50], [50, 100, 50, 100]
     */
    split(xSubdivs: number, ySubdivs: number): Extent[] {
        if (xSubdivs < 1 || ySubdivs < 1) {
            throw new Error('Invalid subdivisions. Must be strictly positive.');
        }

        if (xSubdivs === 1 && ySubdivs === 1) {
            return [this.clone()];
        }

        const dims = this.dimensions();
        const minX = this.west;
        const minY = this.south;
        const w = dims.x / xSubdivs;
        const h = dims.y / ySubdivs;
        const crs = this.crs;

        const result = [];

        for (let x = 0; x < xSubdivs; x++) {
            for (let y = 0; y < ySubdivs; y++) {
                const west = minX + x * w;
                const south = minY + y * h;
                const east = west + w;
                const north = south + h;
                const extent = new Extent(crs, west, east, south, north);
                result.push(extent);
            }
        }

        return result;
    }

    /**
     * The bounds of the Web Mercator (EPSG:3857) projection.
     */
    static get webMercator(): Extent {
        return new Extent('EPSG:3857', -20037508.34, 20037508.34, -20048966.1, 20048966.1);
    }

    /**
     * The bounds of the whole world in the EPSG:4326 projection.
     */
    static get WGS84(): Extent {
        return new Extent('EPSG:4326', -180, 180, -90, 90);
    }
}

export default Extent;
