/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import XYZ from 'ol/source/XYZ.js';
import { Stroke, Style } from 'ol/style.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import BlendingMode from '@giro3d/giro3d/core/layer/BlendingMode.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import StaticImageSource from '@giro3d/giro3d/sources/StaticImageSource.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import { bindButton } from './widgets/bindButton.js';
import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindNumericalDropDown } from './widgets/bindNumericalDropDown.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg4326,
});

const extent = new Extent(CoordinateSystem.epsg4326, -180, 180, -90, 90);

const map = new Map({ extent, backgroundColor: 'blue' });

instance.add(map);

const key =
    'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ';

// Create a satellite layer with no blending at all (layer is completely opaque)
const satellite = new ColorLayer({
    name: 'satellite',
    blendingMode: BlendingMode.None,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            crossOrigin: 'anonymous',
        }),
    }),
});
map.addLayer(satellite).catch(e => console.error(e));

// Create a vector layer with normal blending mode.
const vector = new ColorLayer({
    name: 'boundaries',
    blendingMode: BlendingMode.Normal,
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/giro3d/vectors/countries.geojson',
            format: new GeoJSON(),
        },
        style: new Style({
            stroke: new Stroke({ color: 'red', width: 2 }),
        }),
        dataProjection: CoordinateSystem.epsg4326,
    }),
});
map.addLayer(vector).catch(e => console.error(e));

// Create a cloud coverage layer with an additive blending mode
const cloud = new ColorLayer({
    name: 'clouds',
    blendingMode: BlendingMode.Add,
    source: new StaticImageSource({
        source: 'https://3d.oslandia.com/giro3d/images/cloud_cover.webp',
        extent,
    }),
});
map.addLayer(cloud).catch(e => console.error(e));

instance.view.camera.position.set(0, 0, 230);

const controls = new MapControls(instance.view.camera, instance.domElement);

instance.view.setControls(controls);

// Example GUI

const [setBackground] = bindColorPicker('color', v => {
    map.backgroundColor = v;
    instance.notifyChange(map);
});
const setMode = (layer, mode) => {
    layer.blendingMode = mode;
    instance.notifyChange(layer);
};
const [setCloudMode] = bindNumericalDropDown('cloud', v => setMode(cloud, v));
const [setVectorMode] = bindNumericalDropDown('vector', v => setMode(vector, v));
const [setSatelliteMode] = bindNumericalDropDown('satellite', v => setMode(satellite, v));

const show = (layer, v) => {
    layer.visible = v;
    instance.notifyChange(layer);
};
const [showClouds] = bindToggle('show-cloud', v => show(cloud, v));
const [showSatellite] = bindToggle('show-satellite', v => show(satellite, v));
const [showVector] = bindToggle('show-vector', v => show(vector, v));
const [showBackground] = bindToggle('show-background', v => {
    map.backgroundOpacity = v ? 1 : 0;
    instance.notifyChange(map);
});

const reset = () => {
    setCloudMode(BlendingMode.Add);
    setVectorMode(BlendingMode.Normal);
    setSatelliteMode(BlendingMode.None);

    showClouds(true);
    showVector(true);
    showSatellite(true);

    setBackground('blue');

    showBackground(true);
};

bindButton('reset', reset);

reset();

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
