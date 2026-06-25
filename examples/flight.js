/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import { CubicInterpolant, OrthographicCamera } from 'three';
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
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar';

const crs = CoordinateSystem.register(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);
CoordinateSystem.register(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
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

const ANIMATION_DURATION_S = 60.0;
let animationAlpha = 0.0;

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

        const parameterPositions = new Float32Array(POINTS.length);
        const sampleValues = new Float32Array(POINTS.length * 3);
        for (let i = 0; i < POINTS.length; i++) {
            // We'll interpolate with constant time between each values from the path
            parameterPositions[i] = i / (POINTS.length - 1);
            sampleValues[i * 3 + 0] = POINTS[i][0];
            sampleValues[i * 3 + 1] = POINTS[i][1];
            sampleValues[i * 3 + 2] = POINTS[i][2];
        }
        const interpolant = new CubicInterpolant(parameterPositions, sampleValues, 3);

        let oldTime = 0.0;
        let playing = true;
        const loop = time => {
            const frameTime = (time - oldTime) / 1000.0;
            oldTime = time;

            // Interpolate the path to get the camera position
            const result = interpolant.evaluate(animationAlpha);

            // Update the camera position
            const camera = instance.view.camera;
            camera.position.set(result[0], result[1], result[2]);
            camera.lookAt(center);
            camera.updateMatrixWorld();
            instance.notifyChange(camera);

            // Update the camera position in the minimap
            label.position.set(result[0], result[1], 0);
            label.updateMatrixWorld();
            minimapInstance.notifyChange(label);

            animationAlpha = (animationAlpha + frameTime / ANIMATION_DURATION_S) % 1;
            // @ts-expect-error value not available on HTMLElement
            document.getElementById('animation-step').value = animationAlpha;

            if (playing) {
                requestAnimationFrame(loop);
            }
        };

        requestAnimationFrame(loop);

        bindToggle('toggle-animation', v => {
            playing = v;
            if (v) {
                requestAnimationFrame(loop);
            }
        });

        bindSlider('animation-step', v => {
            animationAlpha = v;
            requestAnimationFrame(loop);
        });
    });

Inspector.attach('inspector', instance);
Inspector.attach('inspector', minimapInstance, { title: 'minimap' });

StatusBar.bind(instance, { additionalInstances: minimapInstance });
