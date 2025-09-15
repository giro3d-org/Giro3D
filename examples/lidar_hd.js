/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { CubeTextureLoader, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import { MODE } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const tmpVec3 = new Vector3();

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.fromEpsg(2154),
});

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
instance.view.setControls(controls);

const pointcloud = new Tiles3D({
    url: 'https://3d.oslandia.com/lidar_hd/tileset.json',
    errorTarget: 15,
    pointCloudMode: MODE.TEXTURE,
});

// add pointcloud to scene
/**
 * @param {Tiles3D} entity
 */
function initializeCameraPosition(entity) {
    const bbox = entity.getBoundingBox();

    // configure camera
    instance.view.camera.far = 2.0 * bbox.getSize(tmpVec3).length();

    const ratio = bbox.getSize(tmpVec3).x / bbox.getSize(tmpVec3).z;
    const position = bbox.min
        .clone()
        .add(bbox.getSize(tmpVec3).multiply(new Vector3(0, 0, ratio * 0.5)));
    const lookAt = bbox.getCenter(tmpVec3);
    lookAt.z = bbox.min.z;
    instance.view.camera.position.set(position.x, position.y, position.z);
    instance.view.camera.lookAt(lookAt);
    controls.target.copy(lookAt);
    controls.saveState();

    // Let's build the color layer from the WMTS capabilities
    const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';
    WmtsSource.fromCapabilities(url, {
        layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
    })
        .then(orthophotoWmts => {
            pointcloud.setColorLayer(
                new ColorLayer({
                    name: 'color',
                    extent: Extent.fromBox3(CoordinateSystem.fromEpsg(2154), bbox),
                    source: orthophotoWmts,
                }),
            );
        })
        .catch(console.error);

    instance.renderingOptions.enableEDL = true;
    instance.renderingOptions.enableInpainting = true;
    instance.renderingOptions.enablePointCloudOcclusion = true;

    // refresh scene
    instance.notifyChange(instance.view.camera);
}
instance.add(pointcloud).then(initializeCameraPosition);

// add a skybox background
const cubeTextureLoader = new CubeTextureLoader();
cubeTextureLoader.setPath('image/skyboxsun25deg_zup/');
const cubeTexture = cubeTextureLoader.load([
    'px.jpg',
    'nx.jpg',
    'py.jpg',
    'ny.jpg',
    'pz.jpg',
    'nz.jpg',
]);

instance.scene.background = cubeTexture;

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
