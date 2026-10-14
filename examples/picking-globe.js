/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { createCanvasContext2D } from 'ol/dom.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { OSM } from 'ol/source.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import { Vector2 } from 'three';

import GlobeControls from '@giro3d/giro3d/controls/GlobeControls.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Globe from '@giro3d/giro3d/entities/Globe.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import StatusBar from './widgets/StatusBar.js';

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg4978,
    backgroundColor: 'grey',
});

const globe = new Globe({
    backgroundColor: '#aad3df',
    // To avoid flickering when we update the vector layer
    subdivisionStrategy: () => true,
});

globe.helperColor = 'black';

instance.add(globe);

const osm = new ColorLayer({
    source: new TiledImageSource({ source: new OSM() }),
});

globe.addLayer(osm);

const countryStyle = feature => {
    const hovered = feature.get('hover') ?? false;

    const [r, g, b] = hovered ? [255, 255, 0] : [255, 0, 0];

    return new Style({
        stroke: new Stroke({ color: `rgb(${r}, ${g}, ${b})`, width: 2 }),
        fill: new Fill({ color: `rgba(${r}, ${g}, ${b}, 0.4)` }),
    });
};

const boundariesSource = new VectorSource({
    data: {
        url: 'https://3d.oslandia.com/giro3d/vectors/countries.geojson',
        format: new GeoJSON(),
    },
    style: countryStyle,
    dataProjection: CoordinateSystem.epsg4326,
});

// Display the countries boundaries.
const boundaries = new ColorLayer({
    name: 'boundaries',
    resolutionFactor: 1.5,
    source: boundariesSource,
});

globe.addLayer(boundaries).catch(e => console.error(e));

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

const previouslyHoveredFeatures = [];

const tempVec2 = new Vector2();

instance.domElement.addEventListener('mousemove', e => {
    const canvasCoords = instance.eventToCanvasCoords(e, tempVec2);
    const pickResult = globe.pick(canvasCoords)[0];

    previouslyHoveredFeatures.forEach(f => f.set('hover', false));
    previouslyHoveredFeatures.length = 0;

    if (pickResult) {
        const features = boundaries.pickFeaturesFrom(pickResult).map(item => item.feature);

        features.forEach(feature => {
            feature.set('hover', true);
            previouslyHoveredFeatures.push(feature);
        });

        boundariesSource.update();
    }
});

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
