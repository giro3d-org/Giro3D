/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    Clock,
    Color,
    DirectionalLight,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    SphereGeometry,
    Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Atmosphere from '@giro3d/giro3d/entities/Atmosphere';
import SkyDome from '@giro3d/giro3d/entities/SkyDome';
import Inspector from '@giro3d/giro3d/gui/Inspector';
import EllipsoidHelper from '@giro3d/giro3d/helpers/EllipsoidHelper';
import DrawTool from '@giro3d/giro3d/interactions/DrawTool';

import { bindButton } from './widgets/bindButton';
import { bindColorPicker } from './widgets/bindColorPicker';
import { bindSlider } from './widgets/bindSlider';
import { bindToggle } from './widgets/bindToggle';
import StatusBar from './widgets/StatusBar';

const Z_UP = new Vector3(0, 0, 1);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg4978,
    backgroundColor: 'black',
});

const ellipsoid = Ellipsoid.WGS84;

const DEFAULT_PARAMS = {
    automaticSunRotation: true,
    fov: 30,
    redWavelength: 0.65,
    greenWavelength: 0.57,
    blueWavelength: 0.475,
    thickness: 300_000,
    globeColor: '#1e4485',
    showSunObject: true,
    sunPosition: new Vector3(0.2, 1, 0),
    inner: true,
    lookAtSun: false,
    outer: true,
    showSunMarker: false,
    showEllipsoidHelper: false,
    observer: new Coordinates(CoordinateSystem.epsg4326, 40, 25, 36_000_000),
    target: new Coordinates(CoordinateSystem.epsg4326, 0, 0, 0),
};

let params = { ...DEFAULT_PARAMS };

// For this example, we create a simple sphere Mesh. For a full-featured globe with map/GIS support, create a Globe object (see the "globe" example)
const globe = new Mesh(
    new SphereGeometry(ellipsoid.semiMajorAxis, 256, 128),
    new MeshStandardMaterial({
        color: params.globeColor,
        emissive: params.globeColor,
        emissiveIntensity: 0.1,
    }),
);

globe.name = 'Globe';

// Scale it to match the ellipsoid compression factor.
globe.scale.set(1, 1, ellipsoid.compressionFactor);
globe.updateMatrixWorld(true);

instance.threeObjects.add(globe);

/** @type {Atmosphere} */
let atmosphere;

// The skydome will be visible when the camera is near the ground.
const skyDome = new SkyDome();
instance.add(skyDome);

// Create simple orbit controls to move around globe.
// Those controls will be disabled when we are on the ground.
const controls = new OrbitControls(instance.view.camera, instance.domElement);
controls.target.set(0, 0, 0);
instance.view.setControls(controls);

function createAtmosphere() {
    if (atmosphere) {
        instance.remove(atmosphere);
    }

    atmosphere = new Atmosphere({ ellipsoid, thickness: params.thickness });

    instance.add(atmosphere);

    if (params.redWavelength) {
        atmosphere.redWavelength = params.redWavelength;
        atmosphere.greenWavelength = params.greenWavelength;
        atmosphere.blueWavelength = params.blueWavelength;
    }

    atmosphere.inner.visible = params.inner;
    atmosphere.outer.visible = params.outer;

    atmosphere.setSunPosition(params.sunPosition);
    skyDome.setSunPosition(params.sunPosition);

    instance.notifyChange(atmosphere);
}

createAtmosphere();

const camera = instance.view.camera;

function updateCamera() {
    const { observer, target } = params;

    const position = ellipsoid.toCartesian(
        observer.latitude,
        observer.longitude,
        observer.altitude,
    );
    camera.position.set(position.x, position.y, position.z);

    if (observer.altitude < 1_000_000) {
        const up = ellipsoid.getNormal(observer.latitude, observer.longitude);
        camera.up = up;
    } else {
        camera.up = Z_UP;
    }

    const lookAt = ellipsoid.toCartesian(target.latitude, target.longitude, target.altitude);
    camera.lookAt(lookAt);

    // @ts-expect-error typing
    camera.fov = params.fov;

    camera.updateMatrixWorld(true);
}

updateCamera();

const sun = new Mesh(
    new SphereGeometry(ellipsoid.semiMajorAxis * 0.02),
    new MeshBasicMaterial({ color: 'yellow' }),
);

const elt = document.createElement('span');
elt.style.width = '15px';
elt.style.height = '15px';
elt.style.backgroundColor = 'cyan';
elt.style.display = 'inline-block';
elt.style.borderRadius = '50%';
elt.style.borderWidth = '2px';
elt.style.borderStyle = 'solid';
elt.style.borderColor = 'black';
const sunCSSMarker = new CSS2DObject(elt);
sun.add(sunCSSMarker);

sun.name = 'Sun';

instance.add(sun);

// Let's create an ellipsoid helper to help us visualize the ellipsoid and its axes.
const helper = new EllipsoidHelper({ ellipsoid: ellipsoid.scale(1.01), segments: 64 });
instance.threeObjects.add(helper);
helper.visible = params.showEllipsoidHelper;

const sunlight = new DirectionalLight();
instance.add(sunlight);
instance.add(sunlight.target);

const apparentSunCourseRadius = ellipsoid.semiMajorAxis * 2;
const actualSunCourseRAdius = ellipsoid.semiMajorAxis * 200;

