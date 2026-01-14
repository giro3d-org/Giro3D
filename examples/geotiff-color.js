/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';

import { bindDropDown } from './widgets/bindDropDown.js';
import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(
    CoordinateSystem.epsg3857,
    1818329.448,
    1987320.77,
    6062229.082,
    6231700.791,
);
const center = extent.centerAsVector3();

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 0x0a3b59,
});

instance.view.camera.position.set(center.x, center.y, 250000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(center.x, center.y + 1, center.z);
instance.view.setControls(controls);

const map = new Map({ extent: extent.withRelativeMargin(0.1) });
instance.add(map);

// Data coming from the same source as
// https://openlayers.org/en/latest/examples/cog-math-multisource.html
const sources = {
    // LZW compression, RGB colorspace
    rgb: new GeoTIFFSource({
        url: 'https://3d.oslandia.com/giro3d/rasters/TCI.tif',
        crs: extent.crs,
        channels: [0, 1, 2],
    }),
    // LZW compression, RGB colorspace, 8-bit alpha band
    rgba: new GeoTIFFSource({
        url: 'https://3d.oslandia.com/giro3d/rasters/TCI-alpha.tif',
        crs: extent.crs,
        channels: [0, 1, 2, 3],
    }),
    // JPEG compression, YCbCr colorspace
    ycbcr: new GeoTIFFSource({
        url: 'https://3d.oslandia.com/giro3d/rasters/TCI-YCbCr.tif',
        crs: extent.crs,
    }),
    // JPEG compression, YCbCr colorspace, 1-bit mask band
    'ycbcr-mask': new GeoTIFFSource({
        url: 'https://3d.oslandia.com/giro3d/rasters/TCI-YCbCr-mask.tif',
        crs: extent.crs,
    }),
};

function updateSource(name) {
    map.forEachLayer(layer => map.removeLayer(layer, { disposeLayer: true }));

    const layer = new ColorLayer({ name: 'color-layer', source: sources[name], extent });
    map.addLayer(layer);
}

Inspector.attach('inspector', instance);
StatusBar.bind(instance);

bindDropDown('source-file', updateSource);

updateSource('rgb');
