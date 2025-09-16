/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GUI from 'lil-gui';
import StadiaMaps from 'ol/source/StadiaMaps.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Panel from '@giro3d/giro3d/gui/Panel.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

class MyCustomPanel extends Panel {
    /**
     * @param {GUI} parentGui The parent GUI.
     * @param {Map} map The observed map.
     * @param {Instance} instance The Giro3D instance.
     */
    constructor(parentGui, map, instance) {
        super(parentGui, instance, 'Custom panel');

        this.map = map;

        this.myCheckBox = true;

        this.addController(this, 'sayHello').name('Press this button!');
        this.addController(this, 'myCheckBox')
            .name('Check this box !')
            .onChange(value => {
                this.map.object3d.visible = value;
                this.instance.notifyChange(this.map);
            });
    }

    sayHello() {
        window.alert('Hello from my custom panel!');
    }
}

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

const map = new Map({ extent });

instance.add(map);

map.addLayer(
    new ColorLayer({
        source: new TiledImageSource({
            source: new StadiaMaps({ layer: 'stamen_watercolor', wrapX: false }),
        }),
    }),
);

// Create camera and controls
instance.view.camera.position.set(0, 0, 25000000);
const controls = new MapControls(instance.view.camera, instance.domElement);
instance.view.setControls(controls);

// Attach the inspector to the DOM
const inspectorDiv = document.getElementById('inspector');
inspectorDiv.classList.remove('d-none');
const inspector = Inspector.attach(inspectorDiv, instance, { title: 'Custom title' });

// Hide the fullscreen button that is at the same place as the Inspector
const btnFullscreen = document.getElementById('btnFullscreen');
btnFullscreen.classList.add('d-none');

const myCustomPanel = new MyCustomPanel(inspector.gui, map, instance);

// Add our custom panel to the inspector.
inspector.addPanel(myCustomPanel);

// Trigger the first render
instance.notifyChange(map);

StatusBar.bind(instance);
