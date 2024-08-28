import { Box3, MathUtils, type Matrix4, Vector2, Vector3 } from 'three';
import type ElevationRange from '../../core/ElevationRange';
import Coordinates from '../../core/geographic/Coordinates';
import type Ellipsoid from '../../core/geographic/Ellipsoid';
import type Extent from '../../core/geographic/Extent';
import TileVolume from './TileVolume';

const vec3 = new Vector3();
const vec2 = new Vector2();
const coord = new Coordinates('EPSG:4326', 0, 0);

export default class EllipsoidTileVolume extends TileVolume {
    private readonly _ellipsoid: Ellipsoid;
    private readonly _extent: Extent;
    private _range: ElevationRange = { min: -1, max: +1 };

    private _corners: Vector3[] | null = null;
    private _max = 0;
    private _min = 0;

    get extent(): Readonly<Extent> {
        return this._extent;
    }

    get ellipsoid(): Readonly<Ellipsoid> {
        return this._ellipsoid;
    }

    constructor(options: { extent: Extent; range: ElevationRange; ellipsoid: Ellipsoid }) {
        super();
        this._extent = options.extent;
        this._range = options.range;
        this._ellipsoid = options.ellipsoid;
    }

    getWorldSpaceCorners(matrix: Matrix4): Vector3[] {
        if (this._corners == null) {
            const dims = this._extent.dimensions(vec2);

            const xCount = MathUtils.clamp(Math.round(dims.width / 5) + 1, 2, 6);
            const yCount = MathUtils.clamp(Math.round(dims.height / 5) + 1, 2, 6);

            this._corners = new Array(xCount * yCount);
            const uStep = 1 / (xCount - 1);
            const jStep = 1 / (yCount - 1);

            let index = 0;
            for (let i = 0; i < xCount; i++) {
                for (let j = 0; j < yCount; j++) {
                    const u = i * uStep;
                    const v = j * jStep;

                    const { latitude, longitude } = this._extent.sampleUV(u, v, coord);

                    const p0 = this._ellipsoid.toCartesian(latitude, longitude, this._min);
                    const p1 = this._ellipsoid.toCartesian(latitude, longitude, this._max);

                    p0.applyMatrix4(matrix);
                    p1.applyMatrix4(matrix);

                    this._corners[index++] = p0;
                    this._corners[index++] = p1;
                }
            }
        }

        return this._corners;
    }

    protected override computeLocalBox(): Box3 {
        const extent = this._extent;

        const min = this._range.min;
        const max = this._range.max;

        const p0 = this._ellipsoid.toCartesian(extent.north, extent.west, min);
        const p1 = this._ellipsoid.toCartesian(extent.north, extent.west, max);

        const p2 = this._ellipsoid.toCartesian(extent.south, extent.west, min);
        const p3 = this._ellipsoid.toCartesian(extent.south, extent.west, max);

        const p4 = this._ellipsoid.toCartesian(extent.south, extent.east, min);
        const p5 = this._ellipsoid.toCartesian(extent.south, extent.east, max);

        const p6 = this._ellipsoid.toCartesian(extent.north, extent.east, min);
        const p7 = this._ellipsoid.toCartesian(extent.north, extent.east, max);

        const center = extent.center(coord);

        const p8 = this._ellipsoid.toCartesian(center.latitude, center.longitude, min);
        const p9 = this._ellipsoid.toCartesian(center.latitude, center.longitude, max);

        const p10 = this._ellipsoid.toCartesian(extent.north, center.longitude, min);
        const p11 = this._ellipsoid.toCartesian(extent.south, center.longitude, max);

        const p12 = this._ellipsoid.toCartesian(center.latitude, extent.west, min);
        const p13 = this._ellipsoid.toCartesian(center.latitude, extent.east, max);

        const worldBox = new Box3().setFromPoints([
            p0,
            p1,
            p2,
            p3,
            p4,
            p5,
            p6,
            p7,
            p8,
            p9,
            p10,
            p11,
            p12,
            p13,
        ]);

        return worldBox.setFromCenterAndSize(
            worldBox.getCenter(vec3).sub(p0),
            worldBox.getSize(new Vector3()),
        );
    }

    setElevationRange(range: ElevationRange) {
        let { min, max } = range;

        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            min = 0;
            max = 0;
        }

        this._range = { min, max };

        if (this._min !== min || this._max !== max) {
            this._min = min;
            this._max = max;
            this._localBox = this.computeLocalBox();
            this._corners = null;
        }
    }
}
