/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { tile } from 'ol/loadingstrategy.js';
import VectorSource from 'ol/source/Vector.js';
import { createXYZ } from 'ol/tilegrid.js';

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
import WmsSource from '@giro3d/giro3d/sources/WmsSource.js';

const loadJson = (path, doThen) => {
    fetch(path)
        .then(response => response.json()) // Parse JSON
        .then(doThen);
};

const crs = CoordinateSystem.register(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const instance = new Instance({
    target: 'view',
    crs,
});

const xmin = 1837816.94334;
const xmax = 1847692.32501;
const ymin = 5170036.4587;
const ymax = 5178412.82698;

const extent = new Extent(crs, xmin, xmax, ymin, ymax);

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

Inspector.attach('inspector', instance);

const pathSource = new VectorSource({
    format: new GeoJSON(),
    url: 'data/flight_path.geojson',
    strategy: tile(createXYZ({ tileSize: 512 })),
});

const featureCollection = new FeatureCollection({
    source: pathSource,
    dataProjection: instance.coordinateSystem,
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

loadJson('data/flight_path.geojson', json => {
    const POINTS = json.geometry.coordinates;
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

        return [pq0x + pq1x + pq2x + pq3x, pq0y + pq1y + pq2y + pq3y, pq0z + pq1z + pq2z + pq3z];
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
            coordinates: new Coordinates(CoordinateSystem.epsg4326, finalX, finalY).as(
                instance.coordinateSystem,
            ),
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

        let centre = extent.centerAsVector3();
        centre.z = -200.0;

        const camera = instance.view.camera;
        camera.position.set(cameraPoint.coordinates.x, cameraPoint.coordinates.y, cameraPoint.z);
        camera.lookAt(centre);
        camera.updateMatrixWorld();


        instance.notifyChange(camera);

        animationAlpha += frameTime / ANIMATION_DURATION_S;

        requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
});
