/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Feature } from 'ol';
import GeoJSON from 'ol/format/GeoJSON.js';
import OSM from 'ol/source/OSM.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import DrapedFeatureCollection from '@giro3d/giro3d/entities/DrapedFeatureCollection.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import StreamableFeatureSource, {
    ogcApiFeaturesBuilder,
} from '@giro3d/giro3d/sources/StreamableFeatureSource.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const extent = Extent.fromCenterAndSize(crs, { x: 705056, y: 7059188 }, 30000, 30000);

const instance = new Instance({
    target: 'view',
    crs,
});

const map = new Map({ extent });

instance.add(map);

const osm = new ColorLayer({
    source: new TiledImageSource({
        source: new OSM(),
    }),
});

map.addLayer(osm);

// define the source of our data
const source = new StreamableFeatureSource({
    enableCaching: false,
    queryBuilder: ogcApiFeaturesBuilder(
        'https://data.lillemetropole.fr/geoserver/ogc/features/v1',
        'mel_mobilite_et_transport:parking',
    ),
    format: new GeoJSON(),
});

// Create the `FeatureCollection` entity that will load our features as meshes.
const featureCollection = new DrapedFeatureCollection({
    source,
    style: (/** @type {Feature} */ feature) => {
        /** @type {number} */
        const available = feature.get('nbr_libre');

        const html = `
        <div style="margin-bottom: 50px">
            <div style="font-size: 10pt; padding: 8px 8px 3px 8px; background-color: white; border-radius: 5px; border-color: lightgray; border-style: solid; border-width: 1px">
                <div><span style="background-color: #2550bc; color: white; padding: 3px 7px 3px 7px; border-radius: 5px; font-weight: bold">P</span> <b>${feature.get('nom')}</b></div>
                <div style="margin-top: 4pt"><b style='color: green'>${available}</b> parking spaces available</div>
            </div>
        </div>
        `;

        const htmlElement = document.createElement('div');
        htmlElement.innerHTML = html;

        return {
            htmlElement,
            point: {
                pointSize: 0,
            },
        };
    },
});

instance.add(featureCollection).then(() => {
    featureCollection.attach(map);

    setInterval(() => source.update(), 30000);

    const pov = instance.view.goTo(map);

    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(pov.target);
    controls.saveState();
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    instance.view.setControls(controls);

    Inspector.attach('inspector', instance);

    StatusBar.bind(instance);
});
