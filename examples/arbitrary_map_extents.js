/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import StadiaMaps from 'ol/source/StadiaMaps.js';
import { MathUtils, Object3D, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Helpers from '@giro3d/giro3d/helpers/Helpers.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindButton } from './widgets/bindButton.js';
import StatusBar from './widgets/StatusBar.js';

const EPSG3857_BOUNDS = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

let currentMap;

const instance = new Instance({
    target: 'view',
    crs: EPSG3857_BOUNDS.crs,
    backgroundColor: 0x0a3b59,
});

instance.view.camera.position.set(0, 0, 100000000);

const controls = new MapControls(instance.view.camera, instance.domElement);
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

instance.notifyChange();

const layers = ['stamen_watercolor', 'stamen_toner', 'stamen_terrain'];

let mapCount = 0;

// Create a grid that encompasses the whole EPSG:3857 bounds.
const grid = Helpers.createGrid(new Vector3(0, 0, -10000), EPSG3857_BOUNDS.dimensions().x, 20);
instance.threeObjects.add(grid);

function createMap(extent) {
    if (currentMap) {
        instance.remove(currentMap);
        currentMap = null;
    }

    mapCount++;

    const object3d = new Object3D();

    currentMap = new Map({
        extent,
        maxSubdivisionLevel: 10,
        object3d,
        showOutline: true,
    });

    currentMap.name = `${mapCount}`;

    currentMap.object3d.position.set(0, 0, mapCount * 10000);

    instance.add(currentMap);

    // Adds an TMS imagery layer
    const layer = layers[mapCount % layers.length];
    currentMap
        .addLayer(
            new ColorLayer({
                name: 'osm',
                extent,
                source: new TiledImageSource({ source: new StadiaMaps({ layer, wrapX: false }) }),
            }),
        )
        .catch(e => console.error(e));

    instance.notifyChange();
}

bindButton('createMap', () => {
    const dimensions = EPSG3857_BOUNDS.dimensions();

    const width = MathUtils.randFloat(dimensions.width * 0.5, dimensions.width * 0.1);
    const height = MathUtils.randFloat(dimensions.height * 0.5, dimensions.height * 0.1);
    const x = MathUtils.randFloat(-dimensions.width / 2, +dimensions.width / 2);
    const y = MathUtils.randFloat(-dimensions.height / 2, +dimensions.height / 2);

    const extent = Extent.fromCenterAndSize(
        CoordinateSystem.epsg3857,
        { x, y },
        width,
        height,
    ).intersect(EPSG3857_BOUNDS);

    createMap(extent);
});

StatusBar.bind(instance);
