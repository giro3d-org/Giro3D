import colormap from 'colormap';

import { Color, MathUtils, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import PointCloudMaterial, { MODE } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';
import Tiles3DSource from '@giro3d/giro3d/sources/Tiles3DSource.js';
import WmsSource from '@giro3d/giro3d/sources/WmsSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';

import StatusBar from './widgets/StatusBar.js';

function makeColorRamp(preset, nshades) {
    const values = colormap({ colormap: preset, nshades });
    const colors = values.map(v => new Color(v));

    return colors;
}

const colorRamps = {};

function makeColorRamps() {
    const nshades = 256;

    colorRamps.viridis = makeColorRamp('viridis', nshades);
    colorRamps.jet = makeColorRamp('jet', nshades);
    colorRamps.blackbody = makeColorRamp('blackbody', nshades);
    colorRamps.earth = makeColorRamp('earth', nshades);
    colorRamps.bathymetry = makeColorRamp('bathymetry', nshades);
    colorRamps.magma = makeColorRamp('magma', nshades);
    colorRamps.par = makeColorRamp('par', nshades);

    colorRamps.slope = makeColorRamp('RdBu', nshades);
}

makeColorRamps();

const tmpVec3 = new Vector3();

Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 ' +
        '+y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:3946',
    renderer: {
        clearColor: 0xcccccc,
    },
});

// Create a custom material for our point cloud.
const material = new PointCloudMaterial({
    size: 4,
    mode: MODE.TEXTURE,
});

material.colorMap.min = 100;
material.colorMap.max = 600;
material.colorMap.colors = colorRamps['viridis'];

// Create the 3D tiles entity
const pointcloud = new Tiles3D(
    new Tiles3DSource('https://3d.oslandia.com/3dtiles/lyon.3dtiles/tileset.json'),
    {
        material,
    },
);

let colorLayer;

function placeCamera(position, lookAt) {
    instance.view.camera.position.set(position.x, position.y, position.z);
    instance.view.camera.lookAt(lookAt);
    // create controls
    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(lookAt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    instance.useTHREEControls(controls);

    instance.notifyChange(instance.view.camera);
}

// add pointcloud to scene
function initializeCamera() {
    const bbox = pointcloud.root.bbox
        ? pointcloud.root.bbox
        : pointcloud.root.boundingVolume.box.clone().applyMatrix4(pointcloud.root.matrixWorld);

    instance.view.camera.far = 2.0 * bbox.getSize(tmpVec3).length();

    const ratio = bbox.getSize(tmpVec3).x / bbox.getSize(tmpVec3).z;
    const position = bbox.min
        .clone()
        .add(bbox.getSize(tmpVec3).multiply({ x: 0, y: 0, z: ratio * 0.5 }));
    const lookAt = bbox.getCenter(tmpVec3);
    lookAt.z = bbox.min.z;

    const extent = Extent.fromBox3('EPSG:3946', bbox);

    placeCamera(position, lookAt);

    const colorize = new WmsSource({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:3946',
        layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
        imageFormat: 'image/jpeg',
    });

    colorLayer = new ColorLayer({
        name: 'wms_imagery',
        extent,
        source: colorize,
    });

    pointcloud.attach(colorLayer);

    instance.renderingOptions.enableEDL = true;
    instance.renderingOptions.enableInpainting = true;
    instance.renderingOptions.enablePointCloudOcclusion = true;

    StatusBar.bind(instance);
}

instance.add(pointcloud).then(initializeCamera);

Inspector.attach('inspector', instance);
instance.domElement.addEventListener('dblclick', e =>
    console.log(
        instance.pickObjectsAt(e, {
            // Specify a radius around where we click so we don't have to precisely be on a point
            // to select it
            radius: 5,
            // Limit the number of results for better performances
            limit: 10,
            // Some points are incoherent in the pointcloud, don't pick them
            filter: p => !Number.isNaN(p.point.z) && p.point.z < 1000,
        }),
    ),
);

instance.notifyChange();

function bindSlider(name, fn) {
    const slider = document.getElementById(name);
    slider.oninput = function oninput() {
        fn(slider.value);
        instance.notifyChange();
    };
}

function bindToggle(name, action) {
    const toggle = document.getElementById(name);
    toggle.oninput = () => {
        const state = toggle.checked;
        action(state);
        instance.notifyChange();
    };
}

bindToggle('edl-enable', v => {
    instance.renderingOptions.enableEDL = v;
});
bindToggle('occlusion-enable', v => {
    instance.renderingOptions.enablePointCloudOcclusion = v;
});
bindToggle('inpainting-enable', v => {
    instance.renderingOptions.enableInpainting = v;
});
bindSlider('edl-radius', v => {
    instance.renderingOptions.EDLRadius = v;
});
bindSlider('edl-intensity', v => {
    instance.renderingOptions.EDLStrength = v;
});
bindSlider('inpainting-steps', v => {
    instance.renderingOptions.inpaintingSteps = v;
});
bindSlider('opacity', v => {
    pointcloud.opacity = v;
    document.getElementById('opacityLabel').innerText =
        `Point cloud opacity: ${Math.round(v * 100)}%`;
});

function bindColorMapBounds(callback) {
    /** @type {HTMLInputElement} */
    const lower = document.getElementById('min');

    /** @type {HTMLInputElement} */
    const upper = document.getElementById('max');

    callback(lower.valueAsNumber, upper.valueAsNumber);

    function updateLabels() {
        document.getElementById('minLabel').innerText =
            `Lower bound: ${Math.round(lower.valueAsNumber)}m`;
        document.getElementById('maxLabel').innerText =
            `Upper bound: ${Math.round(upper.valueAsNumber)}m`;
    }

    lower.oninput = function oninput() {
        const rawValue = lower.valueAsNumber;
        const clampedValue = MathUtils.clamp(rawValue, lower.min, upper.valueAsNumber - 1);
        lower.valueAsNumber = clampedValue;
        callback(lower.valueAsNumber, upper.valueAsNumber);
        instance.notifyChange();
        updateLabels();
    };

    upper.oninput = function oninput() {
        const rawValue = upper.valueAsNumber;
        const clampedValue = MathUtils.clamp(rawValue, lower.valueAsNumber + 1, upper.max);
        upper.valueAsNumber = clampedValue;
        callback(lower.valueAsNumber, upper.valueAsNumber);
        instance.notifyChange();
        updateLabels();
    };
}

bindColorMapBounds((min, max) => {
    material.colorMap.min = min;
    material.colorMap.max = max;
});

const colorMapGroup = document.getElementById('colormapGroup');

document.getElementById('pointcloud_mode').addEventListener('change', e => {
    const newMode = parseInt(e.target.value, 10);
    material.mode = newMode;

    if (newMode === MODE.ELEVATION) {
        colorMapGroup.classList.remove('d-none');
    } else {
        colorMapGroup.classList.add('d-none');
    }

    instance.notifyChange(pointcloud, true);
    if (colorLayer) {
        colorLayer.visible = newMode === MODE.TEXTURE;
        instance.notifyChange(colorLayer, true);
    }
});

document.getElementById('colormap').addEventListener('change', e => {
    const newRamp = e.target.value;
    material.colorMap.colors = colorRamps[newRamp];
    instance.notifyChange(pointcloud, true);
});
