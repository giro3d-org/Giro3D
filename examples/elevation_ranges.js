import colormap from 'colormap';

import XYZ from 'ol/source/XYZ.js';

import { Color, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import ColorMap from '@giro3d/giro3d/core/layer/ColorMap.js';

import StatusBar from './widgets/StatusBar.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';

const center = { x: -13601505, y: 5812315 };

const extent = Extent.fromCenterAndSize('EPSG:3857', center, 20000, 20000);

// Creates a Giro3D instance
const instance = new Instance({
    target: 'view',
    crs: extent.crs(),
    renderer: {
        clearColor: false,
    },
});

const map = new Map({
    extent,
    elevationRange: { min: 500, max: 3000 },
});

instance.add(map);

function makeColorRamp(preset) {
    const values = colormap({ colormap: preset, nshades: 256 });
    const colors = values.map(v => new Color(v));

    return colors;
}

const colorRamp = makeColorRamp('viridis');

const key =
    'pk.eyJ1IjoidG11Z3VldCIsImEiOiJjbGJ4dTNkOW0wYWx4M25ybWZ5YnpicHV6In0.KhDJ7W5N3d1z3ArrsDjX_A';
// Adds a XYZ elevation layer with MapBox terrain RGB tileset
const elevationLayer = new ElevationLayer({
    name: 'xyz_elevation',
    extent,
    source: new TiledImageSource({
        format: new MapboxTerrainFormat(),
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
            projection: extent.crs(),
            crossOrigin: 'anonymous',
        }),
    }),
    colorMap: new ColorMap(colorRamp, 700, 2500),
});
map.addLayer(elevationLayer);

// Adds a XYZ color layer with MapBox satellite tileset
const colorLayer = new ColorLayer({
    name: 'xyz_color',
    extent,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            projection: extent.crs(),
            crossOrigin: 'anonymous',
        }),
    }),
    elevationRange: { min: 500, max: 3000 },
});
map.addLayer(colorLayer);

// Sets the camera position
instance.view.camera.position.set(-13615016, 5835706, 14797);

// Creates controls
const controls = new MapControls(instance.view.camera, instance.domElement);

// Then looks at extent's center
controls.target = new Vector3(-13603869, 5814829, 0);
controls.saveState();

controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;

instance.useTHREEControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

function bindSlider(name, fn) {
    const slider = document.getElementById(name);
    slider.oninput = function oninput() {
        fn(slider.value);
        instance.notifyChange(map);
    };
}

function bindToggle(name, action) {
    const toggle = document.getElementById(`toggle-${name}`);
    toggle.oninput = () => {
        const state = toggle.checked;
        action(state);
        instance.notifyChange(map);
    };
}

let colorLayerRange = null;

bindToggle('colorlayer-range', enabled => {
    if (enabled) {
        colorLayer.elevationRange = colorLayerRange;
    } else {
        colorLayer.elevationRange = null;
    }

    document.getElementById('layerMin').disabled = !enabled;
    document.getElementById('layerMax').disabled = !enabled;
});

bindSlider('mapMin', v => {
    map.elevationRange.min = v;
});
bindSlider('mapMax', v => {
    map.elevationRange.max = v;
});
bindSlider('layerMin', v => {
    colorLayer.elevationRange = { min: v, max: colorLayer.elevationRange.max };
    colorLayerRange = colorLayer.elevationRange;
});
bindSlider('layerMax', v => {
    colorLayer.elevationRange = { min: colorLayer.elevationRange.min, max: v };
    colorLayerRange = colorLayer.elevationRange;
});
