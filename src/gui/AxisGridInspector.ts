/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';
import type { ColorRepresentation } from 'three';

import type Instance from '../core/Instance';
import type AxisGrid from '../entities/AxisGrid';

import { TickOrigin } from '../entities/AxisGrid';
import EntityInspector from './EntityInspector';

class AxisGridInspector extends EntityInspector<AxisGrid> {
    public absoluteTicks: boolean;

    /**
     * Creates an instance of AxisGridInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param grid - The inspected Map.
     */
    public constructor(parentGui: GUI, instance: Instance, grid: AxisGrid) {
        super(parentGui, instance, grid, {
            visibility: true,
            opacity: true,
        });

        this.absoluteTicks = this.entity.origin === TickOrigin.Absolute;

        this.addColorController(this.entity, 'color').onChange(v => this.updateGridColor(v));
        this.addController(this.entity.style, 'fontSize', 1, 20, 1).onChange(() => this._rebuild());
        this.addController(this.entity, 'showHelpers').onChange(() => this.notify(this.entity));
        this.addController(this.entity, 'showLabels').onChange(() => this.notify(this.entity));
        this.addController(this.entity, 'adaptiveLabels');
        this.addController(this, 'absoluteTicks').onChange(v => this.updateTickOrigin(v));
        this.addController(this.entity, 'showFloorGrid').onChange(() => this.notify(this.entity));
        this.addController(this.entity, 'showCeilingGrid').onChange(() => this.notify(this.entity));
        this.addController(this.entity, 'showSideGrids').onChange(() => this.notify(this.entity));

        this.addController(this.entity.volume, 'floor')
            .name('Floor elevation')
            .onChange(() => this._rebuild());
        this.addController(this.entity.volume, 'ceiling')
            .name('Ceiling elevation')
            .onChange(() => this._rebuild());
        this.addController(this.entity.ticks, 'x')
            .name('X ticks')
            .onChange(() => this._rebuild());
        this.addController(this.entity.ticks, 'y')
            .name('Y ticks')
            .onChange(() => this._rebuild());
        this.addController(this.entity.ticks, 'z')
            .name('Z ticks')
            .onChange(() => this._rebuild());
    }

    private _rebuild(): void {
        this.entity.refresh();
        this.notify(this.entity);
    }

    public updateTickOrigin(v: boolean): void {
        this.entity.origin = v ? TickOrigin.Absolute : TickOrigin.Relative;
        this.entity.refresh();
        this.notify(this.entity);
    }

    public updateGridColor(v: ColorRepresentation): void {
        this.entity.color = v;
        this.notify(this.entity);
    }
}

export default AxisGridInspector;
