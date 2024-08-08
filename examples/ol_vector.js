import GeoJSON from 'ol/format/GeoJSON.js';
import { Fill, Stroke, Style } from 'ol/style.js';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';

import StatusBar from './widgets/StatusBar.js';

// Defines geographic extent: CRS, min/max X, min/max Y
const extent = new Extent(
    'EPSG:3857',
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

// `viewerDiv` will contain Giro3D' rendering area (the canvas element)
const viewerDiv = document.getElementById('viewerDiv');

// Creates a Giro3D instance
const instance = new Instance(viewerDiv, {
    crs: extent.crs(),
    renderer: {
        clearColor: 0xffffff,
    },
});

// Instanciates camera
instance.view.camera.position.set(0, 0, 10000000);

// Instanciates controls
const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;

instance.useTHREEControls(controls);

// Adds layers in a map

const map = new Map('planar', { extent, backgroundColor: '#135D66' });
instance.add(map);

const ecoRegionLayerStyle = feature => {
    const color = feature.get('COLOR') || '#eeeeee';
    const highlight = feature.get('highlight');
    const stroke = highlight
        ? new Stroke({
              color: 'white',
              width: 2,
          })
        : undefined;

    return new Style({
        zIndex: highlight ? 1 : 0,
        fill: new Fill({
            color,
        }),
        stroke,
    });
};

const ecoRegionLayer = new ColorLayer({
    name: 'ecoregions',
    extent,
    source: new VectorSource({
        format: new GeoJSON(),
        data: 'https://openlayers.org/data/vector/ecoregions.json',
        dataProjection: 'EPSG:4326',
        style: ecoRegionLayerStyle,
    }),
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
        format: new GeoJSON(),
        data: 'https://openlayers.org/en/v5.3.0/examples/data/geojson/countries.geojson',
        dataProjection: 'EPSG:4326',
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
        format: new GeoJSON(),
        data: geojson,
        dataProjection: 'EPSG:4326',
        style: customVectorLayerStyle,
    }),
});

map.addLayer(customVectorLayer);

StatusBar.bind(instance);

const labelElement = document.createElement('span');
labelElement.classList = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';
const label = new CSS2DObject(labelElement);

label.visible = false;
instance.add(label);

let previousFeature;

function pickFeatures(mouseEvent) {
    const pickResult = instance.pickObjectsAt(mouseEvent);

    const picked = pickResult.at(0);

    function resetPickedFeatures() {
        if (previousFeature) {
            previousFeature.set('highlight', false);
            ecoRegionLayer.source.updateFeature(previousFeature);
        }
        if (label.visible) {
            label.visible = false;
        }
        previousFeature = null;
    }

    if (picked) {
        const { x, y } = picked.point;
        const features = ecoRegionLayer.getVectorFeaturesAtCoordinate(
            new Coordinates(instance.referenceCrs, x, y),
        );

        if (features.length > 0) {
            const firstFeature = features[0];

            previousFeature?.set('highlight', false);
            firstFeature.set('highlight', true);

            if (previousFeature !== firstFeature) {
                ecoRegionLayer.source.updateFeature(previousFeature, firstFeature);
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

instance.domElement.addEventListener('mousemove', pickFeatures);
Inspector.attach(document.getElementById('panelDiv'), instance);
