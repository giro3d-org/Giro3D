/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import WmsSource from '@giro3d/giro3d/sources/WmsSource.js';

import StatusBar from './widgets/StatusBar.js';

const xmin = 247363;
const xmax = 269056;
const ymin = 6243739;
const ymax = 6259105;

const extent = new Extent(CoordinateSystem.epsg3857, xmin, xmax, ymin, ymax);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

const map = new Map({ extent });

instance.add(map);

const satelliteSource = new WmsSource({
    url: 'https://data.geopf.fr/wms-r',
    projection: 'EPSG:3857',
    layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
    imageFormat: 'image/jpeg',
});

const colorLayer = new ColorLayer({
    name: 'satellite',
    source: satelliteSource,
    extent: map.extent,
});

map.addLayer(colorLayer);

const demSource = new WmsSource({
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    imageFormat: 'image/x-bil;bits=32',
    url: 'https://data.geopf.fr/wms-r',
    projection: 'EPSG:3857',
    format: new BilFormat(),
    noDataValue: -1000,
});

const elevationLayer = new ElevationLayer({
    name: 'dem',
    resolutionFactor: 1 / 8,
    extent: map.extent,
    source: demSource,
});

map.addLayer(elevationLayer);

const camera = instance.view.camera;

const cameraAltitude = 2000;

const cameraPosition = new Vector3(extent.minX, extent.minY, cameraAltitude);

camera.position.copy(cameraPosition);

const controls = new MapControls(camera, instance.domElement);

controls.target = extent.centerAsVector3();

controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;

controls.saveState();

instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

function synchronizeIframe(coordinates) {
    const position = coordinates.as(CoordinateSystem.epsg4326);

    // This reloads the whole iframe :(
    // @ts-expect-error src only exists on Iframes
    document.getElementById('panoramax-iframe').src =
        `https://explore.panoramax.fr/en/index?s=fm;s2;m17/${position.latitude}/${position.longitude};vd;udefault`;
    // If the iframe supports messages, we can update the position via
    // [Window: postMessage() method](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
    // and potentially use the same synchronization method as the minimap example
}

instance.viewport.addEventListener('dblclick', e => {
    const picked = instance.pickObjectsAt(e, {
        limit: 1,
    });
    if (picked.length > 0 && 'coord' in picked[0]) {
        synchronizeIframe(picked[0].coord);
    }
});

synchronizeIframe(
    new Coordinates(instance.coordinateSystem, controls.target.x, controls.target.y, 0),
);
