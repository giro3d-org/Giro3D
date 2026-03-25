/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { BufferGeometry, Float32BufferAttribute, MathUtils, Matrix4, PlaneGeometry } from 'three';

import type { EntityUserData } from './Entity';

import ImageCollectionBase, {
    type ImageCollectionBaseOptions,
    type ImageCollectionBasePickResult,
    type ImageCollectionBaseSource,
    type ImageSource,
} from './ImageCollectionBase';

export type OrientedImageSource = ImageSource & {
    /** Vertical field of view in degrees. */
    fov: number;
    aspectRatio: number;
};

export type OrientedImageCollectionSource = ImageCollectionBaseSource<OrientedImageSource>;

/**
 * Constructor options for the OrientedImageCollection entity.
 */
export type OrientedImageCollectionOptions = ImageCollectionBaseOptions<OrientedImageSource>;

export type OrientedImageCollectionPickResult = ImageCollectionBasePickResult;

/**
 * Displays a collection of oriented images coming from a {@link OrientedImageCollectionSource} in the 3D space.
 *
 * Each oriented image is displayed as 3 distinct elements:
 * - a sphere positioned at the location of the camera receptor
 * - a wireframe to show the camera receptor (orientation, field of view and aspect ratio)
 * - a texture plane on which the image is projected
 *
 * Each of these 3 elements can be made visible or invisible independently.
 *
 * If the collection contains images that are too spread out geographically, visual issues may occur.
 * This is why we advise to group images that are relatively close together.
 */
export class OrientedImageCollection<
    TUserData extends EntityUserData = EntityUserData,
> extends ImageCollectionBase<OrientedImageSource, TUserData> {
    /** Readonly flag to indicate that this object is a OrientedImageCollection instance. */
    public readonly isOrientedImageCollection = true as const;
    public override readonly type = 'OrientedImageCollection' as const;

    public constructor(options: OrientedImageCollectionOptions) {
        const imageGeometry = new PlaneGeometry()
            .applyMatrix4(new Matrix4().makeTranslation(0, 0, -1))
            .rotateX(MathUtils.degToRad(90));

        const wireframeGeometry = new BufferGeometry();
        wireframeGeometry.setAttribute(
            'position',
            new Float32BufferAttribute(
                [0, 0, 0, -0.5, -0.5, -1, +0.5, -0.5, -1, +0.5, +0.5, -1, -0.5, +0.5, -1],
                3,
            ),
        );
        wireframeGeometry.rotateX(MathUtils.degToRad(90));
        wireframeGeometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);

        super(imageGeometry, wireframeGeometry, options);
    }

    protected override computeWireframeScaleMatrix(source: OrientedImageSource): Matrix4 {
        const wireframeSizeY = 2 * Math.tan(MathUtils.degToRad(0.5 * source.fov));
        return new Matrix4().makeScale(
            source.distance * wireframeSizeY * source.aspectRatio,
            source.distance,
            source.distance * wireframeSizeY,
        );
    }
}

export default OrientedImageCollection;
