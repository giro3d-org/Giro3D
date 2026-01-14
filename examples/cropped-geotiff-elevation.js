/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';

import StatusBar from './widgets/StatusBar.js';

const extent = Extent.fromCenterAndSize(
    CoordinateSystem.epsg3857,
    { x: -13555565, y: 5919254 },
    20000,
    20000,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

instance.view.camera.position.set(-13577183, 5907053, 45050);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(-13557038, 5920026, 0);
instance.view.setControls(controls);

const map = new Map({
    extent,
    backgroundColor: 'gray',
    lighting: true,
});

instance.add(map);

// Use an elevation COG with nodata values
const source = new GeoTIFFSource({
    // https://www.sciencebase.gov/catalog/item/632a9a9ad34e71c6d67b95a3
    url: 'https://3d.oslandia.com/cog_data/COG_EPSG3857_USGS_13_n47w122_20220919.tif',
    crs: extent.crs,
});

const min = 263;
const max = 4347;

map.addLayer(
    new ElevationLayer({
        name: 'elevation',
        extent,
        source,
        preloadImages: false,
        minmax: { min, max },
    }),
);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
