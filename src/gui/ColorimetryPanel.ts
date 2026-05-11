/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import { Color } from 'three';

import type ColorimetryOptions from '../core/ColorimetryOptions';
import type Instance from '../core/Instance';

import Panel from './Panel';

class ColorimetryPanel extends Panel {
    private readonly _options: ColorimetryOptions;

    /**
     * @param options - The options.
     * @param parentGui - Parent GUI
     * @param instance - The instance
     */
    public constructor(options: ColorimetryOptions, parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Colorimetry');

        this._options = options;

        this.addController(this, 'reset')
            .name('Reset to defaults')
            .min(-1)
            .max(1)
            .onChange(() => this.notify());
        this.addController(options, 'brightness')
            .name('Brightness')
            .min(-1)
            .max(1)
            .onChange(() => this.notify());
        this.addController(options, 'contrast')
            .name('Contrast')
            .min(0)
            .max(10)
            .onChange(() => this.notify());
        this.addController(options, 'saturation')
            .name('Saturation')
            .min(0)
            .max(1)
            .onChange(() => this.notify());
        this.addColorController(options, 'tint')
            .name('Tint')
            .onChange(() => this.notify());
    }

    public reset(): void {
        this._options.brightness = 0;
        this._options.saturation = 1;
        this._options.contrast = 1;
        this._options.tint = new Color(1, 1, 1);

        this.notify();

        this.updateControllers();
    }
}

export default ColorimetryPanel;
