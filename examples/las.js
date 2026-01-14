/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';
import LASSource from '@giro3d/giro3d/sources/LASSource.js';

import { placeCameraOnTop } from './widgets/placeCameraOnTop.js';
import StatusBar from './widgets/StatusBar.js';

// LAS processing requires the WebAssembly laz-perf library
// This path is specific to your project, and must be set accordingly.
setLazPerfPath('/assets/wasm');

const url = 'https://3d.oslandia.com/giro3d/pointclouds/autzen-simplified.laz';

const crs = CoordinateSystem.register(
    'EPSG:2992',
    '+proj=lcc +lat_0=41.75 +lon_0=-120.5 +lat_1=43 +lat_2=45.5 +x_0=399999.9999984 +y_0=0 +ellps=GRS80 +nadgrids=us_noaa_WO.tif +units=ft +no_defs +type=crs',
);

const instance = new Instance({
    crs,
    target: 'view',
    backgroundColor: null,
});

async function load() {
    const source = new LASSource({ url });

    const entity = new PointCloud({ source });

    await instance.add(entity);

    entity.setActiveAttribute('Color');

    placeCameraOnTop(entity.getBoundingBox(), instance);
}

load().catch(console.error);

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
