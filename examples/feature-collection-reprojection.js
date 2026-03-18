/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { OSM } from 'ol/source.js';
import VectorSource from 'ol/source/Vector.js';
import { Color, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { MathUtils } from 'three/src/math/MathUtils.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const center = new Coordinates(crs, 651_668, 6_862_256);
const extent = Extent.fromCenterAndSize(crs, center, 20_000, 14_000);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

const map = new Map({ extent });

instance.add(map);

const osm = new ColorLayer({
    source: new TiledImageSource({
        source: new OSM(),
    }),
});

map.addLayer(osm);

// This is a GeoJSON with the default crs EPSG:4326
const arrondissementSource = new VectorSource({
    format: new GeoJSON(),
    url: './data/paris_arrondissements.geojson',
});

function getHue(area) {
    const minArea = 991153;
    const maxArea = 16372542;
    const hue = MathUtils.mapLinear(area, minArea, maxArea, 0.2, 0.8);

    return MathUtils.clamp(hue, 0, 1);
}

// Creates the entity. The features will automatically be reprojected before being displayed.
const arrondissements = new FeatureCollection({
    name: 'arrondissements',
    source: arrondissementSource,
    extent,
    ignoreZ: true,
    minLevel: 0,
    maxLevel: 0,
    style: feature => {
        // The style depends on the polygon's area
        const t = getHue(feature.get('surface'));
        const highlight = feature.get('highlight');
        const brightness = highlight ? 1 : 0.7;
        const color = new Color().setHSL(0, t, brightness * t, 'srgb');

        return {
            fill: {
                color,
                opacity: 0.6,
                depthTest: false,
                renderOrder: 1,
            },
            stroke: {
                color: 'black',
                opacity: 0.99, // To ensure it is renderer on top of surfaces
                lineWidth: highlight ? 4 : 2,
                depthTest: false,
                renderOrder: 2,
            },
        };
    },
});
instance.add(arrondissements);

// Another GeoJSON in EPSG:3857
// Although this is non-standard in recent versions of
// the GeoJSON specification, OpenLayers and Giro3D still
// support GeoJSON files that have a different CRS than EPSG:4326.
const perimeterqaaSource = new VectorSource({
    format: new GeoJSON(),
    url: './data/perimetreqaa.geojson',
});

const perimeterqaa = new FeatureCollection({
    name: 'perimeterqaa',
    source: perimeterqaaSource,
    extent,
    ignoreZ: true,
    minLevel: 0,
    maxLevel: 0,
    style: feature => {
        const highlight = feature.get('highlight');
        return {
            fill: {
                color: highlight ? '#5d914d' : '#41822d',
                depthTest: false,
                opacity: 0.7,
                renderOrder: 3,
            },
            stroke: {
                color: '#85f516',
                opacity: 0.99, // To ensure that it is properly drawn on top of the surfaces
                lineWidth: highlight ? 4 : 1,
                renderOrder: 4,
                depthTest: false,
            },
        };
    },
});
instance.add(perimeterqaa);

const position = new Coordinates(crs, 652212.5, 6860754.1, 27717.3);
const lookAtCoords = new Coordinates(crs, 652338.3, 6862087.1, 200);
const lookAt = new Vector3(lookAtCoords.x, lookAtCoords.y, lookAtCoords.z);
instance.view.camera.position.set(position.x, position.y, position.z);
instance.view.camera.lookAt(lookAt);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.copy(lookAt);
controls.saveState();
instance.view.setControls(controls);

// information on click
const resultTable = document.getElementById('results');

let previousObjects = [];
const objectsToUpdate = [];

function createResultTable(values) {
    resultTable.innerHTML = '';

    for (const value of values) {
        const child = document.createElement('li');
        // child.classList.add('list-group-item');
        child.innerText = value;
        resultTable.appendChild(child);
    }
}

function pick(e) {
    instance.notifyChange();
    // pick objects
    const pickedObjects = instance.pickObjectsAt(e, {
        radius: 2,
        where: [arrondissements, perimeterqaa],
    });

    // Reset highlights
    previousObjects.forEach(o => o.userData.feature.set('highlight', false));

    const tableValues = [];

    if (pickedObjects.length !== 0) {
        resultTable.innerHTML = '';

        for (const p of pickedObjects) {
            const obj = p.object;

            const feature = obj.userData.feature;
            const entity = obj.userData.parentEntity;

            objectsToUpdate.push(obj);

            if (entity === arrondissements) {
                tableValues.push(feature.get('l_ar'));
            }
            if (entity === perimeterqaa) {
                tableValues.push('Improved Accessibility Zone');
            }
            // highlight it
            feature.set('highlight', true);
        }
    }

    createResultTable(tableValues);

    instance.notifyChange([...previousObjects, ...objectsToUpdate]);
    previousObjects = [...objectsToUpdate];
    objectsToUpdate.length = 0;
}

instance.domElement.addEventListener('mousemove', pick);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
