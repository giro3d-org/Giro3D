import { Color, MathUtils } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import DebugSource from '@giro3d/giro3d/sources/DebugSource.js';

import StatusBar from './widgets/StatusBar.js';

// Defines geographic extent: CRS, min/max X, min/max Y
const extent = new Extent(
    'EPSG:3857',
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

// Creates a Giro3D instance
const instance = new Instance({
    target: 'view',
    crs: extent.crs(),
    renderer: {
        clearColor: 0x0a3b59,
    },
});

// Instanciates camera
instance.view.camera.position.set(0, 0, 25000000);

// Instanciates controls
const controls = new MapControls(instance.view.camera, instance.domElement);

instance.useTHREEControls(controls);

Inspector.attach('inspector', instance);
StatusBar.bind(instance);

function bindSlider(name, callback) {
    const slider = document.getElementById(name);
    slider.oninput = function oninput() {
        callback(slider.value);
    };
}

function bindToggle(name, callback) {
    const toggle = document.getElementById(name);
    toggle.oninput = () => {
        const state = toggle.checked;
        callback(state);
    };
}

function createColorLayer() {
    const source = new DebugSource({
        color: new Color().setHSL(Math.random(), 0.5, 0.5),
        extent,
        subdivisions: MathUtils.randInt(1, 4),
    });

    return new ColorLayer({ extent, source, showTileBorders: true });
}

let layerCount = 8;
let forceTextureAtlases = false;
/** @type {Map} */
let map = null;

function buildMapAndLayers() {
    if (map) {
        for (const layer of map.getLayers()) {
            map.removeLayer(layer, { disposeLayer: true });
        }
        instance.remove(map);
    }

    // Creates a map that will contain the layer
    map = new Map({ extent, forceTextureAtlases });

    instance.add(map);

    for (let i = 0; i < layerCount; i++) {
        map.addLayer(createColorLayer());
    }
}

bindSlider('layerCount', count => {
    layerCount = count;
});

bindToggle('forceAtlases', force => {
    forceTextureAtlases = force;
});

document.getElementById('build').onclick = () => buildMapAndLayers();
