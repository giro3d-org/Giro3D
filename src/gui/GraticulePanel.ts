import type GUI from 'lil-gui';
import type GraticuleOptions from '../core/GraticuleOptions';
import type Instance from '../core/Instance';
import Panel from './Panel';

class GraticulePanel extends Panel {
    /**
     * @param graticule - The options.
     * @param parentGui - Parent GUI
     * @param instance - The instance
     */
    constructor(graticule: GraticuleOptions, parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Graticule');

        this.addController<boolean>(graticule, 'enabled')
            .name('Enable')
            .onChange(() => this.notify());
        this.addColorController(graticule, 'color')
            .name('Color')
            .onChange(() => this.notify());
        this.addController<number>(graticule, 'opacity', 0, 1)
            .name('Opacity')
            .onChange(() => this.notify());
        this.addController<number>(graticule, 'xStep')
            .name('X step')
            .onChange(() => this.notify());
        this.addController<number>(graticule, 'yStep')
            .name('Y step')
            .onChange(() => this.notify());
        this.addController<number>(graticule, 'xOffset')
            .name('X Offset')
            .onChange(() => this.notify());
        this.addController<number>(graticule, 'yOffset')
            .name('Y Offset')
            .onChange(() => this.notify());
        this.addController<number>(graticule, 'thickness')
            .name('Thickness')
            .onChange(() => this.notify());
    }
}

export default GraticulePanel;
