import XYZ from 'ol/source/XYZ.js';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(CoordinateSystem.epsg3857, -13611854, -13593262, 5806332, 5820603);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg3857,
});

function createMap(mapExtent, tileset) {
    const key =
        'pk.eyJ1IjoidG11Z3VldCIsImEiOiJjbGJ4dTNkOW0wYWx4M25ybWZ5YnpicHV6In0.KhDJ7W5N3d1z3ArrsDjX_A';
    const map = new Map({
        extent: mapExtent,
        lighting: { enabled: true, elevationLayersOnly: true },
        backgroundColor: 'grey',
    });
    map.name = tileset;
    instance.add(map);

    // Adds a XYZ elevation layer with MapBox terrain RGB tileset
    const elevationLayer = new ElevationLayer({
        name: 'xyz_elevation',
        extent,
        resolutionFactor: 1 / 8,
        source: new TiledImageSource({
            format: new MapboxTerrainFormat(),
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
                projection: extent.crs.id,
                crossOrigin: 'anonymous',
            }),
        }),
    });
    map.addLayer(elevationLayer);

    // Adds a XYZ color layer with MapBox satellite tileset
    const colorLayer = new ColorLayer({
        name: 'xyz_color',
        extent,
        source: new TiledImageSource({
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.${tileset}/{z}/{x}/{y}.webp?access_token=${key}`,
                projection: extent.crs.id,
                crossOrigin: 'anonymous',
            }),
        }),
    });
    map.addLayer(colorLayer);

    return { map, colorLayer, elevationLayer };
}

const split = extent.split(2, 1);

const naip = createMap(split[0], 'naip');
const satellite = createMap(split[1], 'satellite');

const center = extent.centerAsVector3();
instance.view.camera.position.set(center.x, extent.north, 10000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = center;
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

const instanceProgress = document.getElementById('progress-instance');
const naipMapProgress = document.getElementById('progress-map1');
const color1Progress = document.getElementById('progress-color1');
const elevation1Progress = document.getElementById('progress-elevation1');
const satelliteMapProgress = document.getElementById('progress-map2');
const color2Progress = document.getElementById('progress-color2');
const elevation2Progress = document.getElementById('progress-elevation2');

function updateProgressBar(domElement, source) {
    domElement.style.width = `${Math.round(source.progress * 100)}%`;
}

// Let's poll the main loop: at each update, we can update the progress bars
instance.addEventListener('update-end', () => {
    updateProgressBar(instanceProgress, instance);

    updateProgressBar(naipMapProgress, naip.map);
    updateProgressBar(color1Progress, naip.colorLayer);
    updateProgressBar(elevation1Progress, naip.elevationLayer);

    updateProgressBar(satelliteMapProgress, satellite.map);
    updateProgressBar(color2Progress, satellite.colorLayer);
    updateProgressBar(elevation2Progress, satellite.elevationLayer);
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
