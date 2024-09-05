import type GUI from 'lil-gui';
import type HillshadingOptions from '../core/HillshadingOptions';
import type Instance from '../core/Instance';
import Panel from './Panel';

class HillshadingPanel extends Panel {
    /**
     * @param hillshading - The options.
     * @param parentGui - Parent GUI
     * @param instance - The instance
     */
    constructor(hillshading: HillshadingOptions, parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Hillshading');

        this.addController(hillshading, 'enabled')
            .name('Enable')
            .onChange(() => this.notify());
        this.addController(hillshading, 'intensity', 0, 10)
            .name('Intensity')
            .onChange(() => this.notify());
        this.addController(hillshading, 'zFactor', 0, 10)
            .name('Z-factor')
            .onChange(() => this.notify());
        this.addController(hillshading, 'zenith', 0, 90)
            .name('Sun zenith')
            .onChange(() => this.notify());
        this.addController(hillshading, 'azimuth', 0, 360)
            .name('Sun azimuth')
            .onChange(() => this.notify());
        this.addController(hillshading, 'elevationLayersOnly')
            .name('Elevation layers only')
            .onChange(() => this.notify());
    }
}

export default HillshadingPanel;
