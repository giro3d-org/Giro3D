/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import StadiaMaps from 'ol/source/StadiaMaps.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.epsg3857;
const mapExtent = Extent.fromCenterAndSize(crs, { x: 256227, y: 5882214 }, 2000000, 2000000);

const instance = new Instance({
    target: 'view',
    crs,
});

instance.view.camera.position.set(256227, 5882214, 4000000);

const map = new Map({ extent: mapExtent, backgroundOpacity: 0 });

instance.add(map);

const layerSize = 1000000;

const watercolor = new ColorLayer({
    name: 'watercolor',
    extent: Extent.fromCenterAndSize(crs, { x: -100000, y: 6169226 }, layerSize, layerSize),
    source: new TiledImageSource({
        source: new StadiaMaps({ layer: 'stamen_watercolor', wrapX: false }),
    }),
});

const toner = new ColorLayer({
    name: 'toner',
    extent: Extent.fromCenterAndSize(crs, { x: 500000, y: 5669226 }, layerSize, layerSize),
    source: new TiledImageSource({
        source: new StadiaMaps({ layer: 'stamen_toner', wrapX: false }),
    }),
});

const terrain = new ColorLayer({
    name: 'terrain',
    extent: Extent.fromCenterAndSize(crs, { x: 900000, y: 5169226 }, layerSize, layerSize),
    source: new TiledImageSource({
        source: new StadiaMaps({ layer: 'stamen_terrain', wrapX: false }),
    }),
});

map.addLayer(watercolor);
map.addLayer(toner);
map.addLayer(terrain);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

const layers = {
    watercolor,
    toner,
    terrain,
};

function bindUI(layer) {
    const id = layer.name;
    const btnUp = document.getElementById(`btn-${id}-up`);
    const btnDown = document.getElementById(`btn-${id}-down`);
    const layerElt = document.getElementById(`${id}`);
    const container = layerElt.parentNode;

    function reorder() {
        [...container.children]
            .sort((a, b) => (map.getIndex(layers[a.id]) > map.getIndex(layers[b.id]) ? -1 : 1))
            .forEach(node => container.appendChild(node));
    }

    btnUp.onclick = () => {
        map.moveLayerUp(layer);
        reorder();
    };
    btnDown.onclick = () => {
        map.moveLayerDown(layer);
        reorder();
    };

    reorder();
}

bindUI(watercolor);
bindUI(toner);
bindUI(terrain);
