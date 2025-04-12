import { OSM } from 'ol/source';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent';
import Instance from '@giro3d/giro3d/core/Instance';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import Map from '@giro3d/giro3d/entities/Map';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource';
import WmsSource from '@giro3d/giro3d/sources/WmsSource';
import StatusBar from './widgets/StatusBar';
import Inspector from '@giro3d/giro3d/gui/Inspector';

import { bindButton } from './widgets/bindButton';

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:3857',
});

const extent = new Extent('EPSG:4326', { west: -25, south: 36, north: 65, east: 65 }).as(
    instance.referenceCrs,
);

const map = new Map({
    extent,
});

instance.add(map);

// Add an OpenStreetMap background
map.addLayer(
    new ColorLayer({
        name: 'OSM',
        source: new TiledImageSource({ source: new OSM() }),
    }),
);

const source = new WmsSource({
    url: 'http://globalfloods-ows.ecmwf.int/glofas-ows/ows.py',
    layer: 'AccRainEGE',
    projection: 'EPSG:4326',
    imageFormat: 'image/png',
});

const initialDate = new Date(Date.UTC(2018, 3, 18));
let currentDate = new Date(initialDate);

source.setTime(currentDate);

// Add our temporal WMS layer
map.addLayer(
    new ColorLayer({
        name: 'AccRainEGE',
        source,
    }),
);

const { target } = instance.view.goTo(map);

const controls = new MapControls(instance.view.camera, instance.domElement);

instance.view.setControls(controls);
controls.target.copy(target);

StatusBar.bind(instance);

Inspector.attach('inspector', instance);

/**
 * @param {Date} date
 */
const updateWmsLayer = date => {
    source.setTime(date);
};

bindButton('reset', () => {
    updateWmsLayer(initialDate);
});

bindButton('previous-day', () => {
    currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    updateWmsLayer(currentDate);
});

bindButton('next-day', () => {
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    updateWmsLayer(currentDate);
});
