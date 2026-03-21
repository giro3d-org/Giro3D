/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import XYZ from 'ol/source/XYZ.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import MapzenTerrariumFormat from '@giro3d/giro3d/formats/MapzenTerrariumFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const extent = Extent.webMercator;

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg3857,
});

const map = new Map({
    extent,
    lighting: {
        enabled: true,
        hillshadeIntensity: 1.5,
    },
});

instance.add(map);

// Adds a XYZ elevation layer with Mapzen terrain tileset
const elevationLayer = new ElevationLayer({
    extent,
    colorMap: new ColorMap({
        colors: makeColorRamp('viridis'),
        min: -5000,
        max: 7000,
    }),
    source: new TiledImageSource({
        format: new MapzenTerrariumFormat(),
        source: new XYZ({
            url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
            projection: extent.crs.id,
        }),
    }),
});

map.addLayer(elevationLayer);

const pov = instance.view.goTo(map);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target.copy(pov.target);
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
