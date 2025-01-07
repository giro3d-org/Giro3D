import colormap from 'colormap';

import { Box3Helper, Color, DoubleSide } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer';
import Map from '@giro3d/giro3d/entities/Map';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/ColorMap.js';

import StatusBar from './widgets/StatusBar.js';
import { bindToggle } from './widgets/bindToggle.js';

Instance.registerCRS(
    'EPSG:32742',
    '+proj=utm +zone=42 +south +datum=WGS84 +units=m +no_defs +type=crs',
);

const datasetExtent = new Extent(
    'EPSG:3857',
    -13581040.085,
    -13469591.026,
    5780261.83,
    5942165.048,
);

const extent = datasetExtent.clone().as('EPSG:32742');

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

instance.view.camera.position.set(1305865, 24791965, 243407);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(1305865, 24791964, 1000);
instance.view.setControls(controls);

// Use an elevation COG with nodata values
const source = new GeoTIFFSource({
    // https://pubs.er.usgs.gov/publication/ds904
    url: 'https://3d.oslandia.com/cog_data/COG_EPSG3857_USGS_13_n47w122_20220919.tif',
    crs: 'EPSG:3857',
});

const values = colormap({ colormap: 'viridis', nshades: 256 });
const colors = values.map(v => new Color(v));

const min = 263;
const max = 4347;

const colorMap = new ColorMap({ colors, min, max, mode: ColorMapMode.Elevation });

const noDataOptions = {
    alpha: 0,
    maxSearchDistance: Infinity,
    replaceNoData: true,
};

const elevationLayer = new ElevationLayer({
    name: 'elevation',
    extent,
    source,
    noDataOptions,
    colorMap,
    minmax: { min, max },
});

const map = new Map({
    extent,
    side: DoubleSide,
    backgroundOpacity: 0,
    hillshading: true,
    discardNoData: true,
});

instance.add(map);

map.addLayer(elevationLayer);

const box = extent.toBox3(min, min);
const boxHelper = new Box3Helper(box, new Color('yellow'));
instance.add(boxHelper);
boxHelper.updateMatrixWorld();

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

bindToggle('enableFillNoData', state => {
    map.discardNoData = state;
    instance.notifyChange(map);
});
