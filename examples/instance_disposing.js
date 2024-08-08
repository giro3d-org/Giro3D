import StadiaMaps from 'ol/source/StadiaMaps.js';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

// Defines geographic extent: CRS, min/max X, min/max Y
const extent = new Extent(
    'EPSG:3857',
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);
const dimensions = extent.dimensions();

// `viewerDiv` will contain Giro3D' rendering area (the canvas element)
const viewerDiv = document.getElementById('viewerDiv');

let instance = null;
let inspector = null;
let controls = null;
/** @type {Map} */
let map = null;

function init() {
    // Creates a Giro3D instance
    instance = new Instance(viewerDiv, {
        crs: extent.crs(),
        renderer: {
            clearColor: 0x0a3b59,
        },
    });

    // Creates a map that will contain the layer
    map = new Map({ extent, maxSubdivisionLevel: 10 });

    instance.add(map);

    // Adds an TMS imagery layer
    map.addLayer(
        new ColorLayer({
            name: 'osm',
            source: new TiledImageSource({
                source: new StadiaMaps({ layer: 'stamen_watercolor', wrapX: false }),
            }),
        }),
    ).catch(e => console.error(e));

    // Instanciates camera
    instance.view.camera.position.set(
        (Math.random() - 0.5) * dimensions.x,
        (Math.random() - 0.5) * dimensions.y,
        25000000,
    );

    // Instanciates controls
    controls = new MapControls(instance.view.camera, instance.domElement);

    instance.useTHREEControls(controls);

    inspector = Inspector.attach(document.getElementById('panelDiv'), instance);
}

init();

function reload() {
    if (!instance) return;

    map.getLayers().forEach(l => l.dispose());
    inspector.detach();
    instance.dispose();
    controls.dispose();
    inspector = null;
    instance = null;
    controls = null;
    init();
}

document.getElementById('load_once').addEventListener('click', reload);

// we need to get the current state of the checkbox, as browsers remembers it
let intervalId;
const autoreloadCheckbox = document.getElementById('autoreload');
if (autoreloadCheckbox.checked) {
    intervalId = setInterval(reload, 2000);
}
autoreloadCheckbox.addEventListener('change', e => {
    if (intervalId) {
        clearInterval(intervalId);
    }
    if (e.target.checked) {
        intervalId = setInterval(reload, 2000);
    }
});

StatusBar.bind(instance);
