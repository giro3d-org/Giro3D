/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Euler, Matrix4, Vector2 } from 'three';

import { FrontSide, MathUtils, Quaternion, Vector3 } from 'three';

import type HasDefaultPointOfView from '../core/HasDefaultPointOfView';
import type { HeadingPitchRollLike } from '../core/HeadingPitchRoll';
import type Layer from '../core/layer/Layer';
import type PointOfView from '../core/PointOfView';
import type { MapOptions } from './Map';
import type { TileGeometryBuilder } from './tiles/TileGeometry';
import type TileVolume from './tiles/TileVolume';

import CoordinateSystem from '../core/geographic/CoordinateSystem';
import Ellipsoid from '../core/geographic/Ellipsoid';
import Extent from '../core/geographic/Extent';
import { isColorLayer } from '../core/layer/ColorLayer';
import { isEuler, isMatrix4, isPerspectiveCamera, isQuaternion } from '../utils/predicates';
import { computeEllipsoidalImageSize } from './Globe';
import Map from './Map';
import PanoramaTileGeometryBuilder from './tiles/PanoramaTileGeometryBuilder';
import PanoramaTileVolume from './tiles/PanoramaTileVolume';

const FORWARD = new Vector3(0, 1, 0);
const ORIGIN = new Vector3(0, 0, 0);
const IDENTITY_QUATERNION = new Quaternion().identity();
const tmpQuaternion = new Quaternion();
const tmpVector3 = new Vector3();

/**
 * Sets the default orientation of the sphere.
 *
 * @param orientation - The default orientation.
 */
function getQuaternion(orientation?: Matrix4 | Euler | Quaternion): Quaternion {
    if (orientation == null) {
        return IDENTITY_QUATERNION;
    }

    if (isMatrix4(orientation)) {
        return tmpQuaternion.setFromRotationMatrix(orientation);
    } else if (isEuler(orientation)) {
        return tmpQuaternion.setFromEuler(orientation, true);
    } else if (isQuaternion(orientation)) {
        return tmpQuaternion.copy(orientation);
    }

    throw new Error('not a valid orientation parameter');
}

/**
 * Constructor options for the {@link SphericalPanorama} entity.
 */
export interface SphericalPanoramaOptions extends Omit<MapOptions, 'extent'> {
    /**
     * The radius of the sphere, in scene units.
     * @defaultValue 5
     */
    radius?: number;
}

/**
 * An entity that can display spherical panoramas in an equirectangular projection.
 *
 * ## The equirectangular projection
 *
 * The panoramic image is mapped into a sphere using in the [equirectangular projection](https://en.wikipedia.org/wiki/Equirectangular_projection).
 *
 * The units are the degrees. This is the same projection that is used for the EPSG:4326 coordinate system.
 *
 * In this projection:
 * - the center of the image is at [0, 0]
 * - the top left corner is at [-180, +90],
 * - the top right corner is at [+180, +90],
 * - the bottom right corner is at [+180, -90],
 * - the bottom left corner is at [-180, -90],
 *
 * ### The `'equirectangular'` coordinate system
 *
 * This special coordinate system is used for layers that are added to this entity. It is technically equivalent
 * to the EPSG:4326 system, but since the images projected into the sphere are not georeferenced in an actual
 * cartographic coordinate system, we use this special CRS.
 *
 * All image sources must express extents in this coordinate system.
 *
 * ## How to load panoramic images
 *
 * This entity is a subclass of {@link Map}. To load a panoramic images, you must add it as a {@link core.layer.ColorLayer | ColorLayer} with {@link addLayer}.
 *
 * - For simple images, such as JPG, PNG and WebP, use a {@link sources.StaticImageSource | StaticImageSource}.
 * Note that the image dimensions **cannot exceed WebGL's `MAX_TEXTURE_SIZE`** (4096 pixels),
 * and that the extent of this source must be expressed in the `'equirectangular'`CRS (see note below).
 *
 * - For images that exceed WebGL's `MAX_TEXTURE_SIZE`, you can convert them to
 * GeoTIFF / COG with [GDAL](https://gdal.org/en/stable/programs/gdal_translate.html),
 * in the EPSG:4326 coordinate system and appropriate georeferencing parameters (i.e if the image
 * uses the entire equirectangular projection, its extent would be -180, -90, +180, +90),
 * then load it through a {@link sources.GeoTIFFSource | GeoTIFFSource}.
 * It will be streamed efficiently to save memory and HTTP bandwidth. Again, the CRS of this source must
 * be `'equirectangular'`.
 *
 * - You can also load arbitrary vector features in the `'equirectangular'` coordinate system
 * using a {@link sources.VectorSource | VectorSource}, and they will be positioned accordingly
 * on the surface of the sphere. This can be used for example to digitize geometries from features
 * visible in the panoramic image. If the features are already expressed in the equirectangular projection,
 * no need to mention it in the constructor of the source.
 *
 * ## Orientation of the panorama
 *
 * Panoramic images generally have an orientation expressed in _heading_, _pitch_ and _roll_ (typically in degrees).
 *
 * Use the {@link setOrientation} method to set the orientation of the image for a given coordinate system.
 *
 * ```js
 * panorama.setOrientation({ heading: 56, pitch: -3, roll: 1 });
 * ```
 *
 * In planar coordinate systems, the rotation angles are applied to the local XYZ axes of the entity.
 *
 * In the EPSG:4978 coordinate system, the sphere is first rotated to match the local reference [East, North, Up (ENU) reference frame](https://en.wikipedia.org/wiki/Local_tangent_plane_coordinates)
 * at the coordinate of the center of the sphere, then the angles are applied.
 */
