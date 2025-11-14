/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import * as FunctionCurveEditor from 'function-curve-editor';
import XYZ from 'ol/source/XYZ.js';
import { DoubleSide, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import ColorMapMode from '@giro3d/giro3d/core/ColorMapMode.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindButton } from './widgets/bindButton.js';
import { bindColorMapBounds } from './widgets/bindColorMapBounds.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const extent = Extent.fromCenterAndSize(
    CoordinateSystem.epsg3857,
    { x: 697313, y: 5591324 },
    30000,
    30000,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null, // To make the canvas transparent
});

const cameraPosition = new Vector3(697119, 5543639, 53043);

instance.view.camera.position.copy(cameraPosition);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = extent.centerAsVector3();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.saveState();
instance.view.setControls(controls);

const elevationMin = 780;
const elevationMax = 3574;

let parameters = {
    ramp: 'viridis',
    discrete: false,
    invert: false,
    mirror: false,
    backgroundOpacity: 1,
    transparencyCurveKnots: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
    ],
    enableColorMap: true,
    layerType: 'elevation',
    colors: makeColorRamp('viridis', false, false, false),
    min: elevationMin,
    max: elevationMax,
    mode: ColorMapMode.Elevation,
};

function updatePreview(colors) {
    /** @type {HTMLCanvasElement} */
    // @ts-expect-error conversion
    const canvas = document.getElementById('gradient');
    const ctx = canvas.getContext('2d');

    canvas.width = colors.length;
    canvas.height = 1;

    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(i, 0, 1, canvas.height);
    }
}

updatePreview(parameters.colors);

// Adds the map that will contain the layers.
const map = new Map({
    extent,
    backgroundColor: 'cyan',
    side: DoubleSide,
    lighting: {
        enabled: true,
        elevationLayersOnly: true,
    },
});
instance.add(map);

const key =
    'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ';
const source = new TiledImageSource({
    format: new MapboxTerrainFormat(),
    source: new XYZ({
        url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
        projection: extent.crs.id,
        crossOrigin: 'anonymous',
    }),
});

const backgroundLayer = new ColorLayer({
    name: 'background',
    extent,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            projection: extent.crs.id,
            crossOrigin: 'anonymous',
        }),
    }),
});

const elevationLayer = new ElevationLayer({
    name: 'elevation',
    extent,
    source,
    colorMap: new ColorMap({
        colors: parameters.colors,
        min: elevationMin,
        max: elevationMax,
        mode: ColorMapMode.Elevation,
    }),
});

const colorLayer = new ColorLayer({
    name: 'color',
    extent,
    source,
    colorMap: new ColorMap({
        colors: parameters.colors,
        min: elevationMin,
        max: elevationMax,
        mode: ColorMapMode.Elevation,
    }),
});

map.addLayer(elevationLayer);

let activeLayer = elevationLayer;

function updateColorRamp() {
    parameters.colors = makeColorRamp(
        parameters.ramp,
        parameters.discrete,
        parameters.invert,
        parameters.mirror,
    );
    activeLayer.colorMap.colors = parameters.colors;
    activeLayer.colorMap.min = parameters.min;
    activeLayer.colorMap.max = parameters.max;
    activeLayer.colorMap.mode = parameters.mode;

    updateTransparency();

    updatePreview(parameters.colors);

    instance.notifyChange(map);
}

const [setEnableColorMap] = bindToggle('enable', v => {
    elevationLayer.visible = true;
    colorLayer.visible = true;
    backgroundLayer.visible = true;

    if (activeLayer.type === 'ColorLayer') {
        activeLayer.visible = v;
    } else {
        activeLayer.colorMap.active = v;
    }
    instance.notifyChange(map);
});
const [setDiscrete] = bindToggle('discrete', v => {
    parameters.discrete = v;
    updateColorRamp();
});
const [setInvert] = bindToggle('invert', v => {
    parameters.invert = v;
    updateColorRamp();
});
const [setMirror] = bindToggle('mirror', v => {
    parameters.mirror = v;
    updateColorRamp();
});
const [setRamp] = bindDropDown('ramp', v => {
    parameters.ramp = v;
    updateColorRamp();
});
function setActiveLayers(...layers) {
    map.removeLayer(colorLayer);
    map.removeLayer(elevationLayer);
    map.removeLayer(backgroundLayer);

    for (const layer of layers) {
        map.addLayer(layer);
    }
    activeLayer = layers[layers.length - 1];
}
const [setLayerType] = bindDropDown('layerType', v => {
    switch (v) {
        case 'elevation':
            setActiveLayers(elevationLayer);
            break;
        case 'color':
            setActiveLayers(colorLayer);
            break;
        case 'color+background':
            setActiveLayers(backgroundLayer, colorLayer);
            break;
        case 'color+background+elevation':
            setActiveLayers(elevationLayer, backgroundLayer, colorLayer);
            break;
    }
    updateColorRamp();
    instance.notifyChange(map);
});
const [setBackgroundOpacity] = bindSlider('backgroundOpacity', v => {
    map.backgroundOpacity = v;
    instance.notifyChange(map);
});
const updateBounds = bindColorMapBounds((min, max) => {
    parameters.min = min;
    parameters.max = max;
    activeLayer.colorMap.min = min;
    activeLayer.colorMap.max = max;
    instance.notifyChange(map);
});

