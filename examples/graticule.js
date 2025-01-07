import colormap from 'colormap';

import { Color, DoubleSide } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import XYZ from 'ol/source/XYZ.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import GeoTIFFFormat from '@giro3d/giro3d/formats/GeoTIFFFormat.js';
import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/ColorMap.js';

import StatusBar from './widgets/StatusBar.js';

import { bindToggle } from './widgets/bindToggle.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindDropDown } from './widgets/bindDropDown.js';

const x = -13602000;
const y = 5812000;
const halfWidth = 25000;

const extent = new Extent('EPSG:3857', x - halfWidth, x + halfWidth, y - halfWidth, y + halfWidth);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 0x0a3b59,
});

const map = new Map({
    extent,
    hillshading: true,
    discardNoData: true,
    side: DoubleSide,
    backgroundColor: 'white',
    graticule: {
        enabled: true,
        color: new Color('white'),
        xStep: 500,
        yStep: 500,
        xOffset: 0,
        yOffset: 0,
        opacity: 1,
        thickness: 20,
    },
});

instance.add(map);

const source = new TiledImageSource({
    retries: 0, // Don't retry to download missing tiles as this dataset as a lot of missing tiles
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
    extent,
    interpretation: Interpretation.Raw,
    source,
    colorMap: new ColorMap({ colors, min: floor, max: ceiling, mode: ColorMapMode.Elevation }),
});

map.addLayer(dem);

instance.view.camera.position.set(-13600394, 5818579, 11832);

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.target.set(-13603000, 5811000, 0);

instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

/// Example GUI

bindToggle('toggle-graticule', v => {
    map.graticule.enabled = v;
    instance.notifyChange(map);
});

bindSlider('x-step', v => {
    map.graticule.xStep = v;
    instance.notifyChange(map);
});
bindSlider('y-step', v => {
    map.graticule.yStep = v;
    instance.notifyChange(map);
});
bindSlider('x-offset', v => {
    map.graticule.xOffset = v;
    instance.notifyChange(map);
});
bindSlider('y-offset', v => {
    map.graticule.yOffset = v;
    instance.notifyChange(map);
});
bindSlider('opacity', v => {
    map.graticule.opacity = v;
    instance.notifyChange(map);
});
bindSlider('thickness', v => {
    map.graticule.thickness = v;
    instance.notifyChange(map);
});
bindDropDown('color', v => {
    map.graticule.color = new Color(v);
    instance.notifyChange(map);
});
