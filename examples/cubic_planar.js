import { Mesh, Vector3, Euler, MeshBasicMaterial, BoxGeometry, Object3D } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import TileWMS from 'ol/source/TileWMS.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

// # Planar (EPSG:3946) viewer

const wmsLayers = [
    'fpc_fond_plan_communaut.fpcilot',
    'pvo_patrimoine_voirie.pvochausseetrottoir',
    'Ortho2009_vue_ensemble_16cm_CC46',
    'pos_opposable.poshauvoi',
    'MNT2015_Ombrage_2m',
    'cad_cadastre.cadilot',
];

const cubeTransformations = [
    {
        position: new Vector3(0, 0, 0.5),
        rotation: new Euler(),
    },
    {
        position: new Vector3(0, 0, -0.5),
        rotation: new Euler().set(Math.PI, 0, 0),
    },
    {
        position: new Vector3(0, 0.5, 0),
        rotation: new Euler().set(-Math.PI * 0.5, 0, 0),
    },
    {
        position: new Vector3(0, -0.5, 0),
        rotation: new Euler().set(Math.PI * 0.5, 0, 0),
    },
    {
        position: new Vector3(0.5, 0, 0),
        rotation: new Euler().set(0, Math.PI * 0.5, 0),
    },
    {
        position: new Vector3(-0.5, 0, 0),
        rotation: new Euler().set(0, -Math.PI * 0.5, 0),
    },
];

// Define projection that we will use (taken from https://epsg.io/3946, Proj4js section)
Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

// Define geographic extent: CRS, min/max X, min/max Y
const extent = new Extent('EPSG:3946', 1837900, 1837900 + 8000, 5170100, 5170100 + 8000);

const scale = new Vector3(1, 1, 1).divideScalar(extent.dimensions().x);

// Instantiate Giro3D
const instance = new Instance({
    target: 'view',
    crs: extent.crs(),
    renderer: {
        clearColor: 0x999999,
    },
});

const cube = new Mesh(
    new BoxGeometry(8000, 8000, 8000),
    new MeshBasicMaterial({ color: 0xdddddd }),
);
cube.scale.copy(scale);
cube.updateMatrixWorld(true);

instance.scene.add(cube);

function createColorLayer(name, url) {
    const source = new TiledImageSource({
        source: new TileWMS({
            url,
            params: {
                LAYERS: name,
                FORMAT: 'image/jpeg',
            },
            projection: 'EPSG:3946',
            crossOrigin: 'anonymous',
        }),
    });

    return new ColorLayer({
        name: 'wms_imagery',
        source,
    });
}

function createElevationLayer(name, url) {
    const source = new TiledImageSource({
        source: new TileWMS({
            url,
            projection: 'EPSG:3946',
            crossOrigin: 'anonymous',
            params: {
                LAYERS: [name],
            },
        }),
    });

    return new ElevationLayer({
        name: 'wms_elevation',
        source,
        interpretation: Interpretation.ScaleToMinMax(149, 621),
    });
}

for (let i = 0; i < wmsLayers.length; i++) {
    const cubeSide = new Object3D();
    const offset = extent.centerAsVector3().negate().applyEuler(cubeTransformations[i].rotation);
    offset.add(cubeTransformations[i].position.divide(scale));
    cubeSide.position.copy(offset);
    cubeSide.rotation.copy(cubeTransformations[i].rotation);
    cube.add(cubeSide);
    cubeSide.updateMatrixWorld(true);

    const wms = wmsLayers[i];
    const map = new Map({ extent, object3d: cubeSide, maxSubdivisionLevel: 2 });
    instance.add(map);

    map.addLayer(createColorLayer(wms, 'https://download.data.grandlyon.com/wms/grandlyon'));
    map.addLayer(
        createElevationLayer(
            'MNT2012_Altitude_10m_CC46',
            'https://download.data.grandlyon.com/wms/grandlyon',
        ),
    );
}

instance.view.camera.position.set(3, 2, 3);
instance.view.camera.updateMatrixWorld(true);
instance.view.camera.lookAt(new Vector3(0, 0, 0));

const controls = new OrbitControls(instance.view.camera, instance.domElement);
controls.minDistance = 1;

instance.useTHREEControls(controls);

// Request redraw
instance.notifyChange();

Inspector.attach(document.getElementById('panelDiv'), instance);
StatusBar.bind(instance);
