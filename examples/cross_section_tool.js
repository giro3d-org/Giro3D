/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import XYZ from 'ol/source/XYZ.js';
import { AmbientLight, DirectionalLight, MathUtils, Vector2, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import { MapLightingMode } from '@giro3d/giro3d/entities/MapLightingOptions.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import CrossSectionTool from '@giro3d/giro3d/interactions/CrossSectionTool.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import { bindButton } from './widgets/bindButton.js';
import { bindButtonGroup } from './widgets/bindButtonGroup.js';
import { bindNumberInput } from './widgets/bindNumberInput.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

CoordinateSystem.register(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

// Chamonix Mont-Blanc coordinates
const poi = new Coordinates(CoordinateSystem.epsg4326, 6.8697, 45.9231)
    .as(CoordinateSystem.epsg3857)
    .toVector3();

const extentSize = 30_000;
const extent = Extent.fromCenterAndSize(
    CoordinateSystem.epsg3857,
    { x: poi.x, y: poi.y },
    extentSize,
    extentSize,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
    renderer: {
        // We will need to enable the stencil buffer to visualize the cross-section
        stencil: true,
    },
});

const center = extent.centerAsVector3();

const directionalLight = new DirectionalLight('white', 3);
const ambientLight = new AmbientLight('white', 1);

directionalLight.position.set(center.x - 5000, center.y - 2000, 10000);
directionalLight.target.position.copy(center);

instance.add(directionalLight);
instance.add(directionalLight.target);
instance.add(ambientLight);

directionalLight.updateMatrixWorld(true);
directionalLight.target.updateMatrixWorld(true);

const mapbox = new Map({
    extent,
    lighting: {
        enabled: true,
        mode: MapLightingMode.LightBased,
        elevationLayersOnly: true,
    },
    subdivisionThreshold: 1,
    terrain: {
        segments: 64,
        enabled: true,
        skirts: {
            enabled: true,
            depth: 0,
        },
    },
    backgroundColor: 'beige',
});

instance.add(mapbox);

const key =
    'pk.eyJ1IjoidG11Z3VldCIsImEiOiJjbGJ4dTNkOW0wYWx4M25ybWZ5YnpicHV6In0.KhDJ7W5N3d1z3ArrsDjX_A';

// Adds a XYZ elevation layer with MapBox terrain RGB tileset
const elevationLayer = new ElevationLayer({
    extent,
    preloadImages: true,
    resolutionFactor: 0.5,
    minmax: { min: 5000, max: 9000 },
    source: new TiledImageSource({
        format: new MapboxTerrainFormat(),
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});
mapbox.addLayer(elevationLayer);

// Adds a XYZ color layer with MapBox satellite tileset
const satelliteLayer = new ColorLayer({
    extent,
    resolutionFactor: 1.5,
    preloadImages: true,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});
mapbox.addLayer(satelliteLayer);

const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

const ign = new Map({
    extent,
    lighting: {
        enabled: true,
        mode: MapLightingMode.LightBased,
        elevationLayersOnly: true,
    },
    subdivisionThreshold: 1,
    terrain: {
        segments: 64,
        enabled: true,
        skirts: {
            enabled: true,
            depth: 0,
        },
    },
    backgroundColor: 'blue',
});

instance.add(ign);

// Let's build the elevation layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue: -1000,
})
    .then(elevationWmts => {
        ign.addLayer(
            new ElevationLayer({
                name: 'elevation',
                extent: ign.extent,
                // We don't need the full resolution of terrain
                // because we are not using any shading. This will save a lot of memory
                // and make the terrain faster to load.
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

// Let's build the color layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        ign.addLayer(
            new ColorLayer({
                name: 'color',
                extent: ign.extent,
                source: orthophotoWmts,
            }),
        );
    })
    .catch(console.error);

instance.view.camera.position.set(poi.x - extentSize - 15000, poi.y - extentSize - 15000, 35_000);
instance.view.camera.lookAt(new Vector3(poi.x, poi.y, 2000));

Inspector.attach('inspector', instance);

const crossSectionTool = new CrossSectionTool({ instance });

crossSectionTool.setPlaneHelperSize(new Vector2(45_000, 9000));

crossSectionTool.add(mapbox);
crossSectionTool.add(ign, { negated: true });
crossSectionTool.setPlane(poi, new Vector3(0, 1, 0));

crossSectionTool.setControlMode('translate');

// TODO
// const controls = new MapControls(instance.view.camera, instance.domElement);
// controls.target.set(poi.x, poi.y, 2000);
// instance.view.setControls(controls);

instance.notifyChange();

StatusBar.bind(instance);

const [setMode] = bindButtonGroup('button-transform', index => {
    switch (index) {
        case 0:
            crossSectionTool.setControlMode('translate');
            break;
        case 1:
            crossSectionTool.setControlMode('rotate');
            break;
    }
});

const [showMapbox] = bindToggle('show-mapbox', show => {
    mapbox.visible = show;
    instance.notifyChange();
});

const [showIgn] = bindToggle('show-ign', show => {
    ign.visible = show;
    instance.notifyChange();
});

const [showPlane] = bindToggle('show-plane', show => {
    crossSectionTool.showPlaneHelper = show;
});

const [setAngleSnap] = bindNumberInput('angle-snap', v => {
    if (v !== 0) {
        crossSectionTool.controls.setRotationSnap(MathUtils.degToRad(v));
    } else {
        crossSectionTool.controls.setRotationSnap(null);
    }
});

const reset = () => {
    showPlane(true);
    showMapbox(true);
    showIgn(true);
    setMode(0);
    setAngleSnap(0);

    crossSectionTool.setPlane(poi, new Vector3(0, 1, 0));
};

bindButton('reset', () => {
    reset();
});

reset();

// import Instance from '@giro3d/giro3d/core/Instance';
// import {
//     AlwaysStencilFunc,
//     AmbientLight,
//     BackSide,
//     Clock,
//     DecrementWrapStencilOp,
//     DirectionalLight,
//     FrontSide,
//     IncrementWrapStencilOp,
//     KeepStencilOp,
//     Mesh,
//     MeshBasicMaterial,
//     MeshStandardMaterial,
//     NotEqualStencilFunc,
//     Plane,
//     PlaneGeometry,
//     PlaneHelper,
//     ReplaceStencilOp,
//     Scene,
//     SphereGeometry,
//     Vector3,
// } from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// const instance = new Instance({
//     crs: 'EPSG:3857',
//     target: 'view',
//     backgroundColor: null,
//     renderer: { stencil: true },
// });

// const position = new Vector3(0, 0, 0);

// const light = new DirectionalLight();

// light.position.set(-5, -2, 4);
// light.target.lookAt(position);
// instance.add(light);
// instance.add(light.target);

// const ambient = new AmbientLight('white', 0.3);

// instance.add(ambient);

// const controls = new OrbitControls(instance.view.camera, instance.domElement);
// controls.enableDamping = true;
// controls.dampingFactor = 0.25;

// instance.view.setControls(controls);

// instance.view.camera.position.set(-10, 0, 0);
// instance.view.camera.lookAt(position);

// function createStencilMeshes(baseMesh) {
//     const material = baseMesh.material;
//     const geometry = baseMesh.geometry;

//     const stencilBaseMat = new MeshBasicMaterial();
//     stencilBaseMat.depthWrite = false;
//     stencilBaseMat.depthTest = false;
//     stencilBaseMat.colorWrite = false;
//     stencilBaseMat.stencilWrite = true;
//     stencilBaseMat.stencilFunc = AlwaysStencilFunc;

//     const stencilBack = stencilBaseMat.clone();
//     stencilBack.side = BackSide;
//     stencilBack.clippingPlanes = material.clippingPlanes;
//     stencilBack.stencilFail = IncrementWrapStencilOp;
//     stencilBack.stencilZFail = IncrementWrapStencilOp;
//     stencilBack.stencilZPass = IncrementWrapStencilOp;

//     const stencilFront = stencilBaseMat.clone();
//     stencilFront.side = FrontSide;
//     stencilFront.clippingPlanes = material.clippingPlanes;
//     stencilFront.stencilFail = DecrementWrapStencilOp;
//     stencilFront.stencilZFail = DecrementWrapStencilOp;
//     stencilFront.stencilZPass = DecrementWrapStencilOp;

//     const meshBack = new Mesh(geometry, stencilBack);
//     const meshFront = new Mesh(geometry, stencilFront);

//     baseMesh.add(meshBack);
//     baseMesh.add(meshFront);
// }

// function makeSphere(plane) {
//     const geometry = new SphereGeometry(1, 64, 32);

//     const renderable = new Mesh(
//         geometry,
//         new MeshStandardMaterial({
//             color: 'gray',
//             side: FrontSide,
//             clippingPlanes: [plane],
//         }),
//     );

//     instance.add(renderable);

//     createStencilMeshes(renderable);

//     return renderable;
// }

// let distance = 0;

// const plane = new Plane(new Vector3(1, 0, 0), distance);

// const sphere = makeSphere(plane);

// const planeHelper = new PlaneHelper(plane, 5);

// instance.add(planeHelper);

// planeHelper.updateMatrixWorld(true);

// const planeMesh = new Mesh(
//     new PlaneGeometry(4, 4),
//     new MeshStandardMaterial({
//         color: 0xe91e63,
//         metalness: 0.1,
//         side: BackSide,
//         roughness: 0.75,

//         stencilWrite: true,
//         stencilRef: 0,
//         stencilFunc: NotEqualStencilFunc,
//         stencilFail: ReplaceStencilOp,
//         stencilZFail: ReplaceStencilOp,
//         stencilZPass: ReplaceStencilOp,
//     }),
// );

// planeMesh.renderOrder = 5;
// planeMesh.onAfterRender = renderer => renderer.clearStencil();

// instance.add(planeMesh);

// planeMesh.rotateY(Math.PI / 2);

// instance.scene.updateMatrixWorld(true);

// instance.notifyChange();

// const clock = new Clock();
// let t = 0;
// function animate() {
//     const speed = 0.5;
//     t += clock.getDelta() * speed;
//     distance = Math.sin(t);

//     planeMesh.position.setX(-distance);
//     plane.constant = distance;

//     instance.scene.updateMatrixWorld(true);
//     instance.render();
//     requestAnimationFrame(animate);
// }

// animate();
