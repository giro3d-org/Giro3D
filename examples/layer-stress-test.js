/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Color, MathUtils } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import DebugSource from '@giro3d/giro3d/sources/DebugSource.js';

import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 0x0a3b59,
});

instance.view.camera.position.set(0, 0, 25000000);

const controls = new MapControls(instance.view.camera, instance.domElement);

instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

function createColorLayer() {
    const source = new DebugSource({
        color: new Color().setHSL(Math.random(), 0.5, 0.5),
        extent,
        subdivisions: MathUtils.randInt(1, 4),
    });

    return new ColorLayer({ extent, source, showTileBorders: true });
}

let layerCount = 8;
let forceTextureAtlases = false;
/** @type {Map} */
let map = null;

function buildMapAndLayers() {
    if (map) {
        for (const layer of map.getLayers()) {
            map.removeLayer(layer, { disposeLayer: true });
        }
        instance.remove(map);
    }

    map = new Map({ extent, forceTextureAtlases });

    instance.add(map);

    for (let i = 0; i < layerCount; i++) {
        map.addLayer(createColorLayer());
    }
}

bindSlider('layerCount', count => {
    layerCount = count;
});

bindToggle('forceAtlases', force => {
    forceTextureAtlases = force;
});

document.getElementById('build').onclick = () => buildMapAndLayers();