const [setMode] = bindDropDown('mode', v => {
    const numerical = Number.parseInt(v);
    switch (numerical) {
        case ColorMapMode.Elevation:
            parameters.mode = ColorMapMode.Elevation;
            updateBounds(elevationMin, elevationMax);
            break;
        case ColorMapMode.Slope:
            parameters.mode = ColorMapMode.Slope;
            updateBounds(0, 90);
            break;
        case ColorMapMode.Aspect:
            parameters.mode = ColorMapMode.Aspect;
            updateBounds(0, 360);
            break;
    }

    updateColorRamp();
    instance.notifyChange(map);
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
    activeLayer.colorMap.opacity = opacities;
}

function setupTransparencyCurve(knots = undefined) {
    // Curve editor
    const initialKnots = knots ?? [
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

setupTransparencyCurve();

function applyPreset(preset) {
    parameters = { ...preset };

    setupTransparencyCurve(preset.transparencyCurveKnots);
    setBackgroundOpacity(preset.backgroundOpacity);
    setRamp(preset.ramp);
    setEnableColorMap(preset.enableColorMap);
    setDiscrete(preset.discrete);
    setInvert(preset.invert);
    setMirror(preset.mirror);
    setMode(preset.mode);
    setLayerType(preset.layerType);
    updateBounds(preset.min, preset.max);
    updateColorRamp();

    instance.notifyChange(map);
}

const [setPreset] = bindDropDown('preset', preset => {
    switch (preset) {
        case 'elevation':
            applyPreset({
                ramp: 'viridis',
                transparencyCurveKnots: [
                    { x: 0, y: 1 },
                    { x: 1, y: 1 },
                ],
                backgroundOpacity: 1,
                enableColorMap: true,
                discrete: false,
                mirror: false,
                invert: false,
                layerType: 'elevation',
                colors: makeColorRamp('viridis', false, false, false),
                opacity: new Array(256).fill(1),
                min: elevationMin,
                max: elevationMax,
                mode: ColorMapMode.Elevation,
            });
            break;

        case 'elevation+transparency':
            applyPreset({
                ramp: 'jet',
                transparencyCurveKnots: [
                    { x: 0, y: 0.5 },
                    { x: 0.4, y: 0.5 },
                    { x: 0.401, y: 0 },
                    { x: 1, y: 0 },
                ],
                backgroundOpacity: 1,
                enableColorMap: true,
                discrete: false,
                mirror: false,
                invert: false,
                layerType: 'color+background+elevation',
                colors: makeColorRamp('jet', false, false, false),
                min: elevationMin,
                max: elevationMax,
                mode: ColorMapMode.Elevation,
            });
            break;

        case 'southern-slope':
            applyPreset({
                ramp: 'rdbu',
                transparencyCurveKnots: [
                    { x: 0, y: 0 },
                    { x: 0.4, y: 0 },
                    { x: 0.401, y: 1 },
                    { x: 0.6, y: 1 },
                    { x: 0.601, y: 0 },
                    { x: 1, y: 0 },
                ],
                backgroundOpacity: 1,
                enableColorMap: true,
                discrete: false,
                mirror: true,
                invert: false,
                layerType: 'color+background+elevation',
                colors: makeColorRamp('rdbu', false, false, false),
                min: 0,
                max: 360,
                mode: ColorMapMode.Aspect,
            });
            break;

        case 'flat-terrain':
            applyPreset({
                ramp: 'jet',
                transparencyCurveKnots: [
                    { x: 0, y: 1 },
                    { x: 0.3, y: 1 },
                    { x: 0.6, y: 0 },
                    { x: 1, y: 0 },
                ],
                backgroundOpacity: 1,
                enableColorMap: true,
                discrete: false,
                mirror: false,
                invert: true,
                layerType: 'color+background+elevation',
                colors: makeColorRamp('jet', false, false, false),
                min: 0,
                max: 35,
                mode: ColorMapMode.Slope,
            });
            break;
    }
});

function resetToDefaults() {
    setPreset('elevation');
}

bindButton('reset', resetToDefaults);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

// For some reason, not waiting a bit causes the curve editor to be blank on Firefox
setTimeout(resetToDefaults, 100);
