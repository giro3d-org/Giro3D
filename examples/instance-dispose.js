/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import StadiaMaps from 'ol/source/StadiaMaps.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);
const dimensions = extent.dimensions();

let instance = null;
let inspector = null;
let controls = null;
/** @type {Map} */
let map = null;

function init() {
    instance = new Instance({
        target: 'view',
        crs: extent.crs,
        backgroundColor: 0x0a3b59,
    });

    map = new Map({ extent });

    instance.add(map);

    // Adds an TMS imagery layer
    map.addLayer(
        new ColorLayer({
            name: 'osm',
            source: new TiledImageSource({
                source: new StadiaMaps({ layer: 'stamen_watercolor', wrapX: false }),
            }),
        }),
    ).catch(e => console.error(e));

    instance.view.camera.position.set(
        (Math.random() - 0.5) * dimensions.x,
        (Math.random() - 0.5) * dimensions.y,
        25000000,
    );

    controls = new MapControls(instance.view.camera, instance.domElement);

    instance.view.setControls(controls);

    inspector = Inspector.attach('inspector', instance);
}

init();

function reload() {
    if (!instance) {
        return;
    }

    map.getLayers().forEach(l => l.dispose());
    inspector.detach();
    instance.dispose();
    controls.dispose();
    inspector = null;
    instance = null;
    controls = null;
    init();
}

document.getElementById('load_once').addEventListener('click', reload);

let intervalId;

bindToggle('autoreload', state => {
    clearInterval(intervalId);

    if (state) {
        intervalId = setInterval(reload, 2000);
    }
});

StatusBar.bind(instance);
