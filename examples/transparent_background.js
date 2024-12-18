import colormap from 'colormap';

import { Color, DoubleSide } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import XYZ from 'ol/source/XYZ.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import GeoTIFFFormat from '@giro3d/giro3d/formats/GeoTIFFFormat.js';
import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/ColorMap.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

const x = -13602000;
const y = 5812000;
const halfWidth = 2500;

const extent = new Extent('EPSG:3857', x - halfWidth, x + halfWidth, y - halfWidth, y + halfWidth);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
});

const map = new Map({
    extent,
    lighting: true,
    side: DoubleSide,
    backgroundColor: 'white',
});

instance.add(map);

const source = new TiledImageSource({
    source: new XYZ({
        minZoom: 10,
        maxZoom: 16,
        url: 'https://3d.oslandia.com/dem/MtStHelens-tiles/{z}/{x}/{y}.tif',
    }),
    format: new GeoTIFFFormat(),
});

const floor = 1100;
const ceiling = 2500;

const values = colormap({ colormap: 'viridis', nshades: 256 });
const colors = values.map(v => new Color(v));

const dem = new ElevationLayer({
    name: 'dem',
    source,
    extent,
    colorMap: new ColorMap({ colors, min: floor, max: ceiling }),
});

map.addLayer(dem);

instance.view.camera.position.set(-13594700, 5819700, 7300);

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.target.set(-13603000, 5811000, 0);

instance.view.setControls(controls);

instance.notifyChange();

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
