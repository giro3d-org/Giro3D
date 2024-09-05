import type GUI from 'lil-gui';
import type Instance from '../core/Instance';
import Panel from './Panel';

class RenderingInspector extends Panel {
    /**
     * @param parentGui - The parent GUI.
     * @param instance - The instance.
     */
    constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Visual parameters');

        this.addController(instance.renderingOptions, 'enableMSAA')
            .name('MSAA')
            .onChange(() => this.notify());
        this.addController(instance.renderingOptions, 'enableEDL')
            .name('EDL')
            .onChange(() => this.notify());
        this.addController(instance.renderingOptions, 'EDLRadius', 0, 2)
            .name('EDL Radius')
            .onChange(() => this.notify());
        this.addController(instance.renderingOptions, 'EDLStrength', 0, 2)
            .name('EDL Strength')
            .onChange(() => this.notify());
        this.addController(instance.renderingOptions, 'enableInpainting')
            .name('Inpainting')
            .onChange(() => this.notify());
        this.addController(instance.renderingOptions, 'inpaintingSteps', 1, 6)
            .name('Inpainting steps')
            .onChange(() => this.notify());
        this.addController(instance.renderingOptions, 'inpaintingDepthContribution', 0.01, 1)
            .name('Inpainting depth contrib.')
            .onChange(() => this.notify());
        this.addController(instance.renderingOptions, 'enablePointCloudOcclusion')
            .name('Point cloud occlusion')
            .onChange(() => this.notify());
    }
}

export default RenderingInspector;
