/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import OSM from 'ol/source/OSM.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

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
    backgroundColor: 0x0a3b59,
});

const map = new Map({ extent });

instance.add(map);

// Create the OpenStreetMap color layer using an OpenLayers source.
// See https://openlayers.org/en/latest/apidoc/module-ol_source_OSM-OSM.html
// for more informations.
const osm = new ColorLayer({
    name: 'osm',
    source: new TiledImageSource({ source: new OSM() }),
});

map.addLayer(osm);

instance.view.camera.position.set(0, 0, 80000000);

const controls = new MapControls(instance.view.camera, instance.domElement);

instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
