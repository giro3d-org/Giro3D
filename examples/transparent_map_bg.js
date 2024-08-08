import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import { Fill, Style } from 'ol/style.js';
import GeoJSON from 'ol/format/GeoJSON.js';

import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

// Defines geographic extent: CRS, min/max X, min/max Y
const extent = new Extent(
    'EPSG:3857',
    -4553934 - 1000000,
    -4553934 + 1000000,
    -3910697 - 1000000,
    -3910697 + 1000000,
);

// `viewerDiv` will contain Giro3D' rendering area (the canvas element)
const viewerDiv = document.getElementById('viewerDiv');

// Creates a Giro3D instance
const instance = new Instance(viewerDiv, {
    crs: extent.crs(),
    renderer: {
        clearColor: false,
    },
});

// Instanciates camera
instance.view.camera.position.set(-4553934, -3910697, 4600000);

// Instanciates controls
const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = new Vector3(-4553934, -3910696, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.25;

instance.useTHREEControls(controls);

const map = new Map('map', { extent, backgroundColor: 'green' });
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
        data: geojson,
        format: new GeoJSON(),
        style,
        dataProjection: 'EPSG:4326',
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

Inspector.attach(document.getElementById('panelDiv'), instance);

instance.notifyChange(map);

// GUI
function bindSlider(id, action) {
    const slider = document.getElementById(id);
    slider.oninput = () => {
        action(slider.value);
        instance.notifyChange(map);
    };
}

bindSlider('map-opacity', v => {
    map.opacity = v;
});
bindSlider('bg-opacity', v => {
    map.backgroundOpacity = v;
});
bindSlider('blue-opacity', v => {
    blueTriangle.opacity = v;
});
bindSlider('red-opacity', v => {
    redSquare.opacity = v;
});
