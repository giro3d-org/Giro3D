/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import { Color } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

let time = 0;

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 'white',
});

instance.view.camera.position.set(0, 0, 10000000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
instance.view.setControls(controls);

const map = new Map({ extent, backgroundColor: '#135D66' });

instance.add(map);

const ecoRegionLayerStyle = feature => {
    const brightness = Math.sin((time / 1000) * 6) * 0.2;
    const featureColor = new Color(feature.get('COLOR') || '#eeeeee');
    const highlight = feature.get('highlight');

    const color = highlight ? new Color(featureColor).offsetHSL(0, 0, brightness) : featureColor;

    const stroke = highlight
        ? new Stroke({
              color: 'white',
              width: 2,
          })
        : undefined;

    return new Style({
        zIndex: highlight ? 1 : 0,
        fill: new Fill({
            color: `#${color.getHexString()}`,
        }),
        stroke,
    });
};

const ecoRegionSource = new VectorSource({
    data: {
        url: 'https://3d.oslandia.com/giro3d/vectors/ecoregions.json',
        format: new GeoJSON(),
    },
    dataProjection: CoordinateSystem.epsg4326,
    style: ecoRegionLayerStyle,
});

const ecoRegionLayer = new ColorLayer({
    name: 'ecoregions',
    extent,
    source: ecoRegionSource,
});

map.addLayer(ecoRegionLayer);

// Creates the country layer
const countryLayerStyle = new Style({
    stroke: new Stroke({
        color: 'black',
        width: 1,
    }),
});

const countryLayer = new ColorLayer({
    name: 'countries',
    extent,
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/giro3d/vectors/countries.geojson',
            format: new GeoJSON(),
        },
        dataProjection: CoordinateSystem.epsg4326,
        style: countryLayerStyle,
    }),
});

map.addLayer(countryLayer);

// Creates a custom vector layer
const geojson = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [102.0, 0.5],
            },
            properties: {
                prop0: 'value0',
            },
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [102.0, 0.0],
                    [103.0, 1.0],
                    [104.0, 0.0],
                    [105.0, 1.0],
                ],
            },
            properties: {
                prop0: 'value0',
                prop1: 0.0,
            },
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [100.0, 0.0],
                        [101.0, 0.0],
                        [101.0, 1.0],
                        [100.0, 1.0],
                        [100.0, 0.0],
                    ],
                ],
            },
            properties: {
                prop0: 'value0',
                prop1: { this: 'that' },
            },
        },
    ],
};

const customVectorLayerStyle = new Style({
    fill: new Fill({
        color: 'cyan',
    }),
    stroke: new Stroke({
        color: 'orange',
        width: 1,
    }),
});

const customVectorLayer = new ColorLayer({
    name: 'geojson',
    extent,
    source: new VectorSource({
        data: {
            content: geojson,
            format: new GeoJSON(),
        },
        dataProjection: CoordinateSystem.epsg4326,
        style: customVectorLayerStyle,
    }),
});

map.addLayer(customVectorLayer);

const labelElement = document.createElement('span');
labelElement.classList.value = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';
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
            ecoRegionSource.updateFeature(previousFeature);
        }
        if (label.visible) {
            label.visible = false;
        }
        previousFeature = null;
    }

    if (picked) {
        const { x, y } = picked.point;
        const features = ecoRegionLayer.getVectorFeaturesAtCoordinate(
            new Coordinates(instance.coordinateSystem, x, y),
        );

        if (features.length > 0) {
            const firstFeature = features[0];

            previousFeature?.set('highlight', false);
            firstFeature.set('highlight', true);

            if (previousFeature !== firstFeature) {
                ecoRegionSource.updateFeature(previousFeature, firstFeature);
                previousFeature = firstFeature;
            }

            label.position.set(x, y, 100);
            label.visible = true;
            label.element.innerText = firstFeature.get('ECO_NAME');
            label.updateMatrixWorld(true);
        } else {
            resetPickedFeatures();
        }
    } else {
        resetPickedFeatures();
    }
}

function update(t) {
    time = t;
    if (previousFeature != null) {
        ecoRegionSource.updateFeature(previousFeature);
    }
    requestAnimationFrame(update);
}

update(0);

instance.domElement.addEventListener('mousemove', pickFeatures);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
