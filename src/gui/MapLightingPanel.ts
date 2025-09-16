/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';
import type MapLightingOptions from '../entities/MapLightingOptions';

import Panel from './Panel';

type ShadingMode = 'Hillshade' | 'LightBased';

const modes: ShadingMode[] = ['Hillshade', 'LightBased'];

class MapLightingPanel extends Panel {
    public mode: ShadingMode = 'Hillshade';

    /**
     * @param options - The options.
     * @param parentGui - Parent GUI
     * @param instance - The instance
     */
    public constructor(options: Required<MapLightingOptions>, parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Lighting');

        this.mode = modes[options.mode];

        this.addController(options, 'enabled')
            .name('Enabled')
            .onChange(() => this.notify());
        this.addController(this, 'mode', modes)
            .name('Mode')
            .onChange(() => {
                options.mode = modes.indexOf(this.mode);
                this.notify();
            });
        this.addController(options, 'hillshadeIntensity', 0, 10).onChange(() => this.notify());
        this.addController(options, 'zFactor', 0, 10).onChange(() => this.notify());
        this.addController(options, 'hillshadeZenith', 0, 90).onChange(() => this.notify());
        this.addController(options, 'hillshadeAzimuth', 0, 360).onChange(() => this.notify());
        this.addController(options, 'elevationLayersOnly').onChange(() => this.notify());
    }
}

export default MapLightingPanel;
