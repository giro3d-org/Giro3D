import colormap from 'colormap';

import { Color } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import { Fill, Stroke, Style } from 'ol/style.js';
import TileWMS from 'ol/source/TileWMS.js';
import GeoJSON from 'ol/format/GeoJSON.js';

import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import ColorMap from '@giro3d/giro3d/core/layer/ColorMap.js';

import StatusBar from './widgets/StatusBar.js';

// # Planar (EPSG:3946) viewer

// Defines projection that we will use (taken from https://epsg.io/3946, Proj4js section)
Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

// Defines geographic extent: CRS, min/max X, min/max Y
const extent = new Extent('EPSG:3946', 1837816.94334, 1847692.32501, 5170036.4587, 5178412.82698);

// `viewerDiv` will contain Giro3D' rendering area (the canvas element)
const viewerDiv = document.getElementById('viewerDiv');

// Creates the Giro3D instance
const instance = new Instance(viewerDiv, {
    crs: 'EPSG:3946',
    renderer: {
        clearColor: false,
    },
});

const terrainMap = new Map('terrain', { extent, doubleSided: true, hillshading: true });
instance.add(terrainMap);

const min = 100;
const max = 300;

const values = colormap({ colormap: 'viridis', nshades: 256 });
const colors = values.map(v => new Color(v));
const colorMap = new ColorMap(colors, min, max);

const elevationLayer = new ElevationLayer({
    name: 'terrain',
    extent,
    colorMap,
    minmax: { min, max },
    source: new TiledImageSource({
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
    }),
});

terrainMap.addLayer(elevationLayer);

const orthophotoMap = new Map('orthophoto', { extent, doubleSided: true });
instance.add(orthophotoMap);

const orthophotoLayer = new ColorLayer({
    name: 'orthophoto',
    extent,
    source: new TiledImageSource({
        source: new TileWMS({
            url: 'https://data.geopf.fr/wms-r',
            projection: 'EPSG:3946',
            params: {
                LAYERS: ['HR.ORTHOIMAGERY.ORTHOPHOTOS'],
                FORMAT: 'image/jpeg',
            },
        }),
    }),
});
orthophotoMap.addLayer(orthophotoLayer);

const vectorMap = new Map('geojson', { extent, doubleSided: true, backgroundOpacity: 0 });
instance.add(vectorMap);

const geoJsonLayer = new ColorLayer({
    name: 'geojson',
    extent,
    source: new VectorSource({
        data: 'https://raw.githubusercontent.com/iTowns/iTowns2-sample-data/master/lyon.geojson',
        format: new GeoJSON(),
        dataProjection: 'EPSG:3946',
        style: new Style({
            fill: new Fill({
                color: 'rgba(255, 165, 0, 0.6)',
            }),
            stroke: new Stroke({
                color: 'white',
            }),
        }),
    }),
});

vectorMap.addLayer(geoJsonLayer);

orthophotoMap.object3d.translateZ(+1500);
orthophotoMap.object3d.updateMatrixWorld();
vectorMap.object3d.translateZ(+2500);
vectorMap.object3d.updateMatrixWorld();

// Sets the camera position
instance.view.camera.position.set(1832816, 5163527, 6121);

// Creates controls
const controls = new MapControls(instance.view.camera, instance.domElement);
// Then looks at extent's center
controls.target = extent.centerAsVector3();
controls.saveState();

controls.enableDamping = true;
controls.dampingFactor = 0.2;

instance.useTHREEControls(controls);

Inspector.attach(document.getElementById('panelDiv'), instance);

// Bind events
StatusBar.bind(instance);

function bindToggle(id, callback) {
    const toggle = document.getElementById(id);
    toggle.oninput = () => {
        const state = toggle.checked;
        callback(state);
        instance.notifyChange();
    };
}

function bindSlider(id, callback) {
    const slider = document.getElementById(id);
    slider.oninput = function oninput() {
        callback(slider.valueAsNumber);
        instance.notifyChange();
    };
}

bindToggle('show-terrain', v => {
    terrainMap.visible = v;
});
bindToggle('show-orthophoto', v => {
    orthophotoMap.visible = v;
});
bindToggle('show-vector', v => {
    vectorMap.visible = v;
});

bindSlider('terrain-opacity', o => {
    terrainMap.opacity = o;
});
bindSlider('orthophoto-opacity', o => {
    orthophotoMap.opacity = o;
});
bindSlider('vector-opacity', o => {
    vectorMap.opacity = o;
});
bindSlider('vector-bg-opacity', o => {
    vectorMap.backgroundOpacity = o;
    instance.notifyChange(vectorMap);
});
