/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';

import DrawToolPanel from './DrawToolPanel';
import Panel from './Panel';
import SunExposurePanel from './SunExposurePanel';
import ViewshedPanel from './ViewshedPanel';

class ToolInspector extends Panel {
    public sunExposurePanel: SunExposurePanel;
    public drawToolPanel: DrawToolPanel;
    public viewshedPanel: ViewshedPanel;

    /**
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     */
    public constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Tools');

        this.sunExposurePanel = new SunExposurePanel(this.gui, instance);
        this.drawToolPanel = new DrawToolPanel(this.gui, instance);
        this.viewshedPanel = new ViewshedPanel(this.gui, instance);
    }
}

export default ToolInspector;
