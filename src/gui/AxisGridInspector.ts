import type GUI from 'lil-gui';
import type { ColorRepresentation } from 'three';
import type Instance from '../core/Instance';
import type AxisGrid from '../entities/AxisGrid';
import { TickOrigin } from '../entities/AxisGrid';
import EntityInspector from './EntityInspector';

class AxisGridInspector extends EntityInspector<AxisGrid> {
    absoluteTicks: boolean;

    /**
     * Creates an instance of AxisGridInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param grid - The inspected Map.
     */
    constructor(parentGui: GUI, instance: Instance, grid: AxisGrid) {
        super(parentGui, instance, grid, {
            visibility: true,
            opacity: true,
        });

        this.absoluteTicks = this.entity.origin === TickOrigin.Absolute;

        this.addColorController(this.entity, 'color')
            .name('Grid color')
            .onChange(v => this.updateGridColor(v));
        this.addController(this.entity.style, 'fontSize', 1, 20, 1)
            .name('Font size')
            .onChange(() => this._rebuild());
        this.addController(this.entity, 'showHelpers')
            .name('Show debug helpers')
            .onChange(() => this.notify(this.entity));
        this.addController(this.entity, 'showLabels')
            .name('Show labels')
            .onChange(() => this.notify(this.entity));
        this.addController(this, 'absoluteTicks')
            .name('Absolute ticks')
            .onChange(v => this.updateTickOrigin(v));
        this.addController(this.entity, 'showFloorGrid')
            .name('Show floor grid')
            .onChange(() => this.notify(this.entity));
        this.addController(this.entity, 'showCeilingGrid')
            .name('Show ceiling grid')
            .onChange(() => this.notify(this.entity));
        this.addController(this.entity, 'showSideGrids')
            .name('Show side grids')
            .onChange(() => this.notify(this.entity));

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

    _rebuild() {
        this.entity.refresh();
        this.notify(this.entity);
    }

    updateTickOrigin(v: boolean) {
        this.entity.origin = v ? TickOrigin.Absolute : TickOrigin.Relative;
        this.entity.refresh();
        this.notify(this.entity);
    }

    updateGridColor(v: ColorRepresentation) {
        this.entity.color = v;
        this.notify(this.entity);
    }
}

export default AxisGridInspector;
