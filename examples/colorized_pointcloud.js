/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import { MODE } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import StatusBar from './widgets/StatusBar.js';

import { bindColorMapBounds } from './widgets/bindColorMapBounds.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindNumericalDropDown } from './widgets/bindNumericalDropDown.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';

const colorRamps = {};

function makeColorRamps() {
    colorRamps.viridis = makeColorRamp('viridis');
    colorRamps.jet = makeColorRamp('jet');
    colorRamps.blackbody = makeColorRamp('blackbody');
    colorRamps.earth = makeColorRamp('earth');
    colorRamps.bathymetry = makeColorRamp('bathymetry');
    colorRamps.magma = makeColorRamp('magma');
    colorRamps.par = makeColorRamp('par');

    colorRamps.slope = makeColorRamp('RdBu');
}

makeColorRamps();

const tmpVec3 = new Vector3();

Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 ' +
        '+y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.fromEpsg(3946),
    backgroundColor: 0xcccccc,
});

// Create the 3D tiles entity
const pointcloud = new Tiles3D({
    url: 'https://3d.oslandia.com/3dtiles/lyon.3dtiles/tileset.json',
    colorMap: new ColorMap({ colors: colorRamps['viridis'], min: 100, max: 600 }),
    errorTarget: 15,
});

let colorLayer;

function placeCamera(position, lookAt) {
    instance.view.camera.position.set(position.x, position.y, position.z);
    instance.view.camera.lookAt(lookAt);
    // create controls
    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(lookAt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    instance.view.setControls(controls);

    instance.notifyChange(instance.view.camera);
}

// add pointcloud to scene
function initializeCamera() {
    const bbox = pointcloud.getBoundingBox();

    instance.view.camera.far = 2.0 * bbox.getSize(tmpVec3).length();

    const ratio = bbox.getSize(tmpVec3).x / bbox.getSize(tmpVec3).z;
    const position = bbox.min
        .clone()
        .add(bbox.getSize(tmpVec3).multiply(new Vector3(0, 0, ratio * 0.5)));
    const lookAt = bbox.getCenter(tmpVec3);
    lookAt.z = bbox.min.z;

    const extent = Extent.fromBox3(CoordinateSystem.fromEpsg(3946), bbox);

    placeCamera(position, lookAt);

    const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

    // Let's build the color layer from the WMTS capabilities
    WmtsSource.fromCapabilities(url, {
        layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
    })
        .then(orthophotoWmts => {
            colorLayer = new ColorLayer({
                name: 'color',
                extent,
                source: orthophotoWmts,
            });
            pointcloud.setColorLayer(colorLayer);
        })
        .catch(console.error);

    instance.renderingOptions.enableEDL = true;
    instance.renderingOptions.enableInpainting = true;
    instance.renderingOptions.enablePointCloudOcclusion = true;

    pointcloud.pointCloudMode = MODE.TEXTURE;

    StatusBar.bind(instance);
}

instance.add(pointcloud).then(initializeCamera);

Inspector.attach('inspector', instance);
instance.domElement.addEventListener('dblclick', e =>
    console.log(
        instance.pickObjectsAt(e, {
            // Specify a radius around where we click so we don't have to precisely be on a point
            // to select it
            radius: 5,
            // Limit the number of results for better performances
            limit: 10,
            // Some points are incoherent in the pointcloud, don't pick them
            filter: p => !Number.isNaN(p.point.z) && p.point.z < 1000,
        }),
    ),
);

instance.notifyChange();

bindToggle('edl-enable', v => {
    instance.renderingOptions.enableEDL = v;
    instance.notifyChange();
});
bindToggle('occlusion-enable', v => {
    instance.renderingOptions.enablePointCloudOcclusion = v;
    instance.notifyChange();
});
bindToggle('inpainting-enable', v => {
    instance.renderingOptions.enableInpainting = v;
    instance.notifyChange();
});
bindSlider('edl-radius', v => {
    instance.renderingOptions.EDLRadius = v;
    instance.notifyChange();
});
bindSlider('edl-intensity', v => {
    instance.renderingOptions.EDLStrength = v;
    instance.notifyChange();
});
bindSlider('inpainting-steps', v => {
    instance.renderingOptions.inpaintingSteps = v;
    instance.notifyChange();
});
bindSlider('opacity', v => {
    pointcloud.opacity = v;
    document.getElementById('opacityLabel').innerText =
        `Point cloud opacity: ${Math.round(v * 100)}%`;
    instance.notifyChange(pointcloud);
});

bindColorMapBounds((min, max) => {
    pointcloud.colorMap.min = min;
    pointcloud.colorMap.max = max;
    instance.notifyChange(pointcloud);
});

const colorMapGroup = document.getElementById('colormapGroup');

bindNumericalDropDown('pointcloud_mode', newMode => {
    pointcloud.pointCloudMode = newMode;

    if (newMode === MODE.ELEVATION) {
        colorMapGroup.classList.remove('d-none');
    } else {
        colorMapGroup.classList.add('d-none');
    }

    instance.notifyChange(pointcloud);
    if (colorLayer) {
        colorLayer.visible = newMode === MODE.TEXTURE;
        instance.notifyChange(colorLayer);
    }
});

bindDropDown('colormap', newRamp => {
    pointcloud.colorMap.colors = colorRamps[newRamp];
    instance.notifyChange(pointcloud);
});
