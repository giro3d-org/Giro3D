/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/Addons.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Instance from '@giro3d/giro3d/core/Instance';
import Inspector from '@giro3d/giro3d/gui/Inspector';
import Viewshed, { ViewshedMode } from '@giro3d/giro3d/interactions/Viewshed';
import Fetcher from '@giro3d/giro3d/utils/Fetcher';

import { bindColorPicker } from './widgets/bindColorPicker';
import { bindDropDown } from './widgets/bindDropDown';
import { bindNumberInput } from './widgets/bindNumberInput';
import StatusBar from './widgets/StatusBar';

const instance = new Instance({
    crs: CoordinateSystem.epsg3857,
    backgroundColor: '#726c69',
    target: 'view',
});
const objects = [];

const ambient = new THREE.AmbientLight('white', 0.2);
const sun = new THREE.DirectionalLight('white', 1.5);
sun.target.position.set(0, 0, 0);
sun.position.set(100, 100, 100);
sun.updateMatrixWorld(true);

instance.add(sun);
instance.add(sun.target);
instance.add(ambient);

const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200, 1, 1),
    new THREE.MeshStandardMaterial({ color: 'white' }),
);
instance.add(plane);
objects.push(plane);

const rand = (a, b) => a + Math.random() * (b - a);

for (let i = 0; i < 25; ++i) {
    const h = rand(5, 20);
    const box = new THREE.Mesh(
        new THREE.BoxGeometry(6, 6, h),
        new THREE.MeshStandardMaterial({
            color: new THREE.Color(Math.random(), Math.random(), Math.random()),
        }),
    );
    box.position.set(rand(-80, 80), rand(-80, 80), h / 2);
    box.updateMatrixWorld(true);
    instance.add(box);
    objects.push(box);
}

// This box is ignored
const box = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 30),
    new THREE.MeshStandardMaterial({
        color: new THREE.Color(1, 0, 0),
    }),
);
box.position.set(0, 0, 15);
box.updateMatrixWorld(true);
instance.add(box);

instance.scene.updateMatrixWorld();

instance.view.goTo({
    origin: new THREE.Vector3(-80, -530, 330),
    target: new THREE.Vector3(4, -4, 0),
    orthographicZoom: 1,
});

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.target.set(0, 0, 0);

instance.view.setControls(controls);

const observer = new THREE.Vector3(0, 10, 10);
const observerDir = new THREE.Vector3(1, 0, 0);

const eye = new THREE.SpriteMaterial({
    color: 'white',
    sizeAttenuation: false,
    visible: false,
});

Fetcher.texture('https://3d.oslandia.com/giro3d/images/eye.png').then(t => {
    eye.map = t;
    eye.needsUpdate = true;
    eye.visible = true;
});

const observerMesh = new THREE.Sprite(eye);
observerMesh.scale.set(0.01, 0.01, 0.01);
observerMesh.position.copy(observer);
instance.add(observerMesh);
observerMesh.updateMatrixWorld();

const viewshed = new Viewshed({ instance, objects });

const setMode = mode => {
    if (mode === 'cubemap') {
        viewshed.mode = ViewshedMode.Omnidirectional;
    } else if (mode === 'frustum') {
        viewshed.mode = ViewshedMode.Frustum;
    }
    instance.notifyChange();
};
const setTextureSize = size => {
    viewshed.textureSize = parseInt(size, 10);
    instance.notifyChange();
};
const setMinDistance = d => {
    viewshed.minDistance = d;
    instance.notifyChange();
};
const setMaxDistance = d => {
    viewshed.maxDistance = d;
    instance.notifyChange();
};
const setBias = d => {
    viewshed.bias = d;
    instance.notifyChange();
};
const setVisibleColor = c => {
    viewshed.visibleColor = new THREE.Vector4(c.r * 255, c.g * 255, c.b * 255, 0.5);
    instance.notifyChange();
};
const setOccludedColor = c => {
    viewshed.occludedColor = new THREE.Vector4(c.r * 255, c.g * 255, c.b * 255, 0.5);
    instance.notifyChange();
};

setMode(bindDropDown('mode', setMode)[1]);
setTextureSize(bindDropDown('texture-size', setTextureSize)[1]);
setVisibleColor(bindColorPicker('visible-color', setVisibleColor)[1]);
setOccludedColor(bindColorPicker('occluded-color', setOccludedColor)[1]);
setMaxDistance(bindNumberInput('max-distance', setMaxDistance)[1]);
setMinDistance(bindNumberInput('min-distance', setMinDistance)[1]);
setBias(bindNumberInput('bias', setBias)[1]);

instance.addEventListener('after-render', () => {
    viewshed.origin = observer;
    viewshed.direction = observerDir;
    viewshed.render();
});

Inspector.attach('inspector', instance);
StatusBar.bind(instance);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    observer.set(Math.cos(t * 0.25) * 80, Math.sin(t * 0.25) * 80, 10);
    observerDir.set(-Math.cos(t * 0.25), -Math.sin(t * 0.25), 0);
    observerMesh.position.copy(observer);
    observerMesh.updateMatrixWorld(true);
    instance.notifyChange();
}

animate();
