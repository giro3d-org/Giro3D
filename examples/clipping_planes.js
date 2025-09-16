/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    Box3,
    Box3Helper,
    BoxGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    Plane,
    Vector3,
} from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import DrawTool from '@giro3d/giro3d/interactions/DrawTool.js';
import { MODE } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import StatusBar from './widgets/StatusBar.js';

import { bindButton } from './widgets/bindButton.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.fromEpsg(2154),
});

instance.renderingOptions.enableEDL = true;

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;

instance.view.setControls(controls);

const pointCloud = new Tiles3D({
    url: 'https://3d.oslandia.com/lidar_hd/tileset.json',
    pointCloudMode: MODE.ELEVATION,
    colorMap: new ColorMap({ colors: makeColorRamp('rdbu').reverse(), min: 200, max: 1800 }),
});

instance.add(pointCloud);

/**
 * @type {Plane[]}
 */
let planes = null;

let boxSize = 3000;

/**
 * @param {Box3} box The box
 */
function getPlanesFromBoxSides(box) {
    const result = [];

    // Notice that when the plane has a positive normal, the distance to the box must be negated
    result.push(new Plane(new Vector3(0, 0, +1), -box.min.z));
    result.push(new Plane(new Vector3(0, 0, -1), +box.max.z));
    result.push(new Plane(new Vector3(+1, 0, 0), -box.min.x));
    result.push(new Plane(new Vector3(-1, 0, 0), +box.max.x));
    result.push(new Plane(new Vector3(0, +1, 0), -box.min.y));
    result.push(new Plane(new Vector3(0, -1, 0), +box.max.y));

    return result;
}

const extent = new Extent(
    CoordinateSystem.fromEpsg(2154),
    902000.3307342547,
    927999.9889373797,
    6444999.999618538,
    6466999.990463264,
);
const options = {
    showHelper: true,
    enableClippingPlanes: true,
    applyOnMap: false,
    showMap: true,
    applyOnPointCloud: true,
    showPointCloud: true,
    mode: 'slice',
};

// create a map
const map = new Map({
    extent,
    lighting: false,
    discardNoData: true,
    side: DoubleSide,
});
instance.add(map);

const noDataValue = -1000;

const capabilitiesUrl =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue,
})
    .then(elevationWmts => {
        map.addLayer(
            new ElevationLayer({
                name: 'wmts_elevation',
                extent: map.extent,
                // We don't need the full resolution of terrain because we are not using any shading
                resolutionFactor: 0.25,
                minmax: { min: 0, max: 5000 },
                noDataOptions: {
                    replaceNoData: false,
                },
                source: elevationWmts,
            }),
        );
    })
    .catch(console.error);

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        map.addLayer(
            new ColorLayer({
                name: 'wmts_orthophotos',
                extent: map.extent,
                source: orthophotoWmts,
            }),
        );
    })
    .catch(console.error);

const box3 = new Box3();
const center = map.extent.centerAsVector2();
const boxCenter = new Vector3(center.x, center.y, 800);

const volumeHelpers = new Group();
instance.scene.add(volumeHelpers);

/** @type {Box3Helper} */
let helper;
/** @type {Mesh} */
let box;

const helperMaterial = new MeshBasicMaterial({
    color: 'yellow',
    opacity: 0.1,
    transparent: true,
});

function deleteBox() {
    box?.geometry?.dispose();
    box?.removeFromParent();
    helper?.dispose();
    helper?.removeFromParent();
}

function generateBoxHelper() {
    deleteBox();

    box3.setFromCenterAndSize(boxCenter, new Vector3(boxSize, boxSize, boxSize));
    const boxGeometry = new BoxGeometry(boxSize, boxSize, boxSize);
    box = new Mesh(boxGeometry, helperMaterial);
    helper = new Box3Helper(box3, 'yellow');
    box.renderOrder = 2;
    volumeHelpers.add(helper);
    volumeHelpers.add(box);
    box.position.copy(boxCenter);
    box.updateMatrixWorld();
    helper.updateMatrixWorld();
    volumeHelpers.updateMatrixWorld();
}

// refresh scene
instance.notifyChange(instance.view.camera);

function update() {
    volumeHelpers.visible = options.showHelper && options.enableClippingPlanes;
    map.visible = options.showMap;
    pointCloud.visible = options.showPointCloud;
    map.clippingPlanes = options.enableClippingPlanes && options.applyOnMap ? planes : null;
    pointCloud.clippingPlanes =
        options.enableClippingPlanes && options.applyOnPointCloud ? planes : null;
    instance.notifyChange();
}

const updateFromBox = () => {
    generateBoxHelper();
    planes = getPlanesFromBoxSides(box3);

    update();
};

let currentSegment;

bindDropDown('mode', mode => {
    options.mode = mode;
    const volumeOptions = document.getElementById('volume-options');
    const sliceOptions = document.getElementById('slice-options');

    volumeOptions.style.display = 'block';
    sliceOptions.style.display = 'block';

    switch (mode) {
        case 'slice':
            volumeOptions.style.display = 'none';
            planes = [];
            deleteBox();
            update();
            break;
        case 'volume':
            sliceOptions.style.display = 'none';
            if (currentSegment) {
                instance.remove(currentSegment);
                currentSegment = null;
            }
            updateFromBox();
            break;
    }
});

const drawTool = new DrawTool({ instance });
drawTool.addEventListener('start-drag', () => (controls.enabled = false));
drawTool.addEventListener('end-drag', () => (controls.enabled = true));
drawTool.enterEditMode();

bindButton('draw', () => {
    const plane = new Plane();

    if (currentSegment) {
        instance.remove(currentSegment);
        currentSegment = null;
    }

    const updatePlanes = shape => {
        if (shape && shape.points.length === 2) {
            const a = shape.points[0];
            const b = shape.points[1];
            const c = shape.points[1].clone().setZ(b.z + 100);

            plane.setFromCoplanarPoints(a, b, c);

            planes = [plane];

            update();
        }
    };

    drawTool
        .createSegment({
            onTemporaryPointMoved: updatePlanes,
            afterUpdatePoint: ({ shape }) => updatePlanes(shape),
        })
        .then(shape => {
            currentSegment = shape;
            updatePlanes(shape);
        });
});

bindToggle('toggle-show-volume', v => {
    options.showHelper = v;
    updateFromBox();
});

bindToggle('toggle-pointcloud', v => {
    options.applyOnPointCloud = v;
    update();
});

bindToggle('toggle-show-pointcloud', v => {
    options.showPointCloud = v;
    update();
});

bindToggle('toggle-show-map', v => {
    options.showMap = v;
    update();
});

bindToggle('toggle-map', v => {
    options.applyOnMap = v;
    update();
});

bindSlider('slider-size', v => {
    boxSize = v;
    updateFromBox();
});

// Configure camera
const lookAt = new Vector3(915833, 6455879, 121);
instance.view.camera.position.set(909914, 6448629, 7925);
instance.view.camera.lookAt(lookAt);
controls.target.copy(lookAt);
controls.saveState();

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
