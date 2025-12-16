/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { Fill, Style } from 'ol/style.js';
import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import { bindSlider } from './widgets/bindSlider';

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -4553934 - 1000000,
    -4553934 + 1000000,
    -3910697 - 1000000,
    -3910697 + 1000000,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
});

instance.view.camera.position.set(-4553934, -3910697, 4600000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = new Vector3(-4553934, -3910696, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
instance.view.setControls(controls);

const map = new Map({ extent, backgroundColor: 'green' });

instance.add(map);

const rectangle = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [-46, -30],
                [-41, -30],
                [-41, -35],
                [-46, -35],
                [-46, -30],
            ],
        ],
    },
};

const triangle = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [-45, -31],
                [-39, -31],
                [-39, -35],
                [-45, -31],
            ],
        ],
    },
};

function makeGeoJSONLayer(name, geojson, color) {
    const style = new Style({
        fill: new Fill({
            color,
        }),
    });
    const source = new VectorSource({
        data: {
            content: geojson,
            format: new GeoJSON(),
        },
        style,
        dataProjection: CoordinateSystem.epsg4326,
    });
    const layer = new ColorLayer({
        name,
        extent,
        source,
    });
    return layer;
}

const redSquare = makeGeoJSONLayer('redSquare', rectangle, '#aa0000');
const blueTriangle = makeGeoJSONLayer('blueTriangle', triangle, '#0000aa');

map.addLayer(redSquare);
map.addLayer(blueTriangle);

Inspector.attach('inspector', instance);

instance.notifyChange(map);

// GUI
bindSlider('map-opacity', v => {
    map.opacity = v;
    instance.notifyChange(map);
});
bindSlider('bg-opacity', v => {
    map.backgroundOpacity = v;
    instance.notifyChange(map);
});
bindSlider('blue-opacity', v => {
    blueTriangle.opacity = v;
    instance.notifyChange(map);
});
bindSlider('red-opacity', v => {
    redSquare.opacity = v;
    instance.notifyChange(map);
});
