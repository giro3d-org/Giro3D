/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Toast } from 'bootstrap';
import OSM from 'ol/source/OSM.js';
import { AmbientLight, Color, DirectionalLight, Mesh, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import GlobeControls from '@giro3d/giro3d/controls/GlobeControls.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Globe from '@giro3d/giro3d/entities/Globe.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindButton } from './widgets/bindButton.js';
import { bindNumberInput } from './widgets/bindNumberInput.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

/** @returns {string} */
function resolveTilesetUrl() {
    const searchParam = new URL(document.URL).searchParams.get('url');
    /** @type {HTMLInputElement} */
    // @ts-expect-error not strongly typed
    const input = document.getElementById('url');
    const inputValue = input.value;

    if (inputValue) {
        const value = input.value;
        const url = new URL(document.URL);

        url.searchParams.delete('url');
        url.searchParams.append('url', value);

        window.history.replaceState({}, null, url.toString());

        return value;
    } else if (searchParam) {
        input.value = searchParam;
        return searchParam;
    } else {
        // TODO defaults ?
    }
}

const params = {
    globeMode: false,
    globeOpacity: 1,
    tilesetOpacity: 1,
    errorTarget: 8,
};

/** @type {Tiles3D | undefined} */
let tileset = undefined;
/** @type {Instance | undefined} */
let instance = undefined;
/** @type {Globe | undefined} */
let globe = undefined;
/** @type {Inspector | undefined} */
let inspector = undefined;

/**
 * @param {Vector3} target
 */
function initControls(target) {
    if (params.globeMode) {
        const globeControls = new GlobeControls({
            scene: globe.object3d,
            ellipsoid: globe.ellipsoid,
            camera: instance.view.camera,
            domElement: instance.domElement,
        });

        const updateControls = () => {
            globeControls.update();
            instance.notifyChange(globe);
            instance.notifyChange(tileset);

            requestAnimationFrame(updateControls);
        };

        updateControls();
    } else {
        // create controls
        const mapControls = new MapControls(instance.view.camera, instance.domElement);
        mapControls.enableDamping = true;
        mapControls.dampingFactor = 0.25;
        mapControls.update();
        mapControls.target.copy(target);
        instance.view.setControls(mapControls);
    }
}

// setup the error displaying
const toastLiveExample = document.getElementById('liveToast');
const toastBootstrap = Toast.getOrCreateInstance(toastLiveExample);
function displayError(evt) {
    document.getElementById('error').innerText = evt.error.message;
    toastBootstrap.show();
}

/** @param {string} url */
async function run(url) {
    instance?.dispose();
    inspector?.detach();

    // init instance
    instance = new Instance({
        target: 'view', // The id of the <div> to attach the instance
        crs: params.globeMode ? CoordinateSystem.epsg4978 : CoordinateSystem.epsg3857,
        backgroundColor: 0xcccccc,
    });

    if (params.globeMode) {
        globe = new Globe({
            backgroundColor: '#aad3df',
        });

        globe.helperColor = 'black';

        await instance.add(globe);

        const layer = new ColorLayer({
            source: new TiledImageSource({ source: new OSM() }),
        });

        await globe.addLayer(layer);
    }

    // Add a sunlight
    const sun = new DirectionalLight('#ffffff', 1.4);
    sun.position.set(1, 0, 1).normalize();
    sun.updateMatrixWorld(true);
    instance.scene.add(sun);

    // We can look below the floor, so let's light also a bit there
    const sun2 = new DirectionalLight('#ffffff', 0.5);
    sun2.position.set(0, -1, 1);
    sun2.updateMatrixWorld();
    instance.scene.add(sun2);

    // Add ambient light
    const ambientLight = new AmbientLight(0xffffff, 1);
    instance.scene.add(ambientLight);
    instance.view.minNearPlane = 0.5;

    tileset = new Tiles3D({ url: url.toString() });

    // If the tileset comes from an ifc converted with py3dtiles, hide some elements that don't bring visual value
    tileset.addEventListener('object-created', evt => {
        const scene = evt.obj;
        scene.traverse(obj => {
            if (obj.userData?.class === 'IfcSpace') {
                obj.visible = false;
                instance.notifyChange();
            }
        });
    });

    await instance.add(tileset);

    const pov = instance.view.goTo(tileset);

    initControls(pov.target);

    inspector = Inspector.attach('inspector', instance);
    StatusBar.bind(instance, { disableUrlUpdate: true });
}

run(resolveTilesetUrl()).catch(console.error);

// picking and highlighting logic
const resultsTable = document.getElementById('results');

let highlighted;
let highlightColor = new Color(0xff7171);

let canPick = true;

/** @param {MouseEvent} evt */
function highlight(evt) {
    if (!instance || !tileset) {
        return;
    }

    if (!canPick) {
        return;
    }

    const picked = instance.pickObjectsAt(evt, {
        radius: 5,
        limit: 10,
        where: [tileset],
        filter: pick => pick.object.visible, // Ignore invisible objects, such as IfcSpace elements
    });

    if (highlighted && highlighted.material.color != null) {
        // reset style
        const material = highlighted.material;
        material.color.copy(material.userData.oldColor);

        instance.notifyChange(highlighted);
    }

    if (picked.length === 0) {
        document.getElementById('pick-result').style.display = 'none';
    } else {
        document.getElementById('pick-result').style.display = 'block';
        const obj = picked[0].object;
        if (obj instanceof Mesh) {
            const material = obj.material;

            // keep the old color to reset it later
            if (material.color != null) {
                if (!material.userData.oldColor) {
                    material.userData.oldColor = material.color.clone();
                }

                material.color.copy(highlightColor);
            }

            instance.notifyChange(obj);
            highlighted = obj;
        }

        const rows = [];

        for (const [name, value] of Object.entries(obj.userData)) {
            if (name !== 'oldColor' && name !== 'parentEntity') {
                const row = document.createElement('tr');
                const nameCell = document.createElement('td');
                nameCell.innerHTML = `<code>${name}</code>`;
                const valueCell = document.createElement('td');
                valueCell.innerText = value.toString().substring(0, 20);
                valueCell.title = value;
                row.append(nameCell, valueCell);
                rows.push(row);
            }
        }

        resultsTable.replaceChildren(...rows);
    }
}

// Prevent picking if user is dragging mouse
instance.domElement.addEventListener('mousedown', () => (canPick = true));
instance.domElement.addEventListener('mousemove', () => (canPick = false));
instance.domElement.addEventListener('mouseup', highlight);

function updateParams() {
    if (globe) {
        globe.opacity = params.globeOpacity;
        globe.visible = params.globeOpacity > 0;
        instance.notifyChange(globe);
    }
    if (tileset) {
        tileset.opacity = params.tilesetOpacity;
        tileset.visible = params.tilesetOpacity > 0;
        tileset.errorTarget = params.errorTarget;
        instance.notifyChange(tileset);
    }
}

updateParams();

bindSlider('globe-opacity', v => {
    params.globeOpacity = v;
    updateParams();
});
bindSlider('tileset-opacity', v => {
    params.tilesetOpacity = v;
    updateParams();
});
bindButton('center-view', () => {
    if (tileset) {
        instance.view.goTo(tileset);
    }
});
bindToggle('globe-mode', v => {
    params.globeMode = v;
});
bindNumberInput('error-target', v => {
    params.errorTarget = v;
    updateParams();
});
bindButton('start', () => {
    run(resolveTilesetUrl()).catch(console.error);
});
