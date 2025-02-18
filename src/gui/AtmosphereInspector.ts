import type GUI from 'lil-gui';
import type Instance from '../core/Instance';
import type Atmosphere from '../entities/Atmosphere';
import EntityInspector from './EntityInspector';

export default class AtmosphereInspector extends EntityInspector<Atmosphere> {
    constructor(parentGui: GUI, instance: Instance, atmosphere: Atmosphere) {
        super(parentGui, instance, atmosphere, {
            boundingBoxColor: false,
            boundingBoxes: false,
            opacity: true,
            visibility: true,
        });

        const notify = () => this.notify();

        this.addController(atmosphere.inner, 'visible').name('Inner').onChange(notify);
        this.addController(atmosphere.outer, 'visible').name('Outer').onChange(notify);

        this.addController(atmosphere, 'redWavelength').min(0).max(1);
        this.addController(atmosphere, 'greenWavelength').min(0).max(1);
        this.addController(atmosphere, 'blueWavelength').min(0).max(1);
    }
}
