/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(CoordinateSystem.epsg3857, -551152, 876637, 5178404, 6631315);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 0x0a3b59,
});

const map = new Map({ extent });

instance.add(map);

// For convenience, we use the fromCapabilities() async method to construct a WmtsSource from
// a WMTS capabilities document.
WmtsSource.fromCapabilities(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities',
    {
        layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
        matrixSet: 'PM',
    },
)
    .then(source => {
        map.addLayer(new ColorLayer({ name: 'wmts', source }));
    })
    .catch(e => console.error(e));

const center = extent.centerAsVector2();
instance.view.camera.position.set(center.x, center.y - 1, 3_000_000);

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.target.set(center.x, center.y, 0);

instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
