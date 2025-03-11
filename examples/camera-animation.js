/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import XYZ from 'ol/source/XYZ.js';
import { CameraHelper, Color, DoubleSide, Fog, PerspectiveCamera, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/Addons.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import CameraAnimator from '@giro3d/giro3d/interactions/CameraAnimator.js';
import DrawTool from '@giro3d/giro3d/interactions/DrawTool.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const SKY_COLOR = '#87CEEB';
const size = 200_000;
const extent = Extent.fromCenterAndSize(crs, { x: 1_051_908, y: 6_542_409 }, size, size);

const instance = new Instance({
    target: 'view',
    crs,
    backgroundColor: SKY_COLOR,
});

const map = new Map({
    extent,
    lighting: {
        enabled: true,
        elevationLayersOnly: true,
    },
    side: DoubleSide,
    backgroundColor: 'gray',
});

instance.add(map);

const key =
    'pk.eyJ1IjoidG11Z3VldCIsImEiOiJjbGJ4dTNkOW0wYWx4M25ybWZ5YnpicHV6In0.KhDJ7W5N3d1z3ArrsDjX_A';

// Adds a XYZ elevation layer with MapBox terrain RGB tileset
const elevationLayer = new ElevationLayer({
    name: 'xyz_elevation',
    extent,
    resolutionFactor: 0.5,
    minmax: { min: 0, max: 5000 },
    source: new TiledImageSource({
        format: new MapboxTerrainFormat(),
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});
map.addLayer(elevationLayer);

// Adds a XYZ color layer with MapBox satellite tileset
const satelliteLayer = new ColorLayer({
    name: 'xyz_color',
    extent,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});
map.addLayer(satelliteLayer);

const start = new Vector3(994_410, 6_520_646, 5_520);
const middle = new Vector3(994_510, 6_520_646, 5_520);
const end = new Vector3(994_910, 6_521_646, 5_520);

instance.view.camera.position.copy(start);
instance.view.camera.lookAt(new Vector3(1_011_954, 6_539_864, 1_000));

const fog = new Fog(new Color(SKY_COLOR), 1000, 200_000);
instance.scene.fog = fog;

const camera = new PerspectiveCamera();
const helper = new CameraHelper(camera);
const animator = new CameraAnimator(instance.view.camera);

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.target.copy(new Vector3(1_011_954, 6_539_864, 1_000));

instance.view.setControls(controls);

instance.scene.add(helper);

// const path = [start, end];

// const shape = new Shape({ showLine: true, showVertices: true, color: 'yellow' });
// instance.add(shape);
// shape.setPoints(path);

// animator.setPath(path);
animator.setCameraOffset(new Vector3(0, 0, 500));
animator.setCameraOrientation('follow');
animator.addEventListener('update', () => {
    helper.update();
    helper.updateMatrixWorld(true);
    instance.notifyChange(map);
});

animator.speed = 500; // meters/second
// animator.play();

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

const drawTool = new DrawTool({ instance });

drawTool.createLineString({ color: 'yellow', depthTest: true }).then(shape => {
    animator.setPath(shape);

    instance.view.setControls(null);
    controls.dispose();

    animator.play();
});
