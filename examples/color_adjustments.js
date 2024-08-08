import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import { Fill, Stroke, Style } from 'ol/style.js';
import GeoJSON from 'ol/format/GeoJSON.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import WmsSource from '@giro3d/giro3d/sources/WmsSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import StatusBar from './widgets/StatusBar.js';

document.getElementById('layer-select').addEventListener('change', function () {
    var selectedValue = this.value;

    document.getElementById('map-settings').style.display = 'none';
    document.getElementById('satellite-settings').style.display = 'none';
    document.getElementById('geojson-settings').style.display = 'none';

    if (selectedValue === 'map') {
        document.getElementById('map-settings').style.display = 'block';
    } else if (selectedValue === 'satellite') {
        document.getElementById('satellite-settings').style.display = 'block';
    } else if (selectedValue === 'geojson') {
        document.getElementById('geojson-settings').style.display = 'block';
    }
});

const viewer = document.getElementById('viewerDiv');

Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);
Instance.registerCRS('EPSG:4171', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');

const instance = new Instance(viewer, { crs: 'EPSG:3946' });

const xmin = 1837816.94334;
const xmax = 1847692.32501;
const ymin = 5170036.4587;
const ymax = 5178412.82698;

const extent = new Extent('EPSG:3946', xmin, xmax, ymin, ymax);

const map = new Map('city-of-lyon', { extent });
instance.add(map);

const satelliteSource = new WmsSource({
    url: 'https://data.geopf.fr/wms-r',
    projection: 'EPSG:3946',
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
    imageFormat: 'image/jpeg',
});

const colorLayer = new ColorLayer({
    name: 'satellite',
    source: satelliteSource,
    extent: map.extent,
});
map.addLayer(colorLayer);

// Adds our first layer from a geojson file
// Initial source: https://data.grandlyon.com/jeux-de-donnees/parcs-places-jardins-indice-canopee-metropole-lyon/info
const geoJsonLayer = new ColorLayer({
    name: 'geojson',
    source: new VectorSource({
        data: 'https://3d.oslandia.com/lyon/evg_esp_veg.evgparcindiccanope_latest.geojson',
        // Defines the dataProjection to reproject the data,
        // GeoJSON specifications say that the crs should be EPSG:4326 but
        // here we are using a different one.
        dataProjection: 'EPSG:4171',
        format: new GeoJSON(),
        style: feature =>
            new Style({
                fill: new Fill({
                    color: `rgba(0, 128, 0, ${feature.get('indiccanop')})`,
                }),
                stroke: new Stroke({
                    color: 'white',
                }),
            }),
    }),
});
map.addLayer(geoJsonLayer);

const camera = instance.camera.camera3D;
const cameraAltitude = 2000;

const cameraPosition = new Vector3(extent.west(), extent.south(), cameraAltitude);
camera.position.copy(cameraPosition);

const controls = new MapControls(camera, instance.domElement);
controls.target = extent.centerAsVector3();

controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;

controls.saveState();

instance.useTHREEControls(controls);

function bindSlider(name, fn) {
    const slider = document.getElementById(name);
    slider.oninput = function oninput() {
        fn(slider.value);
        instance.notifyChange(map);
    };
}

function bindLayerSliders(id, layer) {
    document.getElementById(`${id}-reset`).onclick = function onclick() {
        layer.brightness = 0;
        layer.saturation = 1;
        layer.contrast = 1;
        instance.notifyChange(map);
    };
    bindSlider(`${id}-brightness`, v => {
        layer.brightness = v;
    });
    bindSlider(`${id}-contrast`, v => {
        layer.contrast = v;
    });
    bindSlider(`${id}-saturation`, v => {
        layer.saturation = v;
    });
}

bindLayerSliders('satellite', colorLayer);
bindLayerSliders('vector', geoJsonLayer);

const mapParams = map.colorimetry;
bindSlider('map-brightness', v => {
    mapParams.brightness = v;
});
bindSlider('map-contrast', v => {
    mapParams.contrast = v;
});
bindSlider('map-saturation', v => {
    mapParams.saturation = v;
});

document.getElementById('map-reset').onclick = function onclick() {
    mapParams.brightness = 0;
    mapParams.contrast = 1;
    mapParams.saturation = 1;

    instance.notifyChange(map);
};

Inspector.attach(document.getElementById('panelDiv'), instance);

StatusBar.bind(instance);
