/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import XYZ from 'ol/source/XYZ.js';
import { AmbientLight, Color, DirectionalLight } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import { MapLightingMode } from '@giro3d/giro3d/entities/MapLightingOptions.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindNumberInput } from './widgets/bindNumberInput.js';
import StatusBar from './widgets/StatusBar.js';

// Chamonix Mont-Blanc coordinates
const poi = new Coordinates(CoordinateSystem.epsg4326, 6.8697, 45.9231)
    .as(CoordinateSystem.epsg3857)
    .toVector3();

const extentSize = 30_000;
const extent = Extent.fromCenterAndSize(
    CoordinateSystem.epsg3857,
    { x: poi.x, y: poi.y },
    extentSize,
    extentSize,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
});

let skirtDepth = 0;
let skirtColor = new Color('#faf0e6');

const center = extent.centerAsVector3();

const directionalLight = new DirectionalLight('white', 3);
const ambientLight = new AmbientLight('white', 1);

directionalLight.position.set(center.x - 5000, center.y - 2000, 10000);
directionalLight.target.position.copy(center);

instance.add(directionalLight);
instance.add(directionalLight.target);
instance.add(ambientLight);

directionalLight.updateMatrixWorld(true);
directionalLight.target.updateMatrixWorld(true);

/** @type {Map} */
let map;

const key =
    'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ';

// Adds a XYZ elevation layer with MapBox terrain RGB tileset
const elevationLayer = new ElevationLayer({
    extent,
    preloadImages: true,
    resolutionFactor: 1 / 8,
    minmax: { min: 0, max: 5000 },
    source: new TiledImageSource({
        format: new MapboxTerrainFormat(),
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});

// Adds a XYZ color layer with MapBox satellite tileset
const satelliteLayer = new ColorLayer({
    extent,
    resolutionFactor: 1.5,
    preloadImages: true,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});

function load() {
    map = new Map({
        extent,
        lighting: {
            enabled: true,
            mode: MapLightingMode.LightBased,
            elevationLayersOnly: true,
        },
        subdivisionThreshold: 1,
        terrain: {
            segments: 64,
            enabled: true,
            skirts: {
                enabled: true,
                depth: skirtDepth,
            },
        },
        backgroundColor: skirtColor,
    });

    instance.add(map);

    map.addLayer(elevationLayer);
    map.addLayer(satelliteLayer);
}

load();

const controls = new MapControls(instance.view.camera, instance.domElement);

instance.view.camera.position.set(poi.x - extentSize - 15000, poi.y - extentSize - 15000, 35_000);
controls.target.set(poi.x, poi.y, 2000);

instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

bindNumberInput('skirt-depth', v => {
    skirtDepth = v;
    if (map) {
        instance.remove(map);
    }
    load();
});

bindColorPicker('color', newColor => {
    skirtColor = new Color(newColor);
    if (map) {
        map.backgroundColor = skirtColor;
        instance.notifyChange(map);
    }
});
