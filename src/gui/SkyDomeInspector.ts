import type GUI from 'lil-gui';
import type Instance from '../core/Instance';
import type SkyDome from '../entities/SkyDome';
import EntityInspector from './EntityInspector';

export default class SkyDomeInspector extends EntityInspector<SkyDome> {
    constructor(parent: GUI, instance: Instance, dome: SkyDome) {
        super(parent, instance, dome, {
            boundingBoxColor: false,
            boundingBoxes: false,
            opacity: false,
            visibility: true,
        });

        this.addController(dome, 'luminance').min(0.1).max(1.2).step(0.01);
        this.addController(dome, 'turbidity').min(0.1).max(20).step(0.01);
        this.addController(dome, 'rayleighCoefficient').min(0.1).max(2).step(0.01);
        this.addController(dome, 'mieDirectionalG').min(0.5).max(1).step(0.01);
        this.addController(dome, 'mieCoefficient').min(0.0001).max(0.05).step(0.0001);
        this.addController(dome, 'solarDiscDiameter').min(0.001).max(40).step(0.001);
    }
}