export default class SphericalPanorama extends Map {
    public readonly isSphericalPanorama = true as const;
    public override readonly type = 'SphericalPanorama' as const;

    private readonly _sphere: Ellipsoid;
    private readonly _radius: number;

    public constructor(params?: SphericalPanoramaOptions) {
        super({
            ...params,
            extent: Extent.fullEquirectangularProjection,
            depthTest: params?.depthTest ?? false,
            terrain: {
                enabled: false,
                segments: 32, // To avoid visible seams between tiles
            },
            backgroundColor: params?.backgroundColor ?? '#000000',
        });

        this._radius = params?.radius ?? 5;
        this._sphere = Ellipsoid.sphere(this._radius);
        this.side = params?.side ?? FrontSide;
    }

    protected override getGeometryBuilder(): TileGeometryBuilder {
        return new PanoramaTileGeometryBuilder(this._radius, this.segments);
    }

    protected override get isEllipsoidal(): boolean {
        return true;
    }

    protected override getComposerProjection(): CoordinateSystem {
        return CoordinateSystem.equirectangular;
    }

    protected override getTextureSize(extent: Extent): Vector2 {
        // Since panorama tiles are curved, their extent dimensions is not the same depending
        // on the location of the tile. We must compute a reasonable approximation of
        // the width and height of the extent in meters.
        return computeEllipsoidalImageSize(extent, this._sphere);
    }

    protected override createTileVolume(extent: Extent): TileVolume {
        return new PanoramaTileVolume({ extent, radius: this._radius });
    }

    public override addLayer<TLayer extends Layer>(layer: TLayer): Promise<TLayer> {
        if (isColorLayer(layer)) {
            return super.addLayer(layer);
        }

        throw new Error('Only color layers are supported by this entity');
    }

    /**
     * Returns a point of view that is located at the center of the sphere, and looking at the center of the image.
     *
     * Note: only perspective cameras are supported. Any other camera type will return `null`.
     */
    public override getDefaultPointOfView(
        params: Parameters<HasDefaultPointOfView['getDefaultPointOfView']>[0],
    ): ReturnType<HasDefaultPointOfView['getDefaultPointOfView']> {
        if (isPerspectiveCamera(params.camera)) {
            const origin = ORIGIN.clone();
            const target = origin.clone().add(FORWARD);

            this.object3d.updateMatrixWorld(true);

            origin.applyMatrix4(this.object3d.matrixWorld);
            target.applyMatrix4(this.object3d.matrixWorld);

            const result: PointOfView = { origin, target, orthographicZoom: 1 };

            return Object.freeze(result);
        }

        return null;
    }

    /**
     * Sets the orientation of the sphere.
     *
     * Note: this overrides the current orientation of the root object.
     *
     * @param params - The parameters. If undefined, the orientation is reset to the default orientation.
     */
    public setOrientation(params?: HeadingPitchRollLike): void {
        let baseOrientation: Quaternion | Matrix4 = IDENTITY_QUATERNION;

        if (this.instance.coordinateSystem.isEpsg(4978)) {
            this.object3d.updateMatrixWorld(true);

            // Since we are in the WGS84 geocentric coordinate system,
            // we have to set the base orientation to match the local tangent coordinates (ENU)
            // https://en.wikipedia.org/wiki/Local_tangent_plane_coordinates,
            // so that the orientation set with .setOrientation() will start from the this value.
            // This is necessary because the heading/pitch/roll values are offsets from the local frame.
            baseOrientation = Ellipsoid.WGS84.getEastNorthUpMatrixFromCartesian(
                this.object3d.getWorldPosition(tmpVector3),
            );
        }

        // Reset to default orientation.
        this.object3d.quaternion.copy(getQuaternion(baseOrientation));

        // https://developers.google.com/streetview/spherical-metadata#euler_overview

        if (params) {
            const heading = params.heading ?? 0;
            const pitch = params.pitch ?? 0;
            const roll = params.roll ?? 0;

            this.object3d.rotateZ(MathUtils.degToRad(-heading)); // Note the negative sign
            this.object3d.rotateX(MathUtils.degToRad(pitch));
            this.object3d.rotateY(MathUtils.degToRad(roll));
        }

        this.object3d.updateMatrixWorld(true);
    }
}
