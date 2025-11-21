/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { get as getProjection } from 'ol/proj.js';
import { TileWMS } from 'ol/source.js';
import { Vector2, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import { bindColorPicker } from './widgets/bindColorPicker.js';
import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20048966.1,
    20048966.1,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 'black',
});
const camPos = new Vector3(258767.3, 6247882.8, 6872.5);
instance.view.camera.position.set(camPos.x, camPos.y, camPos.z);

const controls = new MapControls(instance.view.camera, instance.domElement);
instance.view.setControls(controls);

controls.target.set(camPos.x, camPos.y + 1, 0);

const map = new Map({
    extent,
    backgroundColor: 'gray',
    maxSubdivisionLevel: 19,
    lighting: {
        enabled: true,
        zFactor: 8,
    },
    terrain: false,
});
instance.add(map);

const capabilitiesUrl =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

const wmsLayer = new ColorLayer({
    name: 'museums',
    source: new TiledImageSource({
        httpTimeout: 10000,
        source: new TileWMS({
            url: 'https://data.geopf.fr/wms-v/wms?SERVICE=WMS&VERSION=1.3.0',
            params: { LAYERS: 'POI.MUSEUM', TILED: true },
            crossOrigin: 'anonymous',
            projection: getProjection('EPSG:3857'),
        }),
    }),
});

async function initializeWmts() {
    const orthophotoWmts = await WmtsSource.fromCapabilities(capabilitiesUrl, {
        layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
    });

    const layer = new ColorLayer({
        name: 'orthophotos',
        extent: map.extent,
        source: orthophotoWmts,
    });
    layer.userData.zOrder = 0;

    await Promise.all([map.addLayer(layer), map.addLayer(wmsLayer)]);

    const [setColor, _, colorPicker] = bindColorPicker('color', () => {});

    instance.domElement.addEventListener('pointermove', event => {
        const canvasCoords = instance.eventToCanvasCoords(event, new Vector2());

        const results = map.pick(canvasCoords);

        if (results && results.length > 0) {
            const point = results[0].point;
            const coordinates = new Coordinates(instance.coordinateSystem, point.x, point.y);

            const hit = wmsLayer.getPixel({ coordinates, size: 10 });

            if (hit && hit.length > 0) {
                setColor(hit[0]);
            }

            colorPicker.style.display = hit ? 'block' : 'none';
            instance.domElement.style.cursor = hit ? 'pointer' : '';
        } else {
            colorPicker.style.display = 'none';
            instance.domElement.style.cursor = '';
        }
    });
}

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
initializeWmts();
