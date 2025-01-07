import * as FunctionCurveEditor from 'function-curve-editor';

import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import PointCloudMaterial, { MODE } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';
import Tiles3DSource from '@giro3d/giro3d/sources/Tiles3DSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

import { bindToggle } from './widgets/bindToggle.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindButton } from './widgets/bindButton.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import { bindColorMapBounds } from './widgets/bindColorMapBounds.js';

Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 ' +
        '+y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:3946',
    backgroundColor: null, // To make canvas transparent
});

// Enable point cloud post processing effects
instance.renderingOptions.enableEDL = true;
// But not inpainting and occlusion because it would hinder the opacity filtering
instance.renderingOptions.enableInpainting = false;
instance.renderingOptions.enablePointCloudOcclusion = false;

// Create a custom material for our point cloud.
const material = new PointCloudMaterial({ mode: MODE.INTENSITY });

material.colorMap.min = 0;
material.colorMap.max = 30;
material.colorMap.colors = makeColorRamp('greys');

let parameters = {
    ramp: 'greys',
    discrete: false,
    invert: false,
    colors: makeColorRamp('greys', false, false),
    opacity: new Array(256).fill(1),
    min: 0,
    max: 30,
};

const url = 'https://3d.oslandia.com/giro3d/3d-tiles/lidarhd_intensity/tileset.json';

// Create the 3D tiles entity
const pointcloud = new Tiles3D(new Tiles3DSource(url), {
    material,
});

function placeCamera(position, lookAt) {
    instance.view.camera.position.set(position.x, position.y, position.z);
    instance.view.camera.lookAt(lookAt);
    // create controls
    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(lookAt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    instance.view.setControls(controls);

    instance.notifyChange(instance.view.camera);
}

const tmpVec3 = new Vector3();

// add pointcloud to scene
function initializeCamera() {
    const bbox = pointcloud.root.boundingVolume.box
        .clone()
        .applyMatrix4(pointcloud.root.matrixWorld);

    instance.view.camera.far = 2.0 * bbox.getSize(tmpVec3).length();

    const lookAt = bbox.getCenter(tmpVec3);
    lookAt.z = bbox.min.z;

    placeCamera(new Vector3(221965, 6873398, 1951), lookAt);

    StatusBar.bind(instance);
}

instance.add(pointcloud).then(initializeCamera);

Inspector.attach('inspector', instance);

function updatePreview(colors) {
    /** @type {HTMLCanvasElement} */
    // @ts-expect-error conversion
    const canvas = document.getElementById('gradient');
    const ctx = canvas.getContext('2d');

    canvas.width = colors.length;
    canvas.height = 32;

    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(i, 0, 1, canvas.height);
    }
}

updatePreview(parameters.colors);

function updateColorRamp() {
    parameters.colors = makeColorRamp(parameters.ramp, parameters.discrete, parameters.invert);
    material.colorMap.colors = parameters.colors;
    material.colorMap.min = parameters.min;
    material.colorMap.max = parameters.max;
    material.colorMap.mode = parameters.mode;

    updateTransparency();

    updatePreview(parameters.colors);

    instance.notifyChange(pointcloud);
}

const [setDiscrete] = bindToggle('discrete', v => {
    parameters.discrete = v;
    updateColorRamp();
});
const [setInvert] = bindToggle('invert', v => {
    parameters.invert = v;
    updateColorRamp();
});
const [setRamp] = bindDropDown('ramp', v => {
    parameters.ramp = v;
    updateColorRamp();
    instance.notifyChange(pointcloud);
});
const updateBounds = bindColorMapBounds((min, max) => {
    material.colorMap.min = min;
    material.colorMap.max = max;
    instance.notifyChange(pointcloud);
});

const canvas = document.getElementById('curve');
// @ts-expect-error conversion
const widget = new FunctionCurveEditor.Widget(canvas);

function updateTransparency() {
    const length = parameters.colors.length;
    const f = widget.getFunction();
    const opacities = new Array(length);
    for (let i = 0; i < length; i++) {
        const t = i / length;
        opacities[i] = f(t);
    }
    parameters.opacity = opacities;
    material.colorMap.opacity = opacities;
}

function setupCurveEditor() {
    // Curve editor
    const initialKnots = [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
    ];

    widget.setEditorState({
        knots: initialKnots,
        xMin: -0.2,
        xMax: 1.2,
        yMin: -0.2,
        yMax: 1.2,
        interpolationMethod: 'linear',
        extendedDomain: true,
        relevantXMin: 0,
        relevantXMax: 1,
        gridEnabled: true,
    });

    widget.addEventListener('change', () => {
        updateColorRamp();
    });
}

setupCurveEditor();

function resetToDefaults() {
    setupCurveEditor();

    setRamp('greys');
    setDiscrete(false);
    setInvert(false);
    updateBounds(0, 30);

    parameters = {
        ramp: 'greys',
        discrete: false,
        invert: false,
        colors: makeColorRamp('greys', false, false),
        opacity: new Array(256).fill(1),
        min: 0,
        max: 30,
    };

    material.colorMap.active = true;

    updateColorRamp();

    instance.notifyChange(pointcloud);
}

bindButton('reset', resetToDefaults);

const labelElement = document.createElement('div');
labelElement.classList.value = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';

const intensityValue = document.createElement('span');
intensityValue.style.marginLeft = '0.5rem';

const intensityColor = document.createElement('span');
intensityColor.classList.value = 'badge rounded-pill';
intensityColor.style.color = 'white';
intensityColor.style.background = 'red';
intensityColor.style.width = '1rem';
intensityColor.innerText = ' ';

labelElement.appendChild(intensityColor);
labelElement.appendChild(intensityValue);

const label = new CSS2DObject(labelElement);

instance.add(label);

// Let's query the intensity of the picked point and display it in the label.
function updateLabel(mouseEvent) {
    const results = instance.pickObjectsAt(mouseEvent, { radius: 6 });

    // Reset label visibility
    label.visible = false;

    if (results && results.length > 0) {
        for (const result of results) {
            const { object, point, index } = result;

            // @ts-expect-error typing
            if (object.isPointCloud) {
                // @ts-expect-error typing
                const intensity = object.getIntensity(index);

                if (intensity) {
                    const color = material.colorMap.sample(intensity);
                    const opacity = material.colorMap.sampleOpacity(intensity);

                    if (opacity > 0.5) {
                        const hex = color.getHexString();
                        intensityColor.style.background = `#${hex}`;

                        intensityValue.innerText = `${intensity.toFixed(2)}`;

                        label.visible = true;
                        label.position.copy(point);
                        label.updateMatrixWorld(true);

                        break;
                    }
                }
            }
        }
    }

    instance.notifyChange();
}

instance.domElement.addEventListener('mousemove', updateLabel);

// For some reason we have to wait a bit in order to the curve editor to display properly on Firefox.
setTimeout(resetToDefaults, 100);
