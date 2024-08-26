import colormap from 'colormap';

import { Color } from 'three';
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
import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/layer/ColorMap.js';

import StatusBar from './widgets/StatusBar.js';

const x = -13602000;
const y = 5812000;
const halfWidth = 25000;

// Defines geographic extent: CRS, min/max X, min/max Y
const extent = new Extent('EPSG:3857', x - halfWidth, x + halfWidth, y - halfWidth, y + halfWidth);

// Creates a Giro3D instance
const instance = new Instance({
    target: 'view',
    crs: extent.crs(),
    renderer: {
        clearColor: 0x0a3b59,
    },
});

// Creates a map that will contain the layer
const map = new Map({
    extent,
    hillshading: true,
    discardNoData: true,
    doubleSided: true,
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
    colorMap: new ColorMap(colors, floor, ceiling, ColorMapMode.Elevation),
});

map.addLayer(dem);

instance.view.camera.position.set(-13600394, 5818579, 11832);

// Instanciates controls
const controls = new MapControls(instance.view.camera, instance.domElement);

controls.target.set(-13603000, 5811000, 0);

instance.useTHREEControls(controls);

// GUI
function bindSlider(id, callback) {
    const slider = document.getElementById(id);
    slider.oninput = function oninput() {
        callback(slider.value);
        instance.notifyChange(map);
    };
}

function bindToggle(id, callback) {
    const toggle = document.getElementById(id);

    toggle.oninput = function oninput() {
        callback(toggle.checked);
        instance.notifyChange(map);
    };
}

function bindDropdown(id, callback) {
    document.getElementById(id).addEventListener('change', e => {
        callback(e.target.value);
        instance.notifyChange(map);
    });
}

bindToggle('toggle-graticule', v => (map.graticule.enabled = v));

bindSlider('x-step', v => (map.graticule.xStep = v));
bindSlider('y-step', v => (map.graticule.yStep = v));
bindSlider('x-offset', v => (map.graticule.xOffset = v));
bindSlider('y-offset', v => (map.graticule.yOffset = v));
bindSlider('opacity', v => (map.graticule.opacity = v));
bindSlider('thickness', v => (map.graticule.thickness = v));

bindDropdown('color', v => (map.graticule.color = new Color(v)));

Inspector.attach(document.getElementById('panelDiv'), instance);
StatusBar.bind(instance);
