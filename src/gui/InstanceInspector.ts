/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import { Color } from 'three';

import type Instance from '../core/Instance';

import * as MemoryUsage from '../core/MemoryUsage';
import Panel from './Panel';
import RenderingInspector from './RenderingInspector';
import WebGLRendererInspector from './WebGLRendererInspector';

class InstanceInspector extends Panel {
    /** Store the CRS code of the instance */
    public instanceCrs: string;
    public state: string;
    public webGlRendererPanel: WebGLRendererInspector;
    public enginePanel: RenderingInspector;
    public clearColor: Color;
    public clearAlpha: number;
    public cpuMemoryUsage = 'unknown';
    public gpuMemoryUsage = 'unknown';

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     */
    public constructor(gui: GUI, instance: Instance) {
        super(gui, instance, 'Instance');

        this.instanceCrs = this.instance.coordinateSystem.id;
        this.clearAlpha = this.instance.renderer.getClearAlpha();
        this.addController(this, 'instanceCrs').name('CRS');

        this.addController(this, 'cpuMemoryUsage').name('Memory usage (CPU)');
        this.addController(this, 'gpuMemoryUsage').name('Memory usage (GPU)');
        this.addController(this.instance.mainLoop, 'frameCount').name('Frames');

        this.clearColor = this.instance.renderer.getClearColor(new Color()).convertLinearToSRGB();
        this.addColorController(this, 'clearColor')
            .name('Clear color')
            .onChange(() => {
                this.instance.engine.clearColor = this.clearColor.clone().convertSRGBToLinear();
                this.instance.engine.clearAlpha = this.clearAlpha;
                this.notify();
            });
        this.addController(this, 'clearAlpha')
            .name('Clear alpha')
            .min(0)
            .max(1)
            .onChange(() => {
                this.instance.engine.clearColor = this.clearColor.clone().convertSRGBToLinear();
                this.instance.engine.clearAlpha = this.clearAlpha;
                this.notify();
            });

        this.state = 'idle';
        this.addController(this, 'state').name('Status');
        this.addController(this, 'triggerUpdate').name('Trigger update');

        this.webGlRendererPanel = new WebGLRendererInspector(this.gui, instance);
        this.enginePanel = new RenderingInspector(this.gui, instance);
    }

    public triggerUpdate(): void {
        this.instance.notifyChange();
    }

    public override updateValues(): void {
        const memUsage = this.instance.getMemoryUsage();
        this.cpuMemoryUsage = MemoryUsage.format(memUsage.cpuMemory);
        this.gpuMemoryUsage = MemoryUsage.format(memUsage.gpuMemory);

        this.state = this.instance.loading
            ? `loading (${Math.round(this.instance.progress * 100)}%)`
            : 'idle';
    }

    public override update(): void {
        if (!this.isClosed()) {
            this.updateControllers();
            this.webGlRendererPanel.update();
            this.enginePanel.update();
        }
    }
}

export default InstanceInspector;
