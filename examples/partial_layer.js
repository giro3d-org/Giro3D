import TileWMS from 'ol/source/TileWMS.js';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const extent = new Extent('EPSG:3946', 1837816.94334, 1847692.32501, 5170036.4587, 5178412.82698);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:3946',
});

const map = new Map({ extent, hillshading: true, backgroundColor: 'white' });
instance.add(map);

// Adds a WMS imagery layer
const colorSource = new TiledImageSource({
    source: new TileWMS({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:3946',
        params: {
            LAYERS: ['ORTHOIMAGERY.ORTHOPHOTOS'],
            FORMAT: 'image/jpeg',
        },
    }),
});

// Define a smaller extent for the layer.
const layerExtent = extent.withMargin(-1000, -1000);

const colorLayer = new ColorLayer({
    name: 'wms_imagery',
    source: colorSource,
    extent: layerExtent,
});
map.addLayer(colorLayer);

// Adds a WMS elevation layer
const elevationSource = new TiledImageSource({
    source: new TileWMS({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:3946',
        crossOrigin: 'anonymous',
        params: {
            LAYERS: ['ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES'],
            FORMAT: 'image/x-bil;bits=32',
        },
    }),
    format: new BilFormat(),
    noDataValue: -1000,
});

const elevationLayer = new ElevationLayer({
    name: 'wms_elevation',
    extent,
    source: elevationSource,
});

map.addLayer(elevationLayer);

instance.view.camera.position.set(extent.west, extent.south, 2000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = extent.centerAsVector3();
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
