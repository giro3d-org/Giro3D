/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import colormap from 'colormap';
import { Color, DoubleSide } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer';
import MaskLayer from '@giro3d/giro3d/core/layer/MaskLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';

import { bindNumericalDropDown } from './widgets/bindNumericalDropDown.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.register(
    'EPSG:26910',
    '+proj=utm +zone=10 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const extent = new Extent(crs, 532622, 569790, 5114416, 5137240);

const center = extent.centerAsVector3();

const instance = new Instance({
    target: 'view',
    crs,
    backgroundColor: null,
});

instance.view.camera.position.set(center.x, center.y - 1, 50000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(center.x, center.y, center.z);
instance.view.setControls(controls);

// Use an elevation COG with nodata values
const source = new GeoTIFFSource({
    // https://pubs.er.usgs.gov/publication/ds904
    url: 'https://3d.oslandia.com/dem/msh2009dem.tif',
    crs,
});

const values = colormap({ colormap: 'viridis', nshades: 256 });
const colors = values.map(v => new Color(v));

const min = 227;
const max = 2538;

const colorMap = new ColorMap({ colors, min, max, mode: ColorMapMode.Elevation });

const noDataOptions = {
    alpha: 0,
    maxSearchDistance: 10000,
    replaceNoData: true,
};

const map = new Map({
    extent,
    side: DoubleSide,
    backgroundOpacity: 0,
    lighting: true,
    discardNoData: true,
});

instance.add(map);

let elevationLayer;
let maskLayer;
let colorLayer;

let activeLayer = 0;

function updateActiveLayer() {
    elevationLayer.visible = false;
    maskLayer.visible = false;
    colorLayer.visible = false;

    switch (activeLayer) {
        case 0:
            elevationLayer.visible = true;
            map.backgroundOpacity = 0;
            map.discardNoData = true;
            break;
        case 1:
            maskLayer.visible = true;
            map.backgroundOpacity = 1;
            map.discardNoData = false;
            break;
        case 2:
        default:
            colorLayer.visible = true;
            map.backgroundOpacity = 0;
            map.discardNoData = false;
            break;
    }
}

function buildLayers() {
    map.removeLayer(elevationLayer);
    map.removeLayer(maskLayer);
    map.removeLayer(colorLayer);

    maskLayer = new MaskLayer({
        name: 'mask',
        extent,
        source,
        noDataOptions,
        preloadImages: false,
    });

    elevationLayer = new ElevationLayer({
        name: 'elevation',
        extent,
        source,
        noDataOptions,
        colorMap,
        preloadImages: false,
        minmax: { min, max },
    });

    colorLayer = new ColorLayer({
        name: 'color',
        extent,
        source,
        noDataOptions,
        colorMap,
        preloadImages: false,
    });

    map.addLayer(elevationLayer);
    map.addLayer(maskLayer);
    map.addLayer(colorLayer);

    updateActiveLayer();

    instance.notifyChange(map);
}

const [, , alphaReplacementInput] = bindNumericalDropDown('alphaReplacement', value => {
    noDataOptions.alpha = value;
    instance.notifyChange(map);
});

const [, , radiusSlider] = bindSlider('maxDistanceSlider', v => {
    noDataOptions.maxSearchDistance = v;
});

bindToggle('enableFillNoData', state => {
    noDataOptions.replaceNoData = state;
    if (!state) {
        radiusSlider.setAttribute('disabled', '');
        alphaReplacementInput.setAttribute('disabled', '');
    } else {
        radiusSlider.removeAttribute('disabled');
        alphaReplacementInput.removeAttribute('disabled');
    }
});

bindNumericalDropDown('noDataLayerSource', v => {
    activeLayer = v;
});

buildLayers();

document.getElementById('applyChanges').onclick = function onclick() {
    buildLayers();
};

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
