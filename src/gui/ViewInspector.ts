import type GUI from 'lil-gui';
import type { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import Panel from './Panel';
import type Instance from '../core/Instance';
import type View from '../renderer/View';

class CameraInspector extends Panel {
    view: View;
    camera: PerspectiveCamera | OrthographicCamera;

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     */
    constructor(gui: GUI, instance: Instance) {
        super(gui, instance, 'View');

        this.view = this.instance.view;
        this.camera = this.view.camera;

        const notify = this.notify.bind(this);

        this.addController<string>(this.camera, 'type').name('Type');
        this.addController<number>(instance.mainLoop, 'automaticCameraPlaneComputation')
            .name('Automatic plane computation')
            .onChange(notify);
        this.addController<number>(this.camera, 'far').name('Far plane').onChange(notify);
        this.addController<number>(this.camera, 'near').name('Near plane').onChange(notify);
        this.addController<number>(this.view, 'maxFarPlane').name('Max far plane').onChange(notify);
        this.addController<number>(this.view, 'minNearPlane')
            .name('Min near plane')
            .onChange(notify);
        this.addController<number>(this.view, 'width').name('Width (pixels)');
        this.addController<number>(this.view, 'height').name('Height (pixels)');

        const position = this.gui.addFolder('Position');
        position.close();
        this._controllers.push(position.add(this.camera.position, 'x'));
        this._controllers.push(position.add(this.camera.position, 'y'));
        this._controllers.push(position.add(this.camera.position, 'z'));

        if (this.instance.controls && 'target' in this.instance.controls) {
            const target = this.gui.addFolder('Target');
            target.close();
            const targetObj = this.instance.controls.target as Vector3;
            this._controllers.push(target.add(targetObj, 'x'));
            this._controllers.push(target.add(targetObj, 'y'));
            this._controllers.push(target.add(targetObj, 'z'));
        }
    }
}

export default CameraInspector;
