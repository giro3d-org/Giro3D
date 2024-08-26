import { Vector3, Object3D } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import StadiaMaps from 'ol/source/StadiaMaps.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Helpers from '@giro3d/giro3d/helpers/Helpers.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

// Defines geographic extent: CRS, min/max X, min/max Y
const EPSG3857_BOUNDS = new Extent(
    'EPSG:3857',
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

let currentMap;

// Creates a Giro3D instance
const instance = new Instance({
    target: 'view',
    crs: EPSG3857_BOUNDS.crs(),
    renderer: {
        clearColor: 0x0a3b59,
    },
});

// Instanciates controls
const controls = new MapControls(instance.view.camera, instance.domElement);
instance.view.camera.position.set(0, 0, 100000000);

instance.useTHREEControls(controls);

Inspector.attach('inspector', instance);

instance.notifyChange();

const layers = ['stamen_watercolor', 'stamen_toner', 'stamen_terrain'];

let mapCount = 0;

// Create a grid that encompasses the whole EPSG:3857 bounds.
const grid = Helpers.createGrid(new Vector3(0, 0, -10000), EPSG3857_BOUNDS.dimensions().x, 20);
instance.threeObjects.add(grid);

function createMap(extent) {
    if (currentMap) {
        instance.remove(currentMap);
        currentMap = null;
    }

    mapCount++;
    const object3d = new Object3D();
    // Creates a map that will contain the layer
    currentMap = new Map({
        extent,
        maxSubdivisionLevel: 10,
        object3d,
        showOutline: true,
    });

    currentMap.name = `${mapCount}`;

    currentMap.object3d.position.set(0, 0, mapCount * 10000);

    instance.add(currentMap);

    // Adds an TMS imagery layer
    const layer = layers[mapCount % layers.length];
    currentMap
        .addLayer(
            new ColorLayer({
                name: 'osm',
                extent,
                source: new TiledImageSource({ source: new StadiaMaps({ layer, wrapX: false }) }),
            }),
        )
        .catch(e => console.error(e));

    instance.notifyChange();
}

const button = document.getElementById('createMap');

button.onclick = () => {
    const x0 = Math.random();
    const x1 = Math.random();
    const y0 = Math.random();
    const y1 = Math.random();

    const dimensions = EPSG3857_BOUNDS.dimensions();

    const west = EPSG3857_BOUNDS.west + Math.min(x0, x1) * dimensions.x;
    const east = EPSG3857_BOUNDS.west + Math.max(x0, x1) * dimensions.x;

    const north = EPSG3857_BOUNDS.south + Math.max(y0, y1) * dimensions.y;
    const south = EPSG3857_BOUNDS.south + Math.min(y0, y1) * dimensions.y;

    const extent = new Extent('EPSG:3857', west, east, south, north);

    createMap(extent);
};

StatusBar.bind(instance);
