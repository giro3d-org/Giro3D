/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import CameraControls from 'camera-controls';
import {
    Box3,
    Clock,
    CubeTextureLoader,
    Matrix4,
    Quaternion,
    Raycaster,
    Sphere,
    Spherical,
    Vector2,
    Vector3,
    Vector4,
} from 'three';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Panel from '@giro3d/giro3d/gui/Panel.js';
import { MODE } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import StatusBar from './widgets/StatusBar.js';

CameraControls.install({
    THREE: {
        Vector2,
        Vector3,
        Vector4,
        Quaternion,
        Matrix4,
        Spherical,
        Box3,
        Sphere,
        Raycaster,
    },
});

const crs = CoordinateSystem.register(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 ' +
        '+y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const instance = new Instance({
    target: 'view',
    crs,
});

const pointcloud = new Tiles3D({
    url: 'https://3d.oslandia.com/3dtiles/lyon.3dtiles/tileset.json',
    pointCloudMode: MODE.TEXTURE,
    errorTarget: 15,
});

instance.add(pointcloud).then(pc => {
    const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

    // Let's build the color layer from the WMTS capabilities
    WmtsSource.fromCapabilities(url, {
        layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
    })
        .then(orthophotoWmts => {
            pc.setColorLayer(
                new ColorLayer({
                    name: 'color',
                    source: orthophotoWmts,
                }),
            );
        })
        .catch(console.error);
});

// Configure our controls
const controls = new CameraControls(instance.view.camera, instance.domElement);

controls.dollyToCursor = true;
controls.verticalDragToForward = true;

controls.mouseButtons.left = CameraControls.ACTION.TRUCK;
controls.mouseButtons.right = CameraControls.ACTION.ROTATE;
controls.mouseButtons.wheel = CameraControls.ACTION.DOLLY;
controls.mouseButtons.middle = CameraControls.ACTION.DOLLY;

const clock = new Clock();

// Update controls from event loop - this replaces the requestAnimationFrame logic from
// camera-controls sample code
instance.addEventListener('before-camera-update', () => {
    // Called from Giro3D
    const delta = clock.getDelta();
    const hasControlsUpdated = controls.update(delta);
    if (hasControlsUpdated) {
        instance.notifyChange(instance.view.camera);
    }
});
// As Giro3D runs the event loop only when needed, we need to notify Giro3D when
// the controls update the view.
// We need both events to make sure the view is updated from user interactions and from animations
controls.addEventListener('update', () => instance.notifyChange(instance.view.camera));
controls.addEventListener('control', () => instance.notifyChange(instance.view.camera));

// place camera
controls.setLookAt(1842456, 5174330, 735, 1841993, 5175493, 188);

// And now we can add some custom behavior

const executeInteraction = callback => {
    // Execute the interaction
    const res = callback() ?? Promise.resolve();

    // As mainloop can pause, before-camera-update can be triggered irregularly
    // Make sure to "reset" the clock to enable smooth transitions with camera-controls
    clock.getDelta();
    // Dispatch events so Giro3D gets notified
    controls.dispatchEvent({ type: 'update' });
    return res;
};

// Add some controls on keyboard
const keys = {
    LEFT: 'ArrowLeft',
    UP: 'ArrowUp',
    RIGHT: 'ArrowRight',
    BOTTOM: 'ArrowDown',
};
instance.domElement.addEventListener('keydown', e => {
    let forwardDirection = 0;
    let truckDirectionX = 0;
    const factor = e.ctrlKey || e.metaKey || e.shiftKey ? 200 : 20;
    switch (e.code) {
        case keys.UP:
            forwardDirection = 1;
            break;

        case keys.BOTTOM:
            forwardDirection = -1;
            break;

        case keys.LEFT:
            truckDirectionX = -1;
            break;

        case keys.RIGHT:
            truckDirectionX = 1;
            break;

        default:
        // do nothing
    }
    if (forwardDirection) {
        executeInteraction(() =>
            controls.forward(forwardDirection * controls.truckSpeed * factor, true),
        );
    }
    if (truckDirectionX) {
        executeInteraction(() =>
            controls.truck(truckDirectionX * controls.truckSpeed * factor, 0, true),
        );
    }
});

// Make rotation around where the user clicked
instance.domElement.addEventListener('contextmenu', e => {
    const picked = instance.pickObjectsAt(e, {
        limit: 1,
        radius: 20,
        filter: p =>
            // Make sure we pick a valid point
            Number.isFinite(p.point.x) && Number.isFinite(p.point.y) && Number.isFinite(p.point.z),
    })[0];

    if (picked) {
        controls.setOrbitPoint(picked.point.x, picked.point.y, picked.point.z);
    }
});

// add a skybox background
const cubeTextureLoader = new CubeTextureLoader();
cubeTextureLoader.setPath('image/skyboxsun25deg_zup/');
const cubeTexture = cubeTextureLoader.load([
    'px.jpg',
    'nx.jpg',
    'py.jpg',
    'ny.jpg',
    'pz.jpg',
    'nz.jpg',
]);

instance.scene.background = cubeTexture;

const inspector = Inspector.attach('inspector', instance);

class ControlsInspector extends Panel {
    constructor(gui, _instance, _controls) {
        super(gui, _instance, 'Controls');

        this.controls = _controls;
        this.target = new Vector3();
        this.controls.getTarget(this.target);

        this.addController(this.controls, 'enabled').name('Enabled');
        this.addController(this.controls, 'active').name('Active');

        const target = this.gui.addFolder('Target');
        target.close();
        this._controllers.push(target.add(this.target, 'x'));
        this._controllers.push(target.add(this.target, 'y'));
        this._controllers.push(target.add(this.target, 'z'));

        this._eventhandlers = {
            control: () => this.controls.getTarget(this.target),
        };

        this.addController(this.controls, 'distance').name('Distance');
        this.addController(this.controls, 'polarAngle').name('Polar angle');
        this.addController(this.controls, 'azimuthAngle').name('Azimuth angle');

        this.needsUpdate = false;

        this.controls.addEventListener('update', this._eventhandlers.control);
    }

    /**
     * @override
     */
    dispose() {
        this.controls.removeEventListener('update', this._eventhandlers.control);
        super.dispose();
    }
}

const controlsInspector = new ControlsInspector(inspector.gui, instance, controls);
inspector.addPanel(controlsInspector);

// Add some animations
document.getElementById('animate').onclick = () => {
    executeInteraction(async () => {
        await controls.rotate((Math.random() - 0.5) * (Math.PI / 2), 0, true);
        await controls.rotatePolarTo(Math.PI / 8, true);
        await controls.dolly((Math.random() - 0.5) * 1000, true);
    });
};

StatusBar.bind(instance);
