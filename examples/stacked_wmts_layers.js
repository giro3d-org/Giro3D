/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import AggregateImageSource from '@giro3d/giro3d/sources/AggregateImageSource.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';

import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.epsg3857;
const lowerLeft = new Coordinates(crs, -571790, 5144751);
const upperRight = new Coordinates(crs, 961225, 6577787);
const extent = new Extent(crs, lowerLeft.x, upperRight.x, lowerLeft.y, upperRight.y);
const center = extent.centerAsVector3();

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

instance.view.camera.position.set(center.x, center.y - 1, 5_000_000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.copy(extent.centerAsVector3());
instance.view.setControls(controls);

const map = new Map({ extent, backgroundColor: 'gray' });

instance.add(map);

// Define WMTS layers
const wmtsLayers = [
    { layer: 'TRANSPORTNETWORKS.ROADS', imageFormat: 'image/png', zIndex: 2 },
    { layer: 'ADMINEXPRESS-COG.LATEST', imageFormat: 'image/png', zIndex: 1 },
    { layer: 'ORTHOIMAGERY.ORTHOPHOTOS.BDORTHO', imageFormat: 'image/jpeg', zIndex: 0 },
];

/** @type {WmtsSource[]} */
let sources = [];

/** @type {AggregateImageSource} */
let aggregateSource;

async function loadLayers() {
    const capabilities =
        'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

    const promises = wmtsLayers
        // Sort by z-index so that they appear in the correct order in the stack
        .sort((a, b) => a.zIndex - b.zIndex)
        .map(({ layer, imageFormat }) =>
            // Create a WMTS source from the layer name
            WmtsSource.fromCapabilities(capabilities, { layer, imageFormat }),
        );

    sources = await Promise.all(promises);

    // Let's build the aggregate source that combines all WMTS sources
    aggregateSource = new AggregateImageSource({ sources });

    await map.addLayer(new ColorLayer({ source: aggregateSource }));

    for (let i = 0; i < wmtsLayers.length; i++) {
        const name = wmtsLayers[i].layer;
        // Bind the example GUI to each source
        bindToggle(name, show => aggregateSource.setSourceVisibility(sources[i], show));
    }
}

loadLayers();

// Attach the inspector
Inspector.attach('inspector', instance);

StatusBar.bind(instance);
