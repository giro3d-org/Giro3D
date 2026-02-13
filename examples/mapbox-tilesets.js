/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import XYZ from 'ol/source/XYZ.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(CoordinateSystem.epsg3857, 659030, 735596, 5535152, 5647497);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg3857,
});

const map = new Map({ extent });

instance.add(map);

async function addLayers(key) {
    const layers = map.getLayers();
    for (const current of layers) {
        map.removeLayer(current);
    }

    // Adds a XYZ elevation layer with MapBox terrain RGB tileset
    const elevationLayer = new ElevationLayer({
        name: 'xyz_elevation',
        extent,
        // We dont want the full resolution because the terrain
        // mesh has a much lower resolution than the raster image
        resolutionFactor: 1 / 8,
        source: new TiledImageSource({
            format: new MapboxTerrainFormat(),
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
                projection: extent.crs.id,
                crossOrigin: 'anonymous',
            }),
        }),
    });
    await map.addLayer(elevationLayer);

    // Adds a XYZ color layer with MapBox satellite tileset
    const satelliteLayer = new ColorLayer({
        name: 'xyz_color',
        extent,
        source: new TiledImageSource({
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
                projection: extent.crs.id,
                crossOrigin: 'anonymous',
            }),
        }),
    });
    await map.addLayer(satelliteLayer);
}

// Create our elevation layer using Giro3D's default mapbox api key
addLayers(
    'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ',
).catch(console.error);

instance.view.camera.position.set(extent.maxX, extent.minY, 2000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = extent.centerAsVector3();
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

document.getElementById('mapboxApi').addEventListener('submit', e => {
    e.preventDefault();
    // @ts-expect-error typing
    addLayers(document.getElementById('mapboxApiKey').value);
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
