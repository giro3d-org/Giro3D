/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';
import type Glow from '../entities/Glow';

import EntityInspector from './EntityInspector';

export default class GlowInspector extends EntityInspector<Glow> {
    public sunLongitude = 0;
    public sunLatitude = 0;

    public constructor(parentGui: GUI, instance: Instance, glow: Glow) {
        super(parentGui, instance, glow, {
            boundingBoxColor: false,
            boundingBoxes: false,
            opacity: true,
            visibility: true,
        });

        this.addColorController(glow, 'color')
            .name('Color')
            .onChange(v => {
                glow.color = v;
                this.notify(glow);
            });
    }
}
