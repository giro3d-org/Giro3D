import type GUI from 'lil-gui';
import { CameraHelper, type OrthographicCamera, type PerspectiveCamera, type Vector3 } from 'three';
import type Instance from '../core/Instance';
import type View from '../renderer/View';
import { isPerspectiveCamera } from '../utils/predicates';
import Panel from './Panel';

class CameraInspector extends Panel {
    view: View;
    camera: PerspectiveCamera | OrthographicCamera;
    snapshots: CameraHelper[] = [];

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     */
    constructor(gui: GUI, instance: Instance) {
        super(gui, instance, 'View');

        this.view = this.instance.view;
        this.camera = this.view.camera;

        const notify = this.notify.bind(this);

        this.addController(this.camera, 'type').name('Type');
        if (isPerspectiveCamera(this.camera)) {
            this.addController(this.camera, 'fov').min(25).max(150).name('FOV');
        }
        this.addController(instance.mainLoop, 'automaticCameraPlaneComputation')
            .name('Automatic plane computation')
            .onChange(notify);
        this.addController(this.camera, 'far').name('Far plane').onChange(notify);
        this.addController(this.camera, 'near').name('Near plane').onChange(notify);
        this.addController(this.view, 'maxFarPlane').name('Max far plane').onChange(notify);
        this.addController(this.view, 'minNearPlane').name('Min near plane').onChange(notify);
        this.addController(this.view, 'width').name('Width (pixels)');
        this.addController(this.view, 'height').name('Height (pixels)');
        this.addController(this, 'createFrustumSnapshot').name('Create frustum snapshot');
        this.addController(this, 'deleteSnapshots').name('Delete frustum snapshots');

        const position = this.gui.addFolder('Position');
        position.close();
        this._controllers.push(position.add(this.camera.position, 'x'));
        this._controllers.push(position.add(this.camera.position, 'y'));
        this._controllers.push(position.add(this.camera.position, 'z'));

        if (this.view.controls && 'target' in this.view.controls) {
            const target = this.gui.addFolder('Target');
            target.close();
            const targetObj = this.view.controls.target as Vector3;
            this._controllers.push(target.add(targetObj, 'x'));
            this._controllers.push(target.add(targetObj, 'y'));
            this._controllers.push(target.add(targetObj, 'z'));
        }
    }

    deleteSnapshots() {
        this.snapshots.forEach(helper => {
            helper.dispose();
            this.instance.remove(helper);
        });
        this.snapshots.length = 0;
    }

    createFrustumSnapshot() {
        const helper = new CameraHelper(this.instance.view.camera);
        this.instance.add(helper);
        helper.update();
        this.instance.notifyChange();
        helper.updateMatrixWorld(true);
        this.snapshots.push(helper);
    }
}

export default CameraInspector;
