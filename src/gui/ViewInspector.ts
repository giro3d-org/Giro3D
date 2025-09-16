/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import {
    CameraHelper,
    Mesh,
    MeshBasicMaterial,
    SphereGeometry,
    type OrthographicCamera,
    type PerspectiveCamera,
    type Vector3,
} from 'three';

import type Instance from '../core/Instance';
import type View from '../renderer/View';

import Ellipsoid from '../core/geographic/Ellipsoid';
import { isOrthographicCamera, isPerspectiveCamera } from '../utils/predicates';
import Panel from './Panel';

class CameraInspector extends Panel {
    public view: View;
    public camera: PerspectiveCamera | OrthographicCamera;
    public snapshots: CameraHelper[] = [];
    public horizonDistance = 'N/A';

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     */
    public constructor(gui: GUI, instance: Instance) {
        super(gui, instance, 'View');

        this.view = this.instance.view;
        this.camera = this.view.camera;

        const notify = this.notify.bind(this);

        this.addController(this.camera, 'type').name('Type');
        if (isPerspectiveCamera(this.camera)) {
            this.addController(this.camera, 'fov').min(25).max(150).name('FOV');
        } else if (isOrthographicCamera(this.camera)) {
            this.addController(this.camera, 'zoom');
            this.addController(this.camera, 'left');
            this.addController(this.camera, 'right');
            this.addController(this.camera, 'top');
            this.addController(this.camera, 'bottom');
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

        if (instance.coordinateSystem.isEpsg(4978)) {
            this.addController(this, 'horizonDistance');
            instance.addEventListener('after-camera-update', () => {
                const distance = Ellipsoid.WGS84.getOpticalHorizon(instance.view.camera.position);

                this.horizonDistance =
                    distance != null
                        ? distance > 10000
                            ? (distance / 1000).toFixed(0) + ' km'
                            : distance.toFixed(0) + 'm'
                        : 'N/A';
            });
        }

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

    public deleteSnapshots(): void {
        this.snapshots.forEach(helper => {
            helper.dispose();
            this.instance.remove(helper);
        });
        this.snapshots.length = 0;
    }

    public createFrustumSnapshot(): void {
        const helper = new CameraHelper(this.instance.view.camera);
        this.instance.add(helper);
        helper.update();
        this.instance.notifyChange();

        if (
            this.instance.coordinateSystem.isEpsg(4978) &&
            isPerspectiveCamera(this.instance.view.camera)
        ) {
            const distance = Ellipsoid.WGS84.getOpticalHorizon(this.instance.view.camera.position);

            if (distance != null) {
                helper.add(
                    new Mesh(
                        new SphereGeometry(distance, 32, 16),
                        new MeshBasicMaterial({ wireframe: true, color: 'green' }),
                    ),
                );
            }
        }

        helper.updateMatrixWorld(true);
        this.snapshots.push(helper);
    }
}

export default CameraInspector;
