import type { Vector2 } from 'three';
import { FrontSide } from 'three';
import Ellipsoid from '../core/geographic/Ellipsoid';
import Extent from '../core/geographic/Extent';
import { computeEllipsoidalImageSize } from './Globe';
import type { MapConstructorOptions } from './Map';
import Map from './Map';
import PanoramaTileGeometry from './tiles/PanoramaTileGeometry';
import PanoramaTileVolume from './tiles/PanoramaTileVolume';
import type { TileGeometryBuilder } from './tiles/TileGeometry';
import type TileVolume from './tiles/TileVolume';

export interface SphericalPanoramaOptions extends Omit<MapConstructorOptions, 'extent'> {
    /**
     * The radius of the sphere, in scene units.
     * @defaultValue 5
     */
    radius?: number;
}

/**
 * A {@link Map} that displays images in a 360° panoramic bubble.
 */
export default class SphericalPanorama extends Map {
    readonly isSphericalPanorama = true as const;
    readonly type = 'SphericalPanorama' as const;

    private readonly _ellipsoid: Ellipsoid;
    private readonly _radius: number;

    constructor(params?: SphericalPanoramaOptions) {
        super({
            ...params,
            extent: new Extent('EPSG:4326', -180, +180, -90, +90),
            depthTest: false,
            terrain: {
                enabled: false,
                segments: 32, // To avoid visible seams between tiles
            },
            backgroundColor: params?.backgroundColor ?? '#000000',
        });

        this._radius = params?.radius ?? 5;
        this._ellipsoid = Ellipsoid.sphere(this._radius);
        this.side = params?.side ?? FrontSide;

        this.renderOrder = -9999;
    }

    protected override get isEllipsoidal(): boolean {
        return true;
    }

    protected override getComposerProjection(): string {
        return 'EPSG:4326';
    }

    protected override getTextureSize(extent: Extent): Vector2 {
        // Since panorama tiles are curved, their extent dimensions is not the same depending
        // on the location of the tile. We must compute a reasonable approximation of
        // the width and height of the extent in meters.
        return computeEllipsoidalImageSize(extent, this._ellipsoid);
    }

    protected getGeometryBuilder(): TileGeometryBuilder {
        return (extent, segments) => {
            return new PanoramaTileGeometry({
                extent,
                segments,
                radius: this._radius,
            });
        };
    }

    protected createTileVolume(extent: Extent): TileVolume {
        return new PanoramaTileVolume({ extent, radius: this._radius });
    }
}
