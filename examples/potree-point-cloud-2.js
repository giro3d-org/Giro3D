/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Color } from 'three';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';
import Potree2Source from '@giro3d/giro3d/sources/Potree2Source.js';

import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindProgress } from './widgets/bindProgress.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { formatPointCount } from './widgets/formatPointCount.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import { placeCameraOnTop } from './widgets/placeCameraOnTop.js';
import StatusBar from './widgets/StatusBar.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

// Some Potree datasets contain LAZ files.
// LAS processing requires the WebAssembly laz-perf library
// This path is specific to your project, and must be set accordingly.
setLazPerfPath('/assets/wasm');

const instance = new Instance({
    crs: CoordinateSystem.epsg3857,
    target: 'view',
});

const entity = new PointCloud({
    source: new Potree2Source({
        url: 'http://files.home.local/potree/v2/out/metadata.json',
    }),
});

instance.add(entity).then(() => {
    instance.view.goTo(entity);
});

const controls = new MapControls(instance.view.camera, instance.domElement);

instance.view.setControls(controls);

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
