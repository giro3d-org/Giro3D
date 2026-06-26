/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { VideoTexture, PlaneGeometry, Mesh, MeshBasicMaterial, DoubleSide } from 'three';
import { CSS2DObject } from 'three/examples/jsm/Addons.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

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
    target: 'view',
    crs: epsg2154,
    backgroundColor: null,
});

const center = new Coordinates(CoordinateSystem.epsg4326, 5.680029, 45.215664).as(
    instance.coordinateSystem,
);
const extent = Extent.fromCenterAndSize(epsg2154, { x: center.x, y: center.y }, 10_000, 10_000);

const map = new Map({
    extent,
    backgroundColor: 'gray',
    lighting: {
        enabled: true,
        hillshadeIntensity: 0.6,
        elevationLayersOnly: true,
    },
});
instance.add(map);

const capabilitiesUrl =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue: -1000,
})
    .then(source => {
        map.addLayer(
            new ElevationLayer({
                extent: map.extent,
                resolutionFactor: 1 / 8,
                minmax: { min: 500, max: 1500 },
                source: source,
            }),
        );
    })
    .catch(console.error);

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(source => {
        map.addLayer(
            new ColorLayer({
                extent: map.extent,
                source: source,
            }),
        );
    })
    .catch(console.error);

instance.view.camera.position.set(914834, 6458031, 1812);
instance.view.camera.rotation.set(1.096239934839674, 0.9166476093340195, 0.38709570855793624);
instance.notifyChange(instance.view.camera);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target.set(910331, 6460940, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.saveState();
instance.view.setControls(controls);
StatusBar.bind(instance);

Inspector.attach('inspector', instance);

// Embed the video in ThreeJS
const video = document.getElementById('traffic-feed-mp4');
if (!(video instanceof HTMLVideoElement)) {
    throw new Error('Expected a video');
}

const texture = new VideoTexture(video);
const movieMaterial = new MeshBasicMaterial({
    map: texture,
    color: 0xffffffff,
    side: DoubleSide,
    toneMapped: false,
});

const movieGeometry = new PlaneGeometry(960, 540);
const movieScreen = new Mesh(movieGeometry, movieMaterial);
movieScreen.position.set(910331, 6460940, 550);
movieScreen.rotation.set(Math.PI / 2, 0.98, 0);
movieScreen.updateMatrixWorld();

instance.add(movieScreen).catch(console.error);

// Add a label for displaying the video's position
const labelElement = document.createElement('div');
labelElement.style.borderRadius = '50%';
labelElement.style.borderWidth = '2px';
labelElement.style.borderStyle = 'solid';
labelElement.style.width = '28px';
labelElement.style.height = '28px';
labelElement.style.textAlign = 'center';
labelElement.style.verticalAlign = 'middle';
labelElement.style.backgroundColor = 'orange';
labelElement.style.pointerEvents = 'auto';
labelElement.style.cursor = 'pointer';

const cameraSymbol = document.createElement('i');
cameraSymbol.classList.add('bi', 'bi-camera-video-fill', 'text-dark', 'shadow');

labelElement.appendChild(cameraSymbol);

labelElement.addEventListener('click', () => {
    movieScreen.visible = !movieScreen.visible;
});

const label = new CSS2DObject(labelElement);
label.visible = true;
label.position.set(910331, 6460940, 208);
label.updateMatrixWorld();
instance.add(label);

const animate = () => {
    // We need to notify changes for Giro3D to keep rendering
    instance.notifyChange();
    requestAnimationFrame(animate);
};

requestAnimationFrame(animate);
