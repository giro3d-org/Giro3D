/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { AxesHelper, Matrix4, Raycaster, Vector2, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Inspector from '@giro3d/giro3d/gui/Inspector';
import EllipsoidHelper from '@giro3d/giro3d/helpers/EllipsoidHelper';

import { bindButton } from './widgets/bindButton';
import { bindNumberInput } from './widgets/bindNumberInput';
import { bindToggle } from './widgets/bindToggle';
import StatusBar from './widgets/StatusBar';

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg4978,
    backgroundColor: 'black',
});

const DEFAULT_PARAMS = {
    observer: new Coordinates(CoordinateSystem.epsg4326, 30, 40, 36_000_000),
    semiMajorAxis: Ellipsoid.WGS84.semiMajorAxis,
    semiMinorAxis: Ellipsoid.WGS84.semiMinorAxis,
    ellipsoid: Ellipsoid.WGS84,
    showEnuFrame: true,
    showLines: true,
    showLabels: true,
    showAxes: true,
    showNormals: false,
};

let params = { ...DEFAULT_PARAMS };

/** @type {EllipsoidHelper} */
let helper;

function createHelper() {
    if (helper) {
        helper.dispose();
        helper.removeFromParent();
    }

    const ellipsoid = new Ellipsoid({
        semiMajorAxis: params.semiMajorAxis,
        semiMinorAxis: params.semiMinorAxis,
    });

    params.ellipsoid = ellipsoid;

    helper = new EllipsoidHelper({ ellipsoid });

    instance.threeObjects.add(helper);

    helper.showAxes = params.showAxes;
    helper.showLabels = params.showLabels;
    helper.showLines = params.showLines;
    helper.showNormals = params.showNormals;

    instance.notifyChange();
}

const [setSemiMajorAxis] = bindNumberInput('semi-major-axis', val => {
    params.semiMajorAxis = val;

    createHelper();
});
const [setSemiMinorAxis] = bindNumberInput('semi-minor-axis', val => {
    params.semiMinorAxis = val;

    createHelper();
});
const [showLabels] = bindToggle('show-labels', show => {
    params.showLabels = show;
    helper.showLabels = show;
    instance.notifyChange();
});
const [showAxes] = bindToggle('show-axes', show => {
    helper.showAxes = show;
    params.showAxes = show;
    instance.notifyChange();
});
const [showLines] = bindToggle('show-lines', show => {
    params.showLines = show;
    helper.showLines = show;
    instance.notifyChange();
});
const [showNormals] = bindToggle('show-normals', show => {
    params.showNormals = show;
    helper.showNormals = show;
    instance.notifyChange();
});
const [showEnuFrame] = bindToggle('show-enu-frame', show => {
    params.showEnuFrame = show;
    instance.notifyChange();
});

createHelper();

const camera = instance.view.camera;

function updateCamera() {
    const { observer, ellipsoid } = params;

    const position = ellipsoid.toCartesian(
        observer.latitude,
        observer.longitude,
        observer.altitude,
    );

    camera.position.set(position.x, position.y, position.z);

    camera.lookAt(0, 0, 0);

    camera.updateMatrixWorld(true);

    instance.notifyChange(camera);
}

updateCamera();

function reset() {
    params = { ...DEFAULT_PARAMS };

    setSemiMajorAxis(params.semiMajorAxis);
    setSemiMinorAxis(params.semiMinorAxis);
    showLabels(params.showLabels);
    showLines(params.showLines);
    showAxes(params.showAxes);
    showNormals(params.showNormals);
    showEnuFrame(params.showEnuFrame);

    updateCamera();
    createHelper();
}

bindButton('reset', reset);

reset();

const controls = new OrbitControls(instance.view.camera, instance.domElement);
controls.target.set(0, 0, 0);
instance.view.setControls(controls);

const enuMatrix = new Matrix4();
const raycaster = new Raycaster();
const intersection = new Vector3();
const axes = new AxesHelper(params.ellipsoid.semiMajorAxis * 0.25);
instance.scene.add(axes);
axes.visible = false;

/**
 * @param {MouseEvent} event
 */
const onMouseMove = event => {
    if (!params.showEnuFrame) {
        if (axes.visible) {
            axes.visible = false;
            instance.notifyChange();
        }
        return;
    }

    const ndc = instance.eventToNormalizedCoords(event, new Vector2());
    raycaster.setFromCamera(ndc, instance.view.camera);
    const ray = raycaster.ray;

    const point = params.ellipsoid.intersectRay(ray, intersection);

    axes.visible = point != null;

    if (point) {
        axes.position.copy(point);

        const enu = params.ellipsoid.getEastNorthUpMatrixFromCartesian(point, enuMatrix);

        axes.setRotationFromMatrix(enu);

        axes.updateMatrixWorld(true);
    }

    instance.notifyChange();
};

instance.domElement.addEventListener('mousemove', onMouseMove);

Inspector.attach('inspector', instance);
StatusBar.bind(instance, { disableUrlUpdate: true });
