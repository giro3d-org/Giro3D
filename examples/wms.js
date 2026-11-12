/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import Instance from '@giro3d/giro3d/core/Instance';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import Map from '@giro3d/giro3d/entities/Map';
import Inspector from '@giro3d/giro3d/gui/Inspector';
import WmsSource from '@giro3d/giro3d/sources/WmsSource';

import { bindDropDown } from './widgets/bindDropDown';
import StatusBar from './widgets/StatusBar';

const epsg3857 = CoordinateSystem.epsg3857;

const instance = new Instance({
    crs: epsg3857,
    target: 'view',
});

const extent = Extent.fromCenterAndSize(
    CoordinateSystem.epsg3857,
    { x: 260000, y: 6251379 },
    32000,
    32000,
);

const map = new Map({
    extent,
});

instance.add(map).then(() => {
    const pov = new Vector3(260304, 6250939, 17182);
    // Note, the +1 ensures that the camera is not perfectly vertical, which causes gimbal locks.
    const lookAt = new Vector3(pov.x, pov.y + 1, 0);
    instance.view.camera.position.copy(pov);
    instance.view.camera.lookAt(lookAt);
    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(lookAt);
    instance.view.setControls(controls);

    // This layer has the same coordinate system as our scene,
    // meaning that no reprojection will be done by Giro3D, as the
    // reprojection is done by the WMS server. This provides the best visual quality.
    const wmsLayerInEpsg3857 = new ColorLayer({
        name: 'WMS in EPSG:3857',
        source: new WmsSource({
            url: 'https://data.geopf.fr/wms-r/wms',
            layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
            projection: 'EPSG:3857',
        }),
    });

    // This layer has a different coordinate system than our scene,
    // meaning that a reprojection must be done by Giro3D, with a slight
    // loss of visual quality.
    const wmsLayerInEpsg2154 = new ColorLayer({
        name: 'WMS in EPSG:2154',
        source: new WmsSource({
            url: 'https://data.geopf.fr/wms-r/wms',
            layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
            projection: 'EPSG:2154',
        }),
    });

    // Finally, this layer also has a different coordinate system,
    // but expressed in geographic coordinates rather than being a
    // projected coordinate system. This is used to ensure that the
    // WMS requests handle the axis ordering properly.
    const wmsLayerInEpsg4326 = new ColorLayer({
        name: 'WMS in EPSG:4326',
        source: new WmsSource({
            url: 'https://data.geopf.fr/wms-r/wms',
            layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
            projection: 'EPSG:4326',
        }),
    });

    map.addLayer(wmsLayerInEpsg3857);
    map.addLayer(wmsLayerInEpsg2154);
    map.addLayer(wmsLayerInEpsg4326);

    wmsLayerInEpsg3857.visible = true;
    wmsLayerInEpsg2154.visible = false;
    wmsLayerInEpsg4326.visible = false;

    bindDropDown('source', source => {
        wmsLayerInEpsg2154.visible = false;
        wmsLayerInEpsg3857.visible = false;
        wmsLayerInEpsg4326.visible = false;

        switch (source) {
            case '2154':
                wmsLayerInEpsg2154.visible = true;
                break;
            case '3857':
                wmsLayerInEpsg3857.visible = true;
                break;
            case '4326':
                wmsLayerInEpsg4326.visible = true;
                break;
        }

        instance.notifyChange(map);
    });

    StatusBar.bind(instance);
});

Inspector.attach('inspector', instance);
