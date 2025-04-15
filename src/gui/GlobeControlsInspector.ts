import type GUI from 'lil-gui';
import type { Controller } from 'lil-gui';
import type GlobeControls from '../controls/GlobeControls';
import type Instance from '../core/Instance';
import Panel from './Panel';

class GlobeControlsInspector extends Panel {
    private readonly _dampingControllers: Controller[] = [];

    readonly controls: GlobeControls;

    /**
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     */
    constructor(parentGui: GUI, instance: Instance, controls: GlobeControls) {
        super(parentGui, instance, 'Globe controls');

        this.controls = controls;

        const notify = this.notify.bind(this);

        this.addController(this.controls, 'enabled').name('Enabled');

        this.addController(this.controls, 'zoomSpeed')
            .name('Zoom speed')
            .min(0.1)
            .max(4)
            .onChange(notify);

        this.addController(this.controls, 'enableDamping')
            .name('Damping')
            .onChange(() => {
                this.updateControllerVisibility();
            });

        this._dampingControllers.push(
            this.addController(this.controls, 'dampingFactor')
                .name('Damping factor')
                .min(0.001)
                .max(1)
                .onChange(notify),
        );

        this.addController(this, 'attach');
        this.addController(this, 'detach');

        this.updateControllerVisibility();
    }

    private updateControllerVisibility() {
        this._dampingControllers.forEach(c => c.show(this.controls.enableDamping));
    }

    attach() {
        this.controls.attach();
    }

    detach() {
        this.controls.detach();
    }
}

export default GlobeControlsInspector;
