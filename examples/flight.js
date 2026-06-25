/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import { OrthographicCamera } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import WmsSource from '@giro3d/giro3d/sources/WmsSource.js';

import StatusBar from './widgets/StatusBar';

const crs = CoordinateSystem.register(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const instance = new Instance({
    target: 'view',
    crs,
});

const extent = new Extent(crs, 1836816, 1848692, 5169036, 5179412);
const center = extent.centerAsVector3();
center.z = -200.0;

const map = new Map({ extent });

instance.add(map);

const satelliteSource = new WmsSource({
    url: 'https://data.geopf.fr/wms-r',
    projection: 'EPSG:3946',
    layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
    imageFormat: 'image/jpeg',
});

const colorLayer = new ColorLayer({
    name: 'satellite',
    source: satelliteSource,
    extent: map.extent,
});

map.addLayer(colorLayer);

const demSource = new WmsSource({
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    imageFormat: 'image/x-bil;bits=32',
    url: 'https://data.geopf.fr/wms-r',
    projection: 'EPSG:3946',
    format: new BilFormat(),
    noDataValue: -1000,
});

const elevationLayer = new ElevationLayer({
    name: 'dem',
    resolutionFactor: 1 / 8,
    extent: map.extent,
    source: demSource,
});

map.addLayer(elevationLayer);

// Create a minimap to display camera path
const minimapInstance = new Instance({
    target: 'minimap',
    crs,
});
const minimapCameraWidth = 4000;
const minimapCamera = new OrthographicCamera(
    -minimapCameraWidth / 2,
    minimapCameraWidth / 2,
    100,
    -100,
);

const minimap = new Map({
    extent: map.extent,
    terrain: {
        enabled: false,
        segments: 1,
    },
    backgroundColor: 'black',
});

minimapInstance.add(minimap);

// Load camera path
const featureCollection = new FeatureCollection({
    source: new VectorSource({
        format: new GeoJSON(),
        url: 'data/flight_path.geojson',
    }),
    dataProjection: instance.coordinateSystem,
    extent,
    ignoreZ: true,
    elevation: 0,
    style: feature => {
        return {
            stroke: { color: 'yellow', lineWidth: 2 },
        };
    },
});
minimapInstance.add(featureCollection);

minimapInstance.view.camera = minimapCamera;
minimapInstance.view.camera.position.set(
    // Set camera at centroid of the path
    1842333.3177462846506387,
    5175517.33842045720666647,
    10000,
);
minimapCamera.zoom = 0.4; // Zoom out to display the whole path
minimapInstance.notifyChange(minimap);

// We use an OpenStreetMap color layer for the minimap, because it's readable and fast to display.
const osmLayer = new ColorLayer({
    name: 'osm',
    preloadImages: true,
    resolutionFactor: 0.8,
    source: new TiledImageSource({ source: new OSM() }),
});

minimap.addLayer(osmLayer);

// Add a label for displaying the camera's position
const labelElement = document.createElement('div');
labelElement.style.borderRadius = '50%';
labelElement.style.borderWidth = '2px';
labelElement.style.borderStyle = 'solid';
labelElement.style.width = '28px';
labelElement.style.height = '28px';
labelElement.style.textAlign = 'center';
labelElement.style.verticalAlign = 'middle';
labelElement.style.backgroundColor = 'orange';

const cameraSymbol = document.createElement('i');
cameraSymbol.classList.add('bi', 'bi-camera-video-fill', 'text-dark', 'shadow');

labelElement.appendChild(cameraSymbol);

const label = new CSS2DObject(labelElement);
// We'll set its position in the first animation loop
label.visible = true;
minimapInstance.add(label);

fetch('data/flight_path.geojson')
    .then(response => response.json())
    .then(json => {
        const coordinates = new Coordinates(CoordinateSystem.epsg4326, 0, 0, 0);
        const reprojected = new Coordinates(instance.coordinateSystem, 0, 0, 0);

        const POINTS = json.geometry.coordinates.map(c => {
            // Reproject points once and for all in target coordinate system
            coordinates.set(CoordinateSystem.epsg4326, c[0], c[1], c[2]);
            coordinates.as(instance.coordinateSystem, reprojected);
            return [reprojected.x, reprojected.y, reprojected.z];
        });

        const samplePath = t => {
            if (typeof t !== 'number' || isNaN(t)) {
                t = 0;
            }

            const p0 = Math.floor(t);
            const p1 = (p0 + 1) % POINTS.length;
            const p2 = (p0 + 2) % POINTS.length;
            const p3 = (p0 + 3) % POINTS.length;

            t = t - Math.floor(t);
            const t2 = t * t;
            const t3 = t2 * t;

            const q0 = -t3 + 2.0 * t2 - t;
            const q1 = 3.0 * t3 - 5.0 * t2 + 2.0;
            const q2 = -3.0 * t3 + 4.0 * t2 + t;
            const q3 = t3 - t2;

            const pq0x = POINTS[p0][0] * q0 * 0.5;
            const pq1x = POINTS[p1][0] * q1 * 0.5;
            const pq2x = POINTS[p2][0] * q2 * 0.5;
            const pq3x = POINTS[p3][0] * q3 * 0.5;
            const pq0y = POINTS[p0][1] * q0 * 0.5;
            const pq1y = POINTS[p1][1] * q1 * 0.5;
            const pq2y = POINTS[p2][1] * q2 * 0.5;
            const pq3y = POINTS[p3][1] * q3 * 0.5;
            const pq0z = POINTS[p0][2] * q0 * 0.5;
            const pq1z = POINTS[p1][2] * q1 * 0.5;
            const pq2z = POINTS[p2][2] * q2 * 0.5;
            const pq3z = POINTS[p3][2] * q3 * 0.5;

            return [
                pq0x + pq1x + pq2x + pq3x,
                pq0y + pq1y + pq2y + pq3y,
                pq0z + pq1z + pq2z + pq3z,
            ];
        };

        const SAMPLE_SIZE = 0.005;
        const STEP = 0.0002;
        const buildSegments = () => {
            let segments = [];
            let remainingLength = 0.0;
            for (let i = 0.0; i < POINTS.length - SAMPLE_SIZE; i += SAMPLE_SIZE) {
                const xyz1 = samplePath(i);
                const xyz2 = samplePath(i + SAMPLE_SIZE);
                const dx = xyz2[0] - xyz1[0];
                const dy = xyz2[1] - xyz1[1];
                const dz = xyz2[2] - xyz1[2];
                const seglen = Math.sqrt(dx * dx + dy * dy + dz * dz);
                remainingLength += seglen;
                if (remainingLength >= STEP) {
                    segments.push(i);
                    remainingLength -= STEP;
                }
            }
            return segments;
        };
        let segments = buildSegments();
        const sampleSegment = alpha => {
            const x = alpha * (segments.length - 1);
            const bottom = Math.floor(x) % segments.length;
            const top = (bottom + 1) % segments.length;

            const bx = segments[bottom];
            const tx = segments[top];

            const frac = x - Math.floor(x);
            const simfrac = 1.0 - frac;

            const xyzb = samplePath(bx);
            const xyzt = samplePath(tx);

            const finalX = xyzb[0] * simfrac + xyzt[0] * frac;
            const finalY = xyzb[1] * simfrac + xyzt[1] * frac;
            const finalZ = xyzb[2] * simfrac + xyzt[2] * frac;

            return {
                x: finalX,
                y: finalY,
                z: finalZ,
            };
        };

        const ANIMATION_DURATION_S = 120.0;
        let oldTime = 0.0;
        let animationAlpha = 0.0;
        const loop = time => {
            const frameTime = (time - oldTime) / 1000.0;
            oldTime = time;

            const cameraPoint = sampleSegment(animationAlpha);

            const camera = instance.view.camera;
            camera.position.set(cameraPoint.x, cameraPoint.y, cameraPoint.z);
            camera.lookAt(center);
            camera.updateMatrixWorld();

            instance.notifyChange(camera);

            label.position.set(cameraPoint.x, cameraPoint.y, 0);
            label.updateMatrixWorld();
            minimapInstance.notifyChange(label);

            animationAlpha += frameTime / ANIMATION_DURATION_S;

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    });

Inspector.attach('inspector', minimapInstance, { title: 'minimap' });

StatusBar.bind(instance, { additionalInstances: minimapInstance });
