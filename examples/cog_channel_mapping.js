import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import CogSource from '@giro3d/giro3d/sources/CogSource.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS('EPSG:32611', '+proj=utm +zone=11 +datum=WGS84 +units=m +no_defs +type=crs');

// Define geographic extent: CRS, min/max X, min/max Y
const extent = new Extent('EPSG:32611', 666285, 668533.5, 3997174, 3998444);
const center = extent.centerAsVector3();

// Instantiate Giro3D
const instance = new Instance({
    target: 'view',
    crs: extent.crs(),
    renderer: {
        clearColor: 0x0a3b59,
    },
});

// Instantiate the camera
instance.view.camera.position.set(center.x, center.y, 2500);

// Instantiate the controls
const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(center.x, center.y + 1, center.z);

instance.useTHREEControls(controls);

// Construct a map and add it to the instance
const map = new Map({ extent });
instance.add(map);

// Data coming from the same source as
// https://openlayers.org/en/latest/examples/cog-math-multisource.html
const source = new CogSource({
    url: 'https://3d.oslandia.com/cog_data/20200428_211318_ssc8d1_0017_pansharpened.cog.tif',
    crs: extent.crs(),
    channels: [0, 1, 2],
});

const layer = new ColorLayer({
    name: 'color-layer',
    source,
    extent,
    interpretation: Interpretation.CompressTo8Bit(0, 900),
});

map.addLayer(layer);

function bindDropdown(id, action) {
    document.getElementById(id).addEventListener('change', e => {
        const value = parseInt(e.target.value, 10);
        action(value);
    });
}

bindDropdown('r-channel', v => {
    source.channels[0] = v;
    source.update();
});
bindDropdown('g-channel', v => {
    source.channels[1] = v;
    source.update();
});
bindDropdown('b-channel', v => {
    source.channels[2] = v;
    source.update();
});

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
