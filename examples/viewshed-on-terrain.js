/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Feature } from 'ol';
import { Circle } from 'ol/geom';
import { Stroke, Style } from 'ol/style';
import * as THREE from 'three';
import { MapControls, TextureHelper } from 'three/examples/jsm/Addons.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import Instance from '@giro3d/giro3d/core/Instance';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer';
import Map from '@giro3d/giro3d/entities/Map';
import Shape from '@giro3d/giro3d/entities/Shape';
import BilFormat from '@giro3d/giro3d/formats/BilFormat';
import Inspector from '@giro3d/giro3d/gui/Inspector';
import Viewshed, { ViewshedMode } from '@giro3d/giro3d/interactions/Viewshed';
import VectorSource from '@giro3d/giro3d/sources/VectorSource';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource';

import { bindColorPicker } from './widgets/bindColorPicker';
import { bindDropDown } from './widgets/bindDropDown';
import { bindNumberInput } from './widgets/bindNumberInput';
import { bindNumericalDropDown } from './widgets/bindNumericalDropDown';
import { bindToggle } from './widgets/bindToggle';
import StatusBar from './widgets/StatusBar';

const epsg2154 = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
CoordinateSystem.register(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const instance = new Instance({
    crs: epsg2154,
    backgroundColor: '#726c69',
    target: 'view',
});

let observerHeight = 2;
const originition = new THREE.Vector3(0, 10, 4);
const observerDirection = new THREE.Vector3(1, 0, 0);
let showVisibilityTexture = true;

const mapCenter = Coordinates.WGS84(45.060788037641615, 6.035092778309895);
const { x, y } = mapCenter.as(epsg2154);
const mapExtent = Extent.fromCenterAndSize(epsg2154, { x, y }, 15_000, 15_000);

const map = new Map({
    extent: mapExtent,
    lighting: { enabled: true },
    side: THREE.DoubleSide,
    terrain: {
        enabled: true,
        // This is one of the scenarios where a very high resolution terrain is useful.
        // Since viewshed works on the mesh itself, we want the highest fidelity to the original
        // elevation data.
        segments: 128,
    },
    backgroundColor: 'white',
});

const viewshed = new Viewshed({
    instance,
    objects: [map],
    minDistance: 100,
    maxDistance: 1000,
    frustumFov: 30,
    occludedColor: new THREE.Vector4(0, 0, 0, 0),
});

const circle = new Circle([0, 0], viewshed.maxDistance);
const feature = new Feature(circle);

/** @type {ColorLayer} */
let vectorLayer;

const circleSource = new VectorSource({
    data: [feature],
    style: new Style({
        stroke: new Stroke({
            color: 'yellow',
            width: 2,
        }),
    }),
});

instance.add(map).then(async () => {
    const url = 'https://3d.oslandia.com/giro3d/cache/wmts/ign.xml';

    // Let's build the elevation layer from the WMTS capabilities
    await WmtsSource.fromCapabilities(url, {
        layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
        format: new BilFormat(),
        noDataValue: -1000,
    })

        .then(elevationWmts => {
            map.addLayer(
                new ElevationLayer({
                    name: 'elevation',
                    extent: map.extent,
                    minmax: { min: 500, max: 4000 },
                    noDataOptions: {
                        replaceNoData: false,
                    },
                    source: elevationWmts,
                }),
            );
        })
        .catch(console.error);

    // Let's build the color layer from the WMTS capabilities
    await WmtsSource.fromCapabilities(url, {
        layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
    })
        .then(orthophotoWmts => {
            map.addLayer(
                new ColorLayer({
                    name: 'color',
                    extent: map.extent,
                    source: orthophotoWmts,
                }),
            );
        })
        .catch(console.error);

    vectorLayer = new ColorLayer({ source: circleSource });

    map.addLayer(vectorLayer);
});

const controls = new MapControls(instance.view.camera, instance.domElement);

instance.view.camera.position.set(x, y, 40_000);
controls.target.set(x, y, 0);

instance.view.setControls(controls);

const observer = new Shape({
    showVertices: true,
    showVerticalLines: true,
    showFloorVertices: true,
});

instance.add(observer);

/** @type {TextureHelper} */
let textureHelper = new TextureHelper(viewshed.getTexture(), 1, 1, 1);
instance.add(textureHelper);

function updateTextureHelper() {
    if (textureHelper) {
        textureHelper.dispose();
        textureHelper.removeFromParent();
    }
    textureHelper = new TextureHelper(viewshed.getTexture(), 1, 1, 1);
    textureHelper.material.side = THREE.BackSide;
    instance.add(textureHelper);
    textureHelper.visible = showVisibilityTexture;
}

instance.domElement.addEventListener('mousemove', e => {
    const pickResults = instance.pickObjectsAt(e);
    if (pickResults.length > 0) {
        const point = pickResults[0].point;
        const floorZ = point.z;

        point.setZ(point.z + observerHeight);

        originition.copy(point);

        observer.setPoints([point]);
        observer.floorElevation = floorZ;
        circle.setCenterAndRadius([point.x, point.y], viewshed.maxDistance);
        circleSource.update(map.extent);
    }
});

const setMode = (/** @type {string} */ mode) => {
    if (mode === 'cubemap') {
        viewshed.mode = ViewshedMode.Omnidirectional;
    } else if (mode === 'frustum') {
        viewshed.mode = ViewshedMode.Frustum;
    }
    updateTextureHelper();
    instance.notifyChange();
};
const setTextureSize = (/** @type {string} */ size) => {
    viewshed.textureSize = parseInt(size, 10);
    updateTextureHelper();
    instance.notifyChange();
};
const setMaxDistance = (/** @type {number} */ d) => {
    viewshed.maxDistance = d;
    instance.notifyChange();
};
const setMinDistance = (/** @type {number} */ d) => {
    viewshed.minDistance = d;
    instance.notifyChange();
};
const setBias = (/** @type {number} */ bias) => {
    viewshed.bias = bias;
    instance.notifyChange();
};
const setVisibleColor = (/** @type {THREE.ColorRepresentation} */ v) => {
    const col = new THREE.Color(v);
    viewshed.visibleColor = new THREE.Vector4(col.r * 255, col.g * 255, col.b * 255, 0.5);
    instance.notifyChange();
};
const setObserverHeight = (/** @type {number} */ height) => {
    observerHeight = height;
    instance.notifyChange();
};
const setCameraAzimuth = (/** @type {number} */ az) => {
    const euler = new THREE.Euler(0, 0, THREE.MathUtils.degToRad(-az));
    const dir = new THREE.Vector3(0, 1, 0);
    dir.applyEuler(euler);
    observerDirection.copy(dir);
    instance.notifyChange();
};
const setTerrainResolution = (/** @type {number} */ res) => {
    map.segments = res;
    instance.notifyChange(map);
};
const setShowTexture = (/** @type {boolean} */ show) => {
    showVisibilityTexture = show;
    textureHelper.visible = show;
};
const setShowCircle = (/** @type {boolean} */ show) => {
    if (vectorLayer) {
        vectorLayer.visible = show;
        instance.notifyChange(vectorLayer);
    }
};
setMode(bindDropDown('mode', setMode)[1]);
setTextureSize(bindDropDown('texture-size', setTextureSize)[1]);
setVisibleColor(bindColorPicker('visible-color', setVisibleColor)[1]);
setMaxDistance(bindNumberInput('max-distance', setMaxDistance)[1]);
setMinDistance(bindNumberInput('min-distance', setMinDistance)[1]);
setObserverHeight(bindNumberInput('observer-height', setObserverHeight)[1]);
setBias(bindNumberInput('bias', setBias)[1]);
setCameraAzimuth(bindNumberInput('camera-azimuth', setCameraAzimuth)[1]);
setTerrainResolution(bindNumericalDropDown('terrain-resolution', setTerrainResolution)[1]);
setShowTexture(bindToggle('show-texture', setShowTexture)[1]);
setShowCircle(bindToggle('show-circle', setShowCircle)[1]);

function updateTextureHelperPosition() {
    if (textureHelper) {
        textureHelper.texture = viewshed.getTexture();

        if (viewshed.mode === ViewshedMode.Omnidirectional) {
            textureHelper.position.copy(originition);
            textureHelper.material.side = THREE.BackSide;
            textureHelper.scale.set(20_000, 20_000, 20_000);
        } else {
            textureHelper.material.side = THREE.DoubleSide;
            textureHelper.position.copy(
                originition.clone().addScaledVector(observerDirection, viewshed.maxDistance),
            );
            textureHelper.quaternion.copy(new THREE.Quaternion());
            textureHelper.rotateX(Math.PI / 2);

            textureHelper.lookAt(originition);
            const dist = viewshed.maxDistance;
            const halfFov = viewshed.frustumFov / 2;

            const width = Math.sin(halfFov) * dist;

            const height = width * (1 / viewshed.frustumAspect);
            textureHelper.scale.set(width * 2, height * 2, 1);
        }

        textureHelper.updateMatrixWorld();
    }
}

instance.addEventListener('after-render', () => {
    viewshed.origin = originition;
    viewshed.direction = observerDirection;

    updateTextureHelperPosition();

    viewshed.render();
});

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