const clock = new Clock();
let time = 0;
const actualSunPosition = new Vector3(0, 0, 0);

const updateSunPosition = () => {
    requestAnimationFrame(updateSunPosition);

    if (!params.automaticSunRotation) {
        clock.stop();
        return;
    }

    if (!clock.running) {
        clock.start();
    }

    const speed = -1;

    time += clock.getDelta();
    const t = speed * time;

    const cosT = Math.cos(t);
    const sinT = Math.sin(t);

    const x = cosT * apparentSunCourseRadius;
    const y = sinT * apparentSunCourseRadius;

    actualSunPosition.setX(cosT * actualSunCourseRAdius);
    actualSunPosition.setY(sinT * actualSunCourseRAdius);

    sun.position.set(x, y, 0);

    sun.material.visible = params.showSunObject;

    sun.updateMatrixWorld(true);

    sunlight.position.copy(sun.position);
    sunlight.lookAt(globe.position);

    sunlight.updateMatrixWorld(true);

    if (atmosphere) {
        atmosphere.setSunPosition(sun.position);
    }

    skyDome.setSunPosition(sun.position);

    if (params.lookAtSun) {
        camera.lookAt(actualSunPosition);
    }

    instance.notifyChange();
};

updateSunPosition();

const [setRed] = bindSlider('red', v => {
    params.redWavelength = v;
    atmosphere.redWavelength = v;
    instance.notifyChange(atmosphere);
});
const [setGreen] = bindSlider('green', v => {
    params.greenWavelength = v;
    atmosphere.greenWavelength = v;
    instance.notifyChange(atmosphere);
});
const [setBlue] = bindSlider('blue', v => {
    params.blueWavelength = v;
    atmosphere.blueWavelength = v;
    instance.notifyChange(atmosphere);
});
const [setGlobeColor] = bindColorPicker('globe-color', c => {
    const color = new Color(c);
    params.globeColor = '#' + color.getHexString();
    globe.material.color = color;
    globe.material.emissive = color;

    instance.notifyChange();
});
const [setThickness] = bindSlider('thickness', thickness => {
    params.thickness = thickness;
    createAtmosphere();
});
const [showInner] = bindToggle('inner', show => {
    params.inner = show;
    atmosphere.inner.visible = show;
    instance.notifyChange();
});
const [showHelper] = bindToggle('show-ellipsoid', show => {
    params.showEllipsoidHelper = show;
    helper.showLabels = show;
    helper.visible = show;
    instance.notifyChange();
});
const [setLookAtSun] = bindToggle('look-at-sun', enable => {
    params.lookAtSun = enable;
    instance.notifyChange();
});
const [setAutomaticSunRotation] = bindToggle('automatic-sun-rotation', enabled => {
    params.automaticSunRotation = enabled;
});
const [showOuter] = bindToggle('outer', show => {
    params.outer = show;
    atmosphere.outer.visible = show;
    instance.notifyChange();
});
const [showMarker] = bindToggle('sun-marker', show => {
    params.showSunMarker = show;
    sunCSSMarker.visible = show;
    instance.notifyChange();
});

function goToGround(latitude, longitude) {
    params.fov = 120;

    helper.showLabels = false;

    controls.enabled = false;
    instance.view.setControls(null);

    const altitude = 100;

    params.observer = new Coordinates(CoordinateSystem.epsg4326, longitude, latitude, altitude);

    params.showSunObject = false;
    params.lookAtSun = false;

    params.target = new Coordinates(
        params.observer.crs,
        longitude + 0.01, // Look toward the east (the sunrise)
        latitude,
        altitude + 200, // And slightly above the horizon
    );

    setLookAtSun(params.lookAtSun);
    showInner(false);
    showOuter(false);

    updateCamera();
}

bindButton('set-ground-position', () => {
    const drawTool = new DrawTool({ instance });

    function vertexLabelFormatter({ position }) {
        const geo = ellipsoid.toGeodetic(position.x, position.y, position.z);

        return `lat: ${geo.latitude.toFixed(3)}°, lon: ${geo.longitude.toFixed(3)}°`;
    }

    drawTool.createPoint({ showVertexLabels: true, vertexLabelFormatter }).then(shape => {
        instance.remove(shape);

        const point = shape.points[0];

        const { latitude, longitude } = ellipsoid.toGeodetic(point.x, point.y, point.z);

        goToGround(latitude, longitude);
    });
});

function reset() {
    params = {
        ...DEFAULT_PARAMS,
        observer: DEFAULT_PARAMS.observer.clone(),
        target: DEFAULT_PARAMS.target.clone(),
    };

    showHelper(params.showEllipsoidHelper);
    setRed(params.redWavelength);
    setGreen(params.greenWavelength);
    setBlue(params.blueWavelength);
    setGlobeColor(params.globeColor);
    setThickness(params.thickness, 3_000, 300_000, 1);
    showOuter(params.outer);
    showInner(params.inner);
    setLookAtSun(params.lookAtSun);
    showMarker(params.showSunMarker);
    setAutomaticSunRotation(params.automaticSunRotation);
    updateCamera();

    instance.view.setControls(controls);
    controls.enabled = true;
    controls.target.set(0, 0, 0);
}

bindButton('reset', reset);

reset();

Inspector.attach('inspector', instance);
StatusBar.bind(instance, { disableUrlUpdate: true });
