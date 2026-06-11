/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { tile } from 'ol/loadingstrategy.js';
import VectorSource from 'ol/source/Vector.js';
import { createXYZ } from 'ol/tilegrid.js';
import { Color, HemisphereLight } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

const loadJson = (path, doThen) => {
    fetch(path)
        .then(response => response.json()) // Parse JSON
        .then(doThen);
};

const epsg2154 = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

CoordinateSystem.register(
    'urn:ogc:def:crs:OGC:1.3:CRS84',
    '+proj=longlat +datum=WGS84 +no_defs +type=crs',
);

const instance = new Instance({
    target: 'view',
    crs: epsg2154,
    backgroundColor: null,
});

const center = new Coordinates(CoordinateSystem.epsg4326, 6.63125, 45.93506).as(
    instance.coordinateSystem,
);
const extent = Extent.fromCenterAndSize(epsg2154, { x: center.x, y: center.y }, 1_000, 1_000);

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
    airplane.updateMatrixWorld();

    instance.add(airplane);

    const hemiLight = new HemisphereLight(0xffffff, 0x444444, 3);
    hemiLight.position.set(0, 200, 0);
    instance.scene.add(hemiLight);

    instance.scene.background = new Color(0xa0a0ff);

    camera.position.set(center.x, center.y, 100);

    const pathSource = new VectorSource({
        format: new GeoJSON(),
        url: 'data/drone_path.geojson',
        strategy: tile(createXYZ({ tileSize: 512 })),
    });

    // Pass the VectorSource into the FeatureCollection.
    const featureCollection = new FeatureCollection({
        source: pathSource,
        dataProjection: CoordinateSystem.epsg4326,
        extent,
        minLevel: 0,
        maxLevel: 0,
        style: feature => {
            return {
                stroke: { color: 'yellow', lineWidth: 2 },
            };
        },
    });

    instance.add(featureCollection);

    loadJson('data/drone_path.geojson', json => {
        let POINTS = json.geometry.coordinates;

        POINTS.pop();
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

            const dq0 = -3.0 * t2 + 4.0 * t - 1.0;
            const dq1 = 9.0 * t2 - 10.0 * t;
            const dq2 = -9.0 * t2 + 8.0 * t + 1.0;
            const dq3 = 3.0 * t2 - 2.0 * t;

            const dpq0x = POINTS[p0][0] * dq0 * 0.5;
            const dpq1x = POINTS[p1][0] * dq1 * 0.5;
            const dpq2x = POINTS[p2][0] * dq2 * 0.5;
            const dpq3x = POINTS[p3][0] * dq3 * 0.5;
            const dpq0y = POINTS[p0][1] * dq0 * 0.5;
            const dpq1y = POINTS[p1][1] * dq1 * 0.5;
            const dpq2y = POINTS[p2][1] * dq2 * 0.5;
            const dpq3y = POINTS[p3][1] * dq3 * 0.5;

            return [
                [pq0x + pq1x + pq2x + pq3x, pq0y + pq1y + pq2y + pq3y],
                [dpq0x + dpq1x + dpq2x + dpq3x, dpq0y + dpq1y + dpq2y + dpq3y],
            ];
        };

        const SAMPLE_SIZE = 0.005;
        const STEP = 0.0002;
        const buildSegments = () => {
            let segments = [];
            let remainingLength = 0.0;
            for (let i = 0.0; i < POINTS.length - SAMPLE_SIZE; i += SAMPLE_SIZE) {
                const xy1 = samplePath(i)[0];
                const xy2 = samplePath(i + SAMPLE_SIZE)[0];
                const dx = xy2[0] - xy1[0];
                const dy = xy2[1] - xy1[1];
                const seglen = Math.sqrt(dx * dx + dy * dy);
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

            const xyb = samplePath(bx);
            const xyt = samplePath(tx);

            const finalX = xyb[0][0] * simfrac + xyt[0][0] * frac;
            const finalY = xyb[0][1] * simfrac + xyt[0][1] * frac;

            const dFinalX = xyb[1][0] * simfrac + xyt[1][0] * frac;
            const dFinalY = xyb[1][1] * simfrac + xyt[1][1] * frac;

            return [
                new Coordinates(CoordinateSystem.epsg4326, finalX, finalY).as(
                    instance.coordinateSystem,
                ),
                new Coordinates(CoordinateSystem.epsg4326, finalX + dFinalX, finalY + dFinalY).as(
                    instance.coordinateSystem,
                ),
            ];
        };

        const ANIMATION_DURATION_S = 50.0;
        const AIRPLANE_ALTITUDE = 10.0;
        let oldTime = 0.0;
        let animationAlpha = 0.0;
        const loop = time => {
            const frameTime = (time - oldTime) / 1000.0;
            oldTime = time;

            const sample = sampleSegment(animationAlpha);
            const airplaneXy = sample[0];
            const airplaneXyTarget = sample[1];
            airplane.position.x = airplaneXy.x;
            airplane.position.y = airplaneXy.y;
            airplane.position.z = AIRPLANE_ALTITUDE;
            airplane.lookAt(airplaneXyTarget.x, airplaneXyTarget.y, airplane.position.z);
            airplane.updateMatrixWorld();
            camera.lookAt(airplane.position);

            instance.notifyChange(camera);
            instance.notifyChange(airplane);

            animationAlpha += frameTime / ANIMATION_DURATION_S;

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    });
});
