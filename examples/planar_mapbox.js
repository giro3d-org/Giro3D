import XYZ from 'ol/source/XYZ.js';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:3857',
    '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
);

const extent = new Extent('EPSG:3857', 659030, 735596, 5535152, 5647497);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:3857',
});

const map = new Map({ extent });

instance.add(map);

async function addLayers(key) {
    const layers = map.getLayers();
    for (const current of layers) {
        map.removeLayer(current);
    }

    // Adds a XYZ elevation layer with MapBox terrain RGB tileset
    const elevationLayer = new ElevationLayer({
        name: 'xyz_elevation',
        extent,
        // We dont want the full resolution because the terrain
        // mesh has a much lower resolution than the raster image
        resolutionFactor: 1 / 8,
        source: new TiledImageSource({
            format: new MapboxTerrainFormat(),
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
                projection: extent.crs,
                crossOrigin: 'anonymous',
            }),
        }),
    });
    await map.addLayer(elevationLayer);

    // Adds a XYZ color layer with MapBox satellite tileset
    const satelliteLayer = new ColorLayer({
        name: 'xyz_color',
        extent,
        source: new TiledImageSource({
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
                projection: extent.crs,
                crossOrigin: 'anonymous',
            }),
        }),
    });
    await map.addLayer(satelliteLayer);
}

// Create our elevation layer using Giro3D's default mapbox api key
addLayers(
    'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ',
).catch(console.error);

instance.view.camera.position.set(extent.east, extent.south, 2000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = extent.centerAsVector3();
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

document.getElementById('mapboxApi').addEventListener('submit', e => {
    e.preventDefault();
    // @ts-expect-error typing
    addLayers(document.getElementById('mapboxApiKey').value);
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
