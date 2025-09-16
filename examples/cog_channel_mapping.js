/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';

import StatusBar from './widgets/StatusBar.js';
import { bindNumericalDropDown } from './widgets/bindNumericalDropDown.js';

Instance.registerCRS('EPSG:32611', '+proj=utm +zone=11 +datum=WGS84 +units=m +no_defs +type=crs');

const extent = new Extent(CoordinateSystem.fromEpsg(32611), 666285, 668533.5, 3997174, 3998444);
const center = extent.centerAsVector3();

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 0x0a3b59,
});

instance.view.camera.position.set(center.x, center.y, 2500);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(center.x, center.y + 1, center.z);
instance.view.setControls(controls);

const map = new Map({ extent });

instance.add(map);

// Data coming from the same source as
// https://openlayers.org/en/latest/examples/cog-math-multisource.html
const source = new GeoTIFFSource({
    url: 'https://3d.oslandia.com/cog_data/20200428_211318_ssc8d1_0017_pansharpened.cog.tif',
    crs: extent.crs,
    channels: [0, 1, 2],
});

const layer = new ColorLayer({
    name: 'color-layer',
    source,
    extent,
    interpretation: Interpretation.CompressTo8Bit(0, 900),
});

map.addLayer(layer);

bindNumericalDropDown('r-channel', v => {
    source.channels[0] = v;
    source.update();
});
bindNumericalDropDown('g-channel', v => {
    source.channels[1] = v;
    source.update();
});
bindNumericalDropDown('b-channel', v => {
    source.channels[2] = v;
    source.update();
});

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
