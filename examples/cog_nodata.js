import colormap from 'colormap';

import { Color } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import CogSource from '@giro3d/giro3d/sources/CogSource.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import MaskLayer from '@giro3d/giro3d/core/layer/MaskLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/layer/ColorMap.js';

import StatusBar from './widgets/StatusBar.js';

// Define projection that we will use (taken from https://epsg.io/26910, Proj4js section)
Instance.registerCRS(
    'EPSG:26910',
    '+proj=utm +zone=10 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const extent = new Extent('EPSG:26910', 532622, 569790, 5114416, 5137240);

const center = extent.centerAsVector3();

// `viewerDiv` will contain Giro3D' rendering area (the canvas element)
const viewerDiv = document.getElementById('viewerDiv');

// Instantiate Giro3D
const instance = new Instance(viewerDiv, {
    crs: extent.crs(),
    renderer: {
        clearColor: false,
    },
});

// Instantiate the camera
instance.view.camera.position.set(center.x, center.y - 1, 50000);

// Instantiate the controls
const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(center.x, center.y, center.z);
instance.useTHREEControls(controls);

// Use an elevation COG with nodata values
const source = new CogSource({
    // https://pubs.er.usgs.gov/publication/ds904
    url: 'https://3d.oslandia.com/dem/msh2009dem.tif',
    crs: extent.crs(),
});

const values = colormap({ colormap: 'viridis', nshades: 256 });
const colors = values.map(v => new Color(v));

const min = 227;
const max = 2538;

const colorMap = new ColorMap(colors, min, max, ColorMapMode.Elevation);

const noDataOptions = {
    alpha: 0,
    maxSearchDistance: 10000,
    replaceNoData: true,
};

const map = new Map({
    extent,
    doubleSided: true,
    backgroundOpacity: 0,
    hillshading: true,
    discardNoData: true,
});

instance.add(map);

let elevationLayer;
let maskLayer;
let colorLayer;

let activeLayer = 0;

function updateActiveLayer() {
    elevationLayer.visible = false;
    maskLayer.visible = false;
    colorLayer.visible = false;

    switch (activeLayer) {
        case 0:
            elevationLayer.visible = true;
            map.backgroundOpacity = 0;
            map.discardNoData = true;
            break;
        case 1:
            maskLayer.visible = true;
            map.backgroundOpacity = 1;
            map.discardNoData = false;
            break;
        case 2:
        default:
            colorLayer.visible = true;
            map.backgroundOpacity = 0;
            map.discardNoData = false;
            break;
    }
}

function buildLayers() {
    map.removeLayer(elevationLayer);
    map.removeLayer(maskLayer);
    map.removeLayer(colorLayer);

    maskLayer = new MaskLayer({
        name: 'mask',
        extent,
        source,
        noDataOptions,
        preloadImages: false,
    });

    elevationLayer = new ElevationLayer({
        name: 'elevation',
        extent,
        source,
        noDataOptions,
        colorMap,
        preloadImages: false,
        minmax: { min, max },
    });

    colorLayer = new ColorLayer({
        name: 'color',
        extent,
        source,
        noDataOptions,
        colorMap,
        preloadImages: false,
    });

    map.addLayer(elevationLayer);
    map.addLayer(maskLayer);
    map.addLayer(colorLayer);

    updateActiveLayer();

    instance.notifyChange(map);
}

// Attach the inspector
Inspector.attach(document.getElementById('panelDiv'), instance);

const alphaReplacementInput = document.getElementById('alphaReplacement');

alphaReplacementInput.addEventListener('change', e => {
    const value = parseInt(e.target.value, 10);
    noDataOptions.alpha = value;
});

const radiusSlider = document.getElementById('maxDistanceSlider');
radiusSlider.oninput = function oninput() {
    noDataOptions.maxSearchDistance = radiusSlider.valueAsNumber;
};

const enableFillNoDataCheckbox = document.getElementById('enableFillNoData');

enableFillNoDataCheckbox.oninput = function oninput() {
    const state = enableFillNoDataCheckbox.checked;
    noDataOptions.replaceNoData = state;
    if (!state) {
        radiusSlider.setAttribute('disabled', !state);
        alphaReplacementInput.setAttribute('disabled', !state);
    } else {
        radiusSlider.removeAttribute('disabled');
        alphaReplacementInput.removeAttribute('disabled');
    }
};

function bindDropdown(id, action) {
    document.getElementById(id).addEventListener('change', e => {
        const value = parseInt(e.target.value, 10);
        action(value);
        instance.notifyChange(map);
    });
}

bindDropdown('noDataLayerSource', v => {
    activeLayer = v;
});

bindDropdown('alphaReplacement', v => {
    noDataOptions.value = v;
});

// Bind events
StatusBar.bind(instance);

buildLayers();

document.getElementById('applyChanges').onclick = function onclick() {
    buildLayers();
};
