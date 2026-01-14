/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { OSM } from 'ol/source.js';

import GlobeControls from '@giro3d/giro3d/controls/GlobeControls.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Globe from '@giro3d/giro3d/entities/Globe.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg4978,
    backgroundColor: 'grey',
});

const globe = new Globe({
    backgroundColor: '#aad3df',
});

globe.helperColor = 'black';

instance.add(globe);

const layer = new ColorLayer({
    source: new TiledImageSource({ source: new OSM() }),
});

globe.addLayer(layer);

instance.view.goTo(globe);

const controls = new GlobeControls({
    scene: globe.object3d,
    ellipsoid: globe.ellipsoid,
    camera: instance.view.camera,
    domElement: instance.domElement,
});

const updateControls = () => {
    controls.update();
    instance.notifyChange(globe);

    requestAnimationFrame(updateControls);
};

updateControls();

Inspector.attach('inspector', instance);

bindToggle('show-layer', v => {
    layer.visible = v;
    instance.notifyChange(layer);
});
bindToggle('show-bounding-boxes', v => {
    globe.showBoundingBoxes = v;
    instance.notifyChange(globe);
});
bindToggle('show-lod-spheres', v => {
    globe.showBoundingSpheres = v;
    instance.notifyChange(globe);
});
bindToggle('show-outlines', v => {
    globe.showTileOutlines = v;
    instance.notifyChange(globe);
});

StatusBar.bind(instance);
