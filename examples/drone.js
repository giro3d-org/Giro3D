/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import VectorSource from 'ol/source/Vector.js';
import { Color, CubicInterpolant, HemisphereLight, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
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
    'urn:ogc:def:crs:OGC:1.3:CRS84',
    '+proj=longlat +datum=WGS84 +no_defs +type=crs',
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

const center = new Coordinates(CoordinateSystem.epsg4326, 6.636, 45.935).as(
    instance.coordinateSystem,
);
const extent = Extent.fromCenterAndSize(epsg2154, { x: center.x, y: center.y }, 20_000, 20_000);

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

const camera = instance.view.camera;

Inspector.attach('inspector', instance);

// https://airbornescience.nasa.gov/content/3D_Models_Gallery
// Non-promotional commercial use:
// https://www.nasa.gov/nasa-brand-center/images-and-media/
const path = 'https://3d.oslandia.com/giro3d/gltf/G3_JSC_UAVSAR_AIR_0824.glb';
const loader = new GLTFLoader();

let result = null;
loader.load(path, gltf => {
    const airplane = gltf.scene;
    airplane.scale.set(100, 100, 100);
    airplane.rotation.x = Math.PI / 2;
    airplane.rotation.y = Math.PI;
    airplane.updateMatrixWorld();

    instance.add(airplane);

    const hemiLight = new HemisphereLight(0xffffff, 0x444444, 3);
    hemiLight.position.set(0, 200, 0);
    instance.scene.add(hemiLight);

    instance.scene.background = new Color(0xa0a0ff);

    const cameraPosition = new Coordinates(CoordinateSystem.epsg4326, 6.63125, 45.93506).as(
        instance.coordinateSystem,
    );
    camera.position.set(cameraPosition.x, cameraPosition.y, 1600);

    const pathSource = new VectorSource({
        format: new GeoJSON(),
        url: 'data/drone_path.geojson',
    });

    // Pass the VectorSource into the FeatureCollection.
    const featureCollection = new FeatureCollection({
        source: pathSource,
        dataProjection: CoordinateSystem.epsg4326,
        extent,
        minLevel: 0,
        maxLevel: 0,
        elevation: 1500,
        style: feature => {
            return {
                stroke: { color: 'yellow', lineWidth: 2 },
            };
        },
    });

    instance.add(featureCollection);

    fetch('data/drone_path.geojson')
        .then(response => response.json())
        .then(json => {
            const coordinates = new Coordinates(CoordinateSystem.epsg4326, 0, 0, 0);
            const reprojected = new Coordinates(instance.coordinateSystem, 0, 0, 0);

            const POINTS = json.geometry.coordinates.map(c => {
                // Reproject points once and for all in target coordinate system
                coordinates.set(CoordinateSystem.epsg4326, c[0], c[1]);
                coordinates.as(instance.coordinateSystem, reprojected);
                return [reprojected.x, reprojected.y];
            });

            const parameterPositions = new Float32Array(POINTS.length);
            const sampleValues = new Float32Array(POINTS.length * 2);
            for (let i = 0; i < POINTS.length; i++) {
                // We'll interpolate with constant time between each values from the path
                parameterPositions[i] = i / (POINTS.length - 1);
                sampleValues[i * 2 + 0] = POINTS[i][0];
                sampleValues[i * 2 + 1] = POINTS[i][1];
            }
            const interpolant = new CubicInterpolant(parameterPositions, sampleValues, 2);

            const ANIMATION_DURATION_S = 50.0;
            const AIRPLANE_ALTITUDE = 1500.0;
            let oldTime = 0.0;
            let animationAlpha = 0.0;

            const _look_at = new Vector3();

            const loop = time => {
                const frameTime = (time - oldTime) / 1000.0;
                oldTime = time;

                // Move the airplane
                const position = interpolant.evaluate(animationAlpha);
                airplane.position.set(position[0], position[1], AIRPLANE_ALTITUDE);

                // Set the heading
                // note: evaluate returns a reference, so at this point `position` is outdated
                const nextPosition = interpolant.evaluate((animationAlpha + 0.01) % 1);
                _look_at.set(nextPosition[0], nextPosition[1], AIRPLANE_ALTITUDE);
                airplane.lookAt(_look_at);
                airplane.updateMatrixWorld();

                // Move the camera
                camera.lookAt(airplane.position);

                instance.notifyChange(camera);
                instance.notifyChange(airplane);

                animationAlpha = (animationAlpha + frameTime / ANIMATION_DURATION_S) % 1;

                requestAnimationFrame(loop);
            };

            requestAnimationFrame(loop);

            StatusBar.bind(instance);
        });
});
