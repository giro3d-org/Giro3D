import { Vector2 } from 'three';
import type Extent from '../../core/geographic/Extent';
import PanoramaTileGeometry from './PanoramaTileGeometry';
import type TileCoordinate from './TileCoordinate';
import type { TileGeometryBuilder } from './TileGeometry';

export default class PanoramaTileGeometryBuilder
    implements TileGeometryBuilder<PanoramaTileGeometry>
{
    constructor(
        private readonly _radius: number,
        private readonly _segments: number,
    ) {}

    get rootTileMatrix(): Vector2 {
        // Equirectangular projection with 2 tiles on the Y axis
        // and 4 on the X axis, so that tiles are perfect squares.
        return new Vector2(4, 2);
    }

    build(params: { tile: TileCoordinate; extent: Extent }): PanoramaTileGeometry {
        return new PanoramaTileGeometry({
            extent: params.extent,
            radius: this._radius,
            segments: this._segments,
        });
    }
}
