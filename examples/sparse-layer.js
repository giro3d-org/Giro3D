/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { DoubleSide } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';

import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.register(
    'EPSG:26910',
    '+proj=utm +zone=10 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const extent = new Extent(crs, 532622, 569790, 5114416, 5137240);

const center = extent.centerAsVector3();

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 'gray',
});

instance.view.camera.position.set(center.x, center.y - 1, 50000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(center.x, center.y, center.z);
instance.view.setControls(controls);

const source = new GeoTIFFSource({
    url: 'https://3d.oslandia.com/dem/msh2009dem.tif',
    crs: extent.crs,
});

const map = new Map({
    extent,
    side: DoubleSide,
    showOutline: true,
});

instance.add(map);

const min = 227;
const max = 2538;

const layer = new ColorLayer({
    source,
    showEmptyTextures: true,
    interpretation: Interpretation.CompressTo8Bit(min, max),
});

map.addLayer(layer);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
