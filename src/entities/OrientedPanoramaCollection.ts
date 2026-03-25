/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MathUtils, Matrix4, SphereGeometry } from 'three';

import type { EntityUserData } from './Entity';

import ImageCollectionBase, {
    type ImageCollectionBaseOptions,
    type ImageCollectionBasePickResult,
    type ImageCollectionBaseSource,
    type ImageSource,
} from './ImageCollectionBase';

export type OrientedPanoramaSource = ImageSource;

export type OrientedPanoramaCollectionSource = ImageCollectionBaseSource<OrientedPanoramaSource>;

/**
 * Constructor options for the OrientedPanoramaCollection entity.
 */
export type OrientedPanoramaCollectionOptions = ImageCollectionBaseOptions<OrientedPanoramaSource>;

export type OrientedPanoramaCollectionPickResult = ImageCollectionBasePickResult;

/**
 * Displays a collection of oriented panoramas coming from a {@link OrientedPanoramaCollectionSource} in the 3D space.
 * The panoramas are expected to be in the 'equirectangular' projection.
 *
 * Each oriented panorama is displayed as 3 distinct elements:
 * - a sphere positioned at the location of the camera receptor
 * - a wireframe to show the camera receptor (orientation, field of view and aspect ratio)
 * - a texture sphere on which the image is projected
 *
 * Each of these 3 elements can be made visible or invisible independently.
 *
 * If the collection contains images that are too spread out geographically, visual issues may occur.
 * This is why we advise to group images that are relatively close together.
 */
export default class OrientedPanoramaCollection<
    TUserData extends EntityUserData = EntityUserData,
> extends ImageCollectionBase<OrientedPanoramaSource, TUserData> {
    /** Readonly flag to indicate that this object is a OrientedPanoramaCollection instance. */
    public readonly isOrientedPanoramaCollection = true as const;
    public override readonly type = 'OrientedPanoramaCollection' as const;

    public constructor(options: OrientedPanoramaCollectionOptions) {
        const geometry = new SphereGeometry(1, 12, 8)
            .rotateZ(MathUtils.degToRad(90))
            .applyMatrix4(new Matrix4().makeScale(1, 1, -1))
            .rotateY(MathUtils.degToRad(90));

        const imageGeometry = geometry;
        const wireframeGeometry = geometry;
        super(imageGeometry, wireframeGeometry, options);
    }

    protected override computeWireframeScaleMatrix(source: OrientedPanoramaSource): Matrix4 {
        return new Matrix4().makeScale(source.distance, source.distance, source.distance);
    }
}
