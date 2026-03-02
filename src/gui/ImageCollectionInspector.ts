/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';
import type ImageCollectionBase from '../entities/ImageCollectionBase';

import EntityInspector from './EntityInspector';

export default class ImageCollectionInspector extends EntityInspector<ImageCollectionBase> {
    public constructor(parentGui: GUI, instance: Instance, imageCollection: ImageCollectionBase) {
        super(parentGui, instance, imageCollection, {
            boundingBoxColor: false,
            boundingBoxes: false,
            opacity: true,
            visibility: true,
        });

        const notify = (): void => this.notify();

        const imagesCount = imageCollection.source.images.length;

        const params = {
            projectionDistance: imagesCount > 0 ? imageCollection.getImageProjectionDistance(0) : 0,
        };

        this.addController(imageCollection, 'showLocationSpheres')
            .name('Show location spheres')
            .onChange(notify);
        this.addController(imageCollection, 'showFrustums')
            .name('Show view frustums')
            .onChange(notify);
        this.addController(imageCollection, 'showImages').name('Show images').onChange(notify);
        this.addController(imageCollection, 'imageOpacity', 0, 1, 0.01)
            .name('Images opacity')
            .onChange(notify);
        this.addController(params, 'projectionDistance', 0, 1000, 1).onChange(() => {
            for (let i = 0; i < imagesCount; i++) {
                imageCollection.setImageProjectionDistance(i, params.projectionDistance);
            }
            notify();
        });
    }
}
