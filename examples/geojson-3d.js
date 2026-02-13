/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { tile } from 'ol/loadingstrategy.js';
import VectorSource from 'ol/source/Vector.js';
import { createXYZ } from 'ol/tilegrid.js';
import { AmbientLight, Color, DirectionalLight, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const epsg2154 = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

CoordinateSystem.register(
    'urn:ogc:def:crs:OGC:1.3:CRS84',
    '+proj=longlat +datum=WGS84 +no_defs +type=crs',
);

const instance = new Instance({
    target: 'view',
    crs: epsg2154,
    backgroundColor: null,
});

const center = new Coordinates(CoordinateSystem.epsg4326, 6.63125, 45.93506).as(
    instance.coordinateSystem,
);
const extent = Extent.fromCenterAndSize(epsg2154, { x: center.x, y: center.y }, 1_000, 1_000);

const buildingSource = new VectorSource({
    format: new GeoJSON(),
    url: 'data/geojson_3D.geojson',
    strategy: tile(createXYZ({ tileSize: 512 })),
});

const colors = {};

function colorFromId(id) {
    if (colors[id] == null) {
        colors[id] = new Color().setHSL(Math.random(), 0.5, 0.5, 'srgb');
    }

    const result = colors[id];

    return result;
}

const params = {
    shading: true,
    lines: true,
};

const featureCollection = new FeatureCollection({
    source: buildingSource,
    dataProjection: CoordinateSystem.epsg4326,
    extent,
    minLevel: 0,
    maxLevel: 0,
    style: feature => {
        return {
            fill: {
                color: colorFromId(feature.get('id')),
                shading: params.shading,
            },
            stroke: params.lines ? { color: 'black', lineWidth: 2 } : null,
        };
    },
});

instance.add(featureCollection);

// Add a sunlight
const sun = new DirectionalLight('#ffffff', 2);
sun.position.set(1, 0, 10000);
sun.updateMatrixWorld(true);
instance.scene.add(sun);

// We can look below the floor, so let's light also a bit there
const sun2 = new DirectionalLight('#ffffff', 0.5);
sun2.position.set(0, 1, 1);
sun2.updateMatrixWorld();
instance.scene.add(sun2);

// Add an ambient light
const ambientLight = new AmbientLight(0xffffff, 0.2);
instance.scene.add(ambientLight);

instance.view.camera.position.set(center.x + 60, center.y + 60, 150);

const lookAt = new Vector3(center.x, center.y, 10);
instance.view.camera.lookAt(lookAt);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.4;
controls.target.copy(lookAt);
controls.saveState();
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

bindToggle('toggle-shading', v => {
    params.shading = v;
    featureCollection.updateStyles();
});
bindToggle('show-lines', v => {
    params.lines = v;
    featureCollection.updateStyles();
});
