import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import CogSource from '@giro3d/giro3d/sources/CogSource.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';

import StatusBar from './widgets/StatusBar.js';

// Define projection that we will use (taken from https://epsg.io/26910, Proj4js section)
Instance.registerCRS(
    'EPSG:26910',
    '+proj=utm +zone=10 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const extent = new Extent('EPSG:26910', 532622, 569790, 5114416, 5137240);

const center = extent.centerAsVector3();

// `viewerDiv` will contain Giro3D' rendering area (the canvas element)
const viewerDiv = document.getElementById('viewerDiv');

// Instantiate Giro3D
const instance = new Instance(viewerDiv, {
    crs: extent.crs(),
    renderer: {
        clearColor: 'gray',
    },
});

// Instantiate the camera
instance.view.camera.position.set(center.x, center.y - 1, 50000);

// Instantiate the controls
const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(center.x, center.y, center.z);
instance.useTHREEControls(controls);

// Use an elevation COG with nodata values
const source = new CogSource({
    // https://pubs.er.usgs.gov/publication/ds904
    url: 'https://3d.oslandia.com/dem/msh2009dem.tif',
    crs: extent.crs(),
});

const map = new Map('map', {
    extent,
    doubleSided: true,
    showOutline: true,
});

instance.add(map);

const min = 227;
const max = 2538;

const layer = new ColorLayer({
    source,
    showEmptyTextures: true,
    interpretation: Interpretation.CompressTo8Bit(min, max),
});

map.addLayer(layer);

// Attach the inspector
Inspector.attach(document.getElementById('panelDiv'), instance);

StatusBar.bind(instance);
