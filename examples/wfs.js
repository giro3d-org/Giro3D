/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { getUid } from 'ol';
import { GeoJSON } from 'ol/format.js';
import TileWMS from 'ol/source/TileWMS.js';
import { Stroke, Style } from 'ol/style.js';
import { MathUtils, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.register(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const extent = new Extent(crs, 1837816.94334, 1847692.32501, 5170036.4587, 5178412.82698);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 0x0a3b59,
});

const map = new Map({ extent });
instance.add(map);

// Adds a WMS imagery layer
const colorSource = new TiledImageSource({
    source: new TileWMS({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:3946',
        params: {
            LAYERS: ['ORTHOIMAGERY.ORTHOPHOTOS'],
            FORMAT: 'image/jpeg',
        },
    }),
});

const colorLayer = new ColorLayer({
    name: 'orthoimagery',
    extent,
    source: colorSource,
});
map.addLayer(colorLayer);

const featureColors = new window.Map();

function getColor(id) {
    if (featureColors.has(id)) {
        return featureColors.get(id);
    }
    const hue = MathUtils.randFloat(30, 340);
    const color = `hsl(${hue}, 70%, 50%)`;

    featureColors.set(id, color);
    return color;
}

const style = feature => {
    const id = getUid(feature);
    const highlight = feature.get('highlight');
    const width = highlight ? 10 : 6;
    const color = getColor(id);
    return [
        new Style({
            zIndex: highlight ? 10 : 0,
            stroke: new Stroke({
                color: 'white',
                width,
            }),
        }),
        new Style({
            zIndex: highlight ? 10 : 0,
            stroke: new Stroke({
                color,
                width: width - 2,
            }),
        }),
    ];
};

// Adds a WFS imagery layer
const wfsSource = new VectorSource({
    dataProjection: crs,
    data: {
        url:
            'https://download.data.grandlyon.com/wfs/rdata' +
            '?SERVICE=WFS' +
            '&VERSION=2.0.0' +
            '&request=GetFeature' +
            '&typename=tcl_sytral.tcllignebus_2_0_0' +
            '&outputFormat=application/json;%20subtype=geojson' +
            '&SRSNAME=EPSG:3946' +
            '&startIndex=0',
        format: new GeoJSON(),
    },
    style,
});

const wfsLayer = new ColorLayer({
    name: 'lyon_tcl_bus',
    extent,
    source: wfsSource,
});

map.addLayer(wfsLayer);

instance.view.camera.position.set(1839739, 5171618, 910);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = new Vector3(1840839, 5172718, 0);
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

const labelElement = document.createElement('div');
labelElement.classList.value = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';

const lineName = document.createElement('span');
lineName.style.marginLeft = '0.5rem';

const lineNumber = document.createElement('span');
lineNumber.classList.value = 'badge rounded-pill';
lineNumber.style.color = 'white';
lineNumber.style.background = 'red';
lineNumber.innerText = '32';

labelElement.appendChild(lineNumber);
labelElement.appendChild(lineName);

const label = new CSS2DObject(labelElement);

label.visible = false;
instance.add(label);

let previousFeature;

function pickFeatures(mouseEvent) {
    const pickResult = instance.pickObjectsAt(mouseEvent);

    const picked = pickResult[0];

    function resetPickedFeatures() {
        if (previousFeature) {
            previousFeature.set('highlight', false);
            wfsSource.updateFeature(previousFeature);
        }
        if (label.visible) {
            label.visible = false;
        }
        previousFeature = null;
    }

    if (picked) {
        const { x, y } = picked.point;
        const coordinates = new Coordinates(instance.coordinateSystem, x, y);
        const features = wfsLayer.getVectorFeaturesAtCoordinate(coordinates, {
            radius: 3,
            xTileRes: 2,
            yTileRes: 2,
        });

        if (features.length > 0) {
            const firstFeature = features[features.length - 1];

            previousFeature?.set('highlight', false);
            firstFeature.set('highlight', true);

            if (previousFeature !== firstFeature) {
                wfsSource.updateFeature(previousFeature, firstFeature);
                previousFeature = firstFeature;
            }

            label.position.set(x, y, 0);
            label.visible = true;
            lineNumber.style.background = getColor(getUid(firstFeature));
            lineNumber.innerText = firstFeature.get('ligne');
            lineName.innerText = firstFeature.get('nom_trace');
            label.updateMatrixWorld(true);
        } else {
            resetPickedFeatures();
        }
    } else {
        resetPickedFeatures();
    }
}

instance.domElement.addEventListener('mousemove', pickFeatures);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
