import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import TileWMS from 'ol/source/TileWMS.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

// # Planar (EPSG:3946) viewer

// Defines projection that we will use (taken from https://epsg.io/3946, Proj4js section)
Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

// Defines geographic extent: CRS, min/max X, min/max Y
const extent = new Extent('EPSG:3946', 1837816.94334, 1847692.32501, 5170036.4587, 5178412.82698);

// Creates the Giro3D instance
const instance = new Instance({
    target: 'view',
    crs: extent.crs(),
});

// Adds the map that will contain the layers.
const map = new Map({
    extent,
    // Enables hillshading on this map
    hillshading: {
        enabled: true,
        elevationLayersOnly: false,
    },
    backgroundColor: 'white',
});
instance.add(map);

// Adds a WMS imagery layer
const colorSource = new TiledImageSource({
    source: new TileWMS({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:3946',
        params: {
            LAYERS: ['HR.ORTHOIMAGERY.ORTHOPHOTOS'],
            FORMAT: 'image/jpeg',
        },
    }),
});

const colorLayer = new ColorLayer({
    name: 'wms_imagery',
    extent: extent.split(2, 1)[0],
    source: colorSource,
});
map.addLayer(colorLayer);

// Adds a WMS elevation layer
const elevationSource = new TiledImageSource({
    source: new TileWMS({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:3946',
        crossOrigin: 'anonymous',
        params: {
            LAYERS: ['ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES'],
            FORMAT: 'image/x-bil;bits=32',
        },
    }),
    format: new BilFormat(),
    noDataValue: -1000,
});

const min = 149;
const max = 621;

const elevationLayer = new ElevationLayer({
    name: 'wms_elevation',
    extent,
    minmax: { min, max },
    source: elevationSource,
});

map.addLayer(elevationLayer);

const mapCenter = extent.centerAsVector3();

// Sets the camera position
instance.view.camera.position.set(mapCenter.x, mapCenter.y - 1, 10000);

// Creates controls
const controls = new MapControls(instance.view.camera, instance.domElement);

// Then looks at extent's center
controls.target = mapCenter;
controls.saveState();

controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;

instance.useTHREEControls(controls);

const hillshadingCheckbox = document.getElementById('hillshadingCheckbox');
const shadeColorLayersCheckbox = document.getElementById('colorLayers');
const terrainDeformationCheckbox = document.getElementById('terrainDeformation');
const terrainStitchingCheckbox = document.getElementById('terrainStitching');
const azimuthSlider = document.getElementById('azimuthSlider');
const zenithSlider = document.getElementById('zenithSlider');
const opacitySlider = document.getElementById('opacitySlider');
const intensitySlider = document.getElementById('intensitySlider');
const zFactorSlider = document.getElementById('zFactorSlider');

hillshadingCheckbox.oninput = function oninput() {
    const state = hillshadingCheckbox.checked;
    map.hillshading.enabled = state;
    instance.notifyChange(map);

    shadeColorLayersCheckbox.disabled = !state;
    azimuthSlider.disabled = !state;
    zenithSlider.disabled = !state;
};

shadeColorLayersCheckbox.oninput = function oninput() {
    const state = shadeColorLayersCheckbox.checked;
    map.hillshading.elevationLayersOnly = !state;
    instance.notifyChange(map);
};

opacitySlider.oninput = function oninput() {
    const percentage = opacitySlider.value;
    const opacity = percentage / 100.0;
    colorLayer.opacity = opacity;
    instance.notifyChange(map);
    opacitySlider.innerHTML = `${percentage}%`;
};

azimuthSlider.oninput = function oninput() {
    map.hillshading.azimuth = azimuthSlider.value;
    instance.notifyChange(map);
};

zenithSlider.oninput = function oninput() {
    map.hillshading.zenith = zenithSlider.value;
    instance.notifyChange(map);
};

intensitySlider.oninput = function oninput() {
    map.hillshading.intensity = intensitySlider.value;
    instance.notifyChange(map);
};

intensitySlider.oninput = function oninput() {
    map.hillshading.intensity = intensitySlider.value;
    instance.notifyChange(map);
};

zFactorSlider.oninput = function oninput() {
    map.hillshading.zFactor = zFactorSlider.value;
    instance.notifyChange(map);
};

terrainDeformationCheckbox.oninput = function oninput() {
    const state = terrainDeformationCheckbox.checked;
    map.terrain.enabled = state;
    instance.notifyChange(map);
    terrainStitchingCheckbox.disabled = !state;
};

terrainStitchingCheckbox.oninput = function oninput() {
    const state = terrainStitchingCheckbox.checked;
    map.terrain.stitching = state;
    instance.notifyChange(map);
};

Inspector.attach(document.getElementById('panelDiv'), instance);
StatusBar.bind(instance);
