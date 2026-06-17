/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { VideoTexture, PlaneGeometry, Mesh, MeshBasicMaterial, DoubleSide } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

const crs = CoordinateSystem.register(
    'EPSG:32615',
    `
    PROJCRS["WGS 84 / UTM zone 15N",
    BASEGEOGCRS["WGS 84",
        ENSEMBLE["World Geodetic System 1984 ensemble",
            MEMBER["World Geodetic System 1984 (Transit)"],
            MEMBER["World Geodetic System 1984 (G730)"],
            MEMBER["World Geodetic System 1984 (G873)"],
            MEMBER["World Geodetic System 1984 (G1150)"],
            MEMBER["World Geodetic System 1984 (G1674)"],
            MEMBER["World Geodetic System 1984 (G1762)"],
            MEMBER["World Geodetic System 1984 (G2139)"],
            MEMBER["World Geodetic System 1984 (G2296)"],
            ELLIPSOID["WGS 84",6378137,298.257223563,
                LENGTHUNIT["metre",1]],
            ENSEMBLEACCURACY[2.0]],
        PRIMEM["Greenwich",0,
            ANGLEUNIT["degree",0.0174532925199433]],
        ID["EPSG",4326]],
    CONVERSION["UTM zone 15N",
        METHOD["Transverse Mercator",
            ID["EPSG",9807]],
        PARAMETER["Latitude of natural origin",0,
            ANGLEUNIT["degree",0.0174532925199433],
            ID["EPSG",8801]],
        PARAMETER["Longitude of natural origin",-93,
            ANGLEUNIT["degree",0.0174532925199433],
            ID["EPSG",8802]],
        PARAMETER["Scale factor at natural origin",0.9996,
            SCALEUNIT["unity",1],
            ID["EPSG",8805]],
        PARAMETER["False easting",500000,
            LENGTHUNIT["metre",1],
            ID["EPSG",8806]],
        PARAMETER["False northing",0,
            LENGTHUNIT["metre",1],
            ID["EPSG",8807]]],
    CS[Cartesian,2],
        AXIS["(E)",east,
            ORDER[1],
            LENGTHUNIT["metre",1]],
        AXIS["(N)",north,
            ORDER[2],
            LENGTHUNIT["metre",1]],
    USAGE[
        SCOPE["Navigation and medium accuracy spatial referencing."],
        AREA["Between 96°W and 90°W, northern hemisphere between equator and 84°N, onshore and offshore. Canada - Manitoba; Nunavut; Ontario. Ecuador -Galapagos. Guatemala. Mexico. United States (USA)."],
        BBOX[0,-96,84,-90]],
    ID["EPSG",32615]]`,
);

const instance = new Instance({
    target: 'view',
    crs,
    backgroundColor: null,
});

Inspector.attach('inspector', instance);

const video = document.getElementById('traffic-feed-mp4');

if (!(video instanceof HTMLVideoElement)) {
    throw new Error('Expected a video');
}

const texture = new VideoTexture(video);
// Create the material
const movieMaterial = new MeshBasicMaterial({
    map: texture,
    color: 0xffffffff,
    side: DoubleSide,
    toneMapped: false,
});

const movieGeometry = new PlaneGeometry(10, 10);
const movieScreen = new Mesh(movieGeometry, movieMaterial);
movieScreen.position.set(576715, 5188162, 200);
movieScreen.updateMatrixWorld();

instance.add(movieScreen).catch(console.error);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.saveState();
instance.view.setControls(controls);

const animate = () => {
    texture.needsUpdate = true;
    instance.notifyChange();
    requestAnimationFrame(animate);
};

requestAnimationFrame(animate);
