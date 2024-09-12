import type GUI from 'lil-gui';
import { VERSION as olversion } from 'ol/util.js';
import type Instance from '../core/Instance';
import VERSION from '../version';
import Panel from './Panel';

class PackageInfoInspector extends Panel {
    olversion: string;
    giro3dVersion: string;

    /**
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     */
    constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Info');

        this.olversion = olversion;
        this.giro3dVersion = VERSION;

        this.addController(this, 'giro3dVersion').name('Giro3D version');
        // @ts-expect-error property not present on window
        this.addController(window, '__THREE__').name('THREE.js version');
        this.addController(this, 'olversion').name('OpenLayers version');
    }
}

export default PackageInfoInspector;
