import type { Matrix4 } from 'three';
import { Box3, Vector2, Vector3 } from 'three';

import type ElevationRange from '../../core/ElevationRange';
import type Extent from '../../core/geographic/Extent';
import TileVolume from './TileVolume';

const vec2 = new Vector2();
const box = new Box3();

export default class PlanarTileVolume extends TileVolume {
    private readonly _extent: Extent;
    private _range: ElevationRange = { min: -1, max: +1 };

    get extent(): Readonly<Extent> {
        return this._extent;
    }

    constructor(options: { extent: Extent; range: ElevationRange }) {
        super();
        this._extent = options.extent;
        this._range = options.range;
    }

    protected override computeLocalBox(): Box3 {
        const dims = this._extent.dimensions(vec2);
        const width = dims.x;
        const height = dims.y;
        const min = new Vector3(-width / 2, -height / 2, this._range.min);
        const max = new Vector3(+width / 2, +height / 2, this._range.max);
        return new Box3(min, max);
    }

    getWorldSpaceCorners(matrix: Matrix4): Vector3[] {
        const bbox = this.getWorldSpaceBoundingBox(box, matrix);
        const c0 = new Vector3(bbox.min.x, bbox.min.y, bbox.min.z);
        const c1 = new Vector3(bbox.min.x, bbox.min.y, bbox.max.z);

        const c2 = new Vector3(bbox.max.x, bbox.min.y, bbox.min.z);
        const c3 = new Vector3(bbox.max.x, bbox.min.y, bbox.max.z);

        const c4 = new Vector3(bbox.max.x, bbox.max.y, bbox.min.z);
        const c5 = new Vector3(bbox.max.x, bbox.max.y, bbox.max.z);

        const c6 = new Vector3(bbox.min.x, bbox.max.y, bbox.min.z);
        const c7 = new Vector3(bbox.min.x, bbox.max.y, bbox.max.z);

        return [c0, c1, c2, c3, c4, c5, c6, c7];
    }

    setElevationRange(range: ElevationRange) {
        this._range = range;
        this.localBox.min.setZ(range.min);
        this.localBox.max.setZ(range.max);
    }
}
