/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import AxisGrid from '@giro3d/giro3d/entities/AxisGrid.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';

import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(CoordinateSystem.epsg3857, 2285900, 2444000, 4230900, 4386100);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg3857,
    backgroundColor: null, // Make the canvas transparent
});

const map = new Map({
    extent,
    lighting: true,
});
instance.add(map);

const source = new GeoTIFFSource({
    url: 'https://3d.oslandia.com/giro3d/rasters/bathymetry-emodnet.cog.tif',
    crs: CoordinateSystem.epsg3857,
});

const min = -5200;
const max = -900;

const axisGrid = new AxisGrid({
    volume: {
        extent,
        floor: min,
        ceiling: 0,
    },
    ticks: {
        x: 20_000,
        y: 20_000,
        z: 500,
    },
});

instance.add(axisGrid);

const colorMap = new ColorMap({
    colors: makeColorRamp('bathymetry'),
    min,
    max,
    mode: ColorMapMode.Elevation,
});

map.addLayer(
    new ElevationLayer({
        name: 'bathymetry',
        extent,
        source,
        colorMap: colorMap,
        minmax: { min, max },
    }),
);

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.2;

const center = extent.centerAsVector2();

instance.view.camera.position.set(2195551, 4146310, 90_000);
controls.target.set(center.x, center.y, min);

instance.view.setControls(controls);

// Attach the inspector
Inspector.attach('inspector', instance);

StatusBar.bind(instance);

const labelElement = document.createElement('span');
labelElement.classList.value = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';
const label = new CSS2DObject(labelElement);

label.visible = false;
instance.add(label);

function pick(mouseEvent) {
    const picked = instance.pickObjectsAt(mouseEvent, { where: [map] });

    if (picked.length > 0) {
        label.visible = true;
        const point = picked[0].point;
        label.element.innerText = `depth: ${Math.round(point.z)}m`;
        label.position.copy(point);
        label.updateMatrixWorld(true);
    } else {
        label.visible = false;
    }
    instance.notifyChange();
}

instance.domElement.addEventListener('mousemove', pick);
