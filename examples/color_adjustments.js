import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import GeoJSON from 'ol/format/GeoJSON.js';
import { Fill, Stroke, Style } from 'ol/style.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import WmsSource from '@giro3d/giro3d/sources/WmsSource.js';

import StatusBar from './widgets/StatusBar.js';

import { bindButton } from './widgets/bindButton.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindSlider } from './widgets/bindSlider.js';

Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);
Instance.registerCRS('EPSG:4171', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.fromEpsg(3946),
});

const xmin = 1837816.94334;
const xmax = 1847692.32501;
const ymin = 5170036.4587;
const ymax = 5178412.82698;

const extent = new Extent(CoordinateSystem.fromEpsg(3946), xmin, xmax, ymin, ymax);

const map = new Map({ extent });
instance.add(map);

const satelliteSource = new WmsSource({
    url: 'https://data.geopf.fr/wms-r',
    projection: 'EPSG:3946',
    layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
    imageFormat: 'image/jpeg',
});

const satellite = new ColorLayer({
    name: 'satellite',
    source: satelliteSource,
    extent: map.extent,
});
map.addLayer(satellite);

// Adds our first layer from a geojson file
// Initial source: https://data.grandlyon.com/jeux-de-donnees/parcs-places-jardins-indice-canopee-metropole-lyon/info
const geoJsonLayer = new ColorLayer({
    name: 'geojson',
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/lyon/evg_esp_veg.evgparcindiccanope_latest.geojson',
            format: new GeoJSON(),
        },
        // Defines the dataProjection to reproject the data,
        // GeoJSON specifications say that the crs should be EPSG:4326 but
        // here we are using a different one.
        dataProjection: CoordinateSystem.fromEpsg(4171),
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

const camera = instance.view.camera;
const cameraAltitude = 2000;

const center = extent.centerAsVector3();

const cameraPosition = new Vector3(center.x, center.y, cameraAltitude);
camera.position.copy(cameraPosition);

const controls = new MapControls(camera, instance.domElement);
controls.target = center;

controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;

controls.saveState();

instance.view.setControls(controls);

const [setSatelliteBrightness] = bindSlider('satellite-brightness', v => {
    satellite.brightness = v;
    instance.notifyChange(map);
});
const [setSatelliteContrast] = bindSlider('satellite-contrast', v => {
    satellite.contrast = v;
    instance.notifyChange(map);
});
const [setSatelliteSaturation] = bindSlider('satellite-saturation', v => {
    satellite.saturation = v;
    instance.notifyChange(map);
});
const [setVectorBrightness] = bindSlider('vector-brightness', v => {
    geoJsonLayer.brightness = v;
    instance.notifyChange(map);
});
const [setVectorContrast] = bindSlider('vector-contrast', v => {
    geoJsonLayer.contrast = v;
    instance.notifyChange(map);
});
const [setVectorSaturation] = bindSlider('vector-saturation', v => {
    geoJsonLayer.saturation = v;
    instance.notifyChange(map);
});

const mapParams = map.colorimetry;

const [setMapBrightness] = bindSlider('map-brightness', v => {
    mapParams.brightness = v;
    instance.notifyChange(map);
});
const [setMapContrast] = bindSlider('map-contrast', v => {
    mapParams.contrast = v;
    instance.notifyChange(map);
});
const [setMapSaturation] = bindSlider('map-saturation', v => {
    mapParams.saturation = v;
    instance.notifyChange(map);
});

bindButton('reset', () => {
    setMapBrightness(0);
    setMapContrast(1);
    setMapSaturation(1);

    setVectorBrightness(0);
    setVectorContrast(1);
    setVectorSaturation(1);

    setSatelliteBrightness(0);
    setSatelliteContrast(1);
    setSatelliteSaturation(1);

    instance.notifyChange(map);
});

bindDropDown('layer-select', selectedValue => {
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

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
