/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import XYZ from 'ol/source/XYZ.js';

import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const center = { x: -13601505, y: 5812315 };

const extent = Extent.fromCenterAndSize(CoordinateSystem.epsg3857, center, 20000, 20000);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
});

const map = new Map({
    extent,
    elevationRange: { min: 500, max: 3000 },
});

instance.add(map);

const colorRamp = makeColorRamp('viridis');

const key =
    'pk.eyJ1IjoidG11Z3VldCIsImEiOiJjbGJ4dTNkOW0wYWx4M25ybWZ5YnpicHV6In0.KhDJ7W5N3d1z3ArrsDjX_A';
// Adds a XYZ elevation layer with MapBox terrain RGB tileset
const elevationLayer = new ElevationLayer({
    name: 'xyz_elevation',
    extent,
    source: new TiledImageSource({
        format: new MapboxTerrainFormat(),
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
            projection: extent.crs.id,
            crossOrigin: 'anonymous',
        }),
    }),
    colorMap: new ColorMap({ colors: colorRamp, min: 700, max: 2500 }),
});
map.addLayer(elevationLayer);

// Adds a XYZ color layer with MapBox satellite tileset
const colorLayer = new ColorLayer({
    name: 'xyz_color',
    extent,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            projection: extent.crs.id,
            crossOrigin: 'anonymous',
        }),
    }),
    elevationRange: { min: 500, max: 3000 },
});
map.addLayer(colorLayer);

// Sets the camera position
instance.view.camera.position.set(-13615016, 5835706, 14797);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = new Vector3(-13603869, 5814829, 0);
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

let colorLayerRange = colorLayer.elevationRange;

bindToggle('toggle-colorlayer-range', enabled => {
    if (enabled) {
        colorLayer.elevationRange = colorLayerRange;
    } else {
        colorLayer.elevationRange = null;
    }

    // @ts-expect-error typing
    document.getElementById('layerMin').disabled = !enabled;
    // @ts-expect-error typing
    document.getElementById('layerMax').disabled = !enabled;

    instance.notifyChange(map);
});

bindSlider('mapMin', v => {
    map.elevationRange.min = v;
    instance.notifyChange(map);
});
bindSlider('mapMax', v => {
    map.elevationRange.max = v;
    instance.notifyChange(map);
});
bindSlider('layerMin', v => {
    colorLayer.elevationRange = { min: v, max: colorLayer.elevationRange.max };
    colorLayerRange = colorLayer.elevationRange;
    instance.notifyChange(map);
});
bindSlider('layerMax', v => {
    colorLayer.elevationRange = { min: colorLayer.elevationRange.min, max: v };
    colorLayerRange = colorLayer.elevationRange;
    instance.notifyChange(map);
});
