import type GUI from 'lil-gui';
import type { Controller } from 'lil-gui';
import type GlobeControls from '../controls/GlobeControls';
import type Instance from '../core/Instance';
import Panel from './Panel';

const altitudeFormatter = new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: 'meter',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
});

class GlobeControlsInspector extends Panel {
    private readonly _dampingControllers: Controller[] = [];

    readonly controls: GlobeControls;

    altitudeIncrement = '';

    /**
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     */
    constructor(parentGui: GUI, instance: Instance, controls: GlobeControls) {
        super(parentGui, instance, 'Globe controls');

        this.controls = controls;

        const notify = this.notify.bind(this);

        this.addController(this.controls, 'enabled').name('Enabled');

        this.addController(this.controls, 'showHelpers').name('Helpers');

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

        this._dampingControllers.push(
            // @ts-expect-error private property
            this.addController(this.controls._orbit.sphericalDelta, 'theta').name('𝚫 theta'),
        );
        this._dampingControllers.push(
            // @ts-expect-error private property
            this.addController(this.controls._orbit.sphericalDelta, 'phi').name('𝚫 phi'),
        );

        this.addController(this, 'altitudeIncrement').name('Altitude increment');

        this.updateControllerVisibility();
    }

    override updateValues(): void {
        this.altitudeIncrement = altitudeFormatter.format(this.controls.getAltitudeDelta());
    }

    private updateControllerVisibility() {
        this._dampingControllers.forEach(c => c.show(this.controls.enableDamping));
    }
}

export default GlobeControlsInspector;
