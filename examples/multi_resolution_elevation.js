/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import AggregateImageSource from '@giro3d/giro3d/sources/AggregateImageSource.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';

import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const CRS = CoordinateSystem.epsg3857;

const instance = new Instance({
    target: 'view',
    crs: CRS,
});

async function loadData() {
    // Let's load a single low-resolution SRTM tile
    const srtm = new GeoTIFFSource({
        url: 'https://3d.oslandia.com/giro3d/rasters/N46W123.cog.tif',
        crs: CRS,
    });
    // An a high-resolution DEM of Mount St Helens
    const highRes = new GeoTIFFSource({
        url: 'https://3d.oslandia.com/giro3d/rasters/msh2009dem-3857.tif',
        enableWorkers: false,
        crs: CRS,
    });

    // Let's initialize the SRTM dataset so that we can access its extent
    await srtm.initialize();

    await highRes.initialize();

    const map = new Map({
        extent: srtm.getExtent(),
        backgroundColor: 'gray',
        lighting: true,
    });
    instance.add(map);

    // Let's combine those two DEMs into a single source.
    // Note that the order in which the sub-sources appear in the array
    // dictates their z-index in the stack: make sure that the higher-resolution
    // sources appear after the lower resolution sources.
    // Important: All sources must share the same CRS.
    const aggregateSource = new AggregateImageSource({ sources: [srtm, highRes] });

    const min = 0;
    const max = 2500;

    const layer = new ElevationLayer({
        minmax: { min, max },
        colorMap: new ColorMap({ colors: makeColorRamp('viridis'), min, max }),
        source: aggregateSource,
    });

    await map.addLayer(layer);

    const center = new Coordinates(instance.coordinateSystem, -13601907, 5812324);
    instance.view.camera.position.set(center.x, center.y, 30_000);

    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    controls.target.set(center.x, center.y + 1, 0);
    instance.view.setControls(controls);

    // Attach the inspector
    Inspector.attach('inspector', instance);

    StatusBar.bind(instance);

    bindToggle('show-top-source', show => {
        aggregateSource.setSourceVisibility(highRes, show);
    });
    bindToggle('show-bottom-source', show => {
        aggregateSource.setSourceVisibility(srtm, show);
    });
}

loadData().catch(console.error);
