/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import OrientedImageCollection from '@giro3d/giro3d/entities/OrientedImageCollection.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import COPCSource from '@giro3d/giro3d/sources/COPCSource.js';

import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

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

const pointCloud = new PointCloud({
    source: new COPCSource({
        url: 'https://3d.oslandia.com/giro3d/drone/brighton-beach/model.copc.laz',
    }),
});

instance.add(pointCloud).then(() => {
    const pov = instance.view.goTo(pointCloud);

    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    controls.target.copy(pov.target);
    controls.saveState();
    instance.view.setControls(controls);

    StatusBar.bind(instance);
});

const orientedImageCollection = new OrientedImageCollection({
    locationSpheres: {
        visible: true,
        radius: 0.5,
        color: 'red',
    },
    frustums: {
        visible: true,
        color: 'yellow',
    },
    images: {
        visible: true,
    },
    source: {
        images: [
            {
                position: { x: 576699.898987649, y: 5188128.736938151, z: 198.6 },
                distance: 10,
                aspectRatio: 1.77,
                fov: 47.6365,
                orientation: { heading: 44.2, pitch: -89.9, roll: 0 },
                imageUrl:
                    'https://3d.oslandia.com/giro3d/drone/brighton-beach/images/DJI_0030.webp',
            },
            {
                position: { x: 576709.723136936, y: 5188139.050652663, z: 198.7 },
                distance: 10,
                aspectRatio: 1.77,
                fov: 47.6365,
                orientation: { heading: 41.4, pitch: -89.9, roll: 0 },
                imageUrl:
                    'https://3d.oslandia.com/giro3d/drone/brighton-beach/images/DJI_0031.webp',
            },
            {
                position: { x: 576718.9197612616, y: 5188148.738897609, z: 198.6 },
                distance: 10,
                aspectRatio: 1.77,
                fov: 47.6365,
                orientation: { heading: 42.8, pitch: -89.9, roll: 0 },
                imageUrl:
                    'https://3d.oslandia.com/giro3d/drone/brighton-beach/images/DJI_0032.webp',
            },
            {
                position: { x: 576728.5399550111, y: 5188158.432584833, z: 198.6 },
                distance: 10,
                aspectRatio: 1.77,
                fov: 47.6365,
                orientation: { heading: 42, pitch: -89.9, roll: 2.3 },
                imageUrl:
                    'https://3d.oslandia.com/giro3d/drone/brighton-beach/images/DJI_0033.webp',
            },
            {
                position: { x: 576737.9483180544, y: 5188168.123573817, z: 198.5 },
                distance: 10,
                aspectRatio: 1.77,
                fov: 47.6365,
                orientation: { heading: 44.7, pitch: -89.9, roll: 0 },
                imageUrl:
                    'https://3d.oslandia.com/giro3d/drone/brighton-beach/images/DJI_0034.webp',
            },
            {
                position: { x: 576747.1448514065, y: 5188177.811863552, z: 198.5 },
                distance: 10,
                aspectRatio: 1.77,
                fov: 47.6365,
                orientation: { heading: 45.3, pitch: -89.9, roll: 0 },
                imageUrl:
                    'https://3d.oslandia.com/giro3d/drone/brighton-beach/images/DJI_0035.webp',
            },
        ],
    },
});

instance.add(orientedImageCollection).catch(console.error);

Inspector.attach('inspector', instance);

bindToggle('show-frustums', v => (orientedImageCollection.showFrustums = v));
bindToggle('show-images', v => (orientedImageCollection.showImages = v));
bindToggle('show-origins', v => (orientedImageCollection.showLocationSpheres = v));
