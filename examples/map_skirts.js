import { AmbientLight, DirectionalLight } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import XYZ from 'ol/source/XYZ.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import { MapLightingMode } from '@giro3d/giro3d/entities/MapLightingOptions.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

// Chamonix Mont-Blanc coordinates
const poi = new Coordinates('EPSG:4326', 6.8697, 45.9231).as('EPSG:3857').toVector3();

const extentSize = 30_000;
const extent = Extent.fromCenterAndSize(
    'EPSG:3857',
    { x: poi.x, y: poi.y },
    extentSize,
    extentSize,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
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

const map = new Map({
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

instance.add(map);

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
map.addLayer(elevationLayer);

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
map.addLayer(satelliteLayer);

const controls = new MapControls(instance.view.camera, instance.domElement);

instance.view.camera.position.set(poi.x - extentSize - 15000, poi.y - extentSize - 15000, 35_000);
controls.target.set(poi.x, poi.y, 2000);

instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
