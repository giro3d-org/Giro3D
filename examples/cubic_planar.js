import {
    Mesh,
    Vector3,
    Euler,
    MeshBasicMaterial,
    BoxGeometry,
    Object3D,
    DoubleSide,
    AxesHelper,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import TileWMS from 'ol/source/TileWMS.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import Map, { isMap } from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';
import WmsSource from '@giro3d/giro3d/sources/WmsSource.js';

const wmsLayers = [
    'metropole-de-lyon:fpc_fond_plan_communaut.fpcilot',
    'metropole-de-lyon:pvo_patrimoine_voirie.pvochausseetrottoir',
    'grandlyon:ortho_2009',
    'metropole-de-lyon:pos_opposable.poshauvoi',
    'grandlyon:MNT2015_Ombrage_2m',
    'metropole-de-lyon:cad_cadastre.cadilot',
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
    crs: extent.crs,
    backgroundColor: 0x999999,
});

const cube = new Mesh(
    new BoxGeometry(8000, 8000, 8000),
    new MeshBasicMaterial({ color: 0xdddddd }),
);
cube.name = 'root cube';
const wireframe = new Mesh(
    new BoxGeometry(8000, 8000, 8000),
    new MeshBasicMaterial({ color: 0x000000, wireframe: true }),
);
wireframe.name = 'wireframe cube';
cube.add(wireframe);
cube.scale.copy(scale);
cube.updateMatrixWorld(true);

instance.scene.add(cube);

const axes = new AxesHelper(1);

instance.scene.add(axes);

function createColorLayer(name, url) {
    const source = new WmsSource({
        url,
        layer: name,
        imageFormat: 'image/jpeg',
        projection: 'EPSG:3946',
    });

    return new ColorLayer({ name, source });
}

function createElevationLayer(name, url) {
    const source = new TiledImageSource({
        source: new TileWMS({
            url,
            projection: 'EPSG:3946',
            params: {
                LAYERS: [name],
            },
        }),
    });

    return new ElevationLayer({
        name,
        source,
        minmax: { min: -100, max: +250 },
        interpretation: Interpretation.ScaleToMinMax(149, 621),
    });
}

const allMaps = [];

for (let i = 0; i < wmsLayers.length; i++) {
    const cubeSide = new Object3D();
    const offset = extent.centerAsVector3().negate().applyEuler(cubeTransformations[i].rotation);
    offset.add(cubeTransformations[i].position.divide(scale));
    cubeSide.position.copy(offset);
    cubeSide.rotation.copy(cubeTransformations[i].rotation);
    cube.add(cubeSide);
    cubeSide.updateMatrixWorld(true);

    const layerName = wmsLayers[i];

    const map = new Map({
        extent,
        terrain: {
            segments: 16,
        },
        discardNoData: true,
        side: DoubleSide,
        object3d: cubeSide,
    });

    map.name = layerName;

    instance.add(map);

    allMaps.push(map);

    map.addLayer(createColorLayer(layerName, 'https://download.data.grandlyon.com/wms/grandlyon'));
    map.addLayer(
        createElevationLayer(
            'grandlyon:MNT2012_Altitude_10m_CC46',
            'https://download.data.grandlyon.com/wms/grandlyon',
        ),
    );
}

instance.view.camera.position.set(3, 3, 2);
instance.view.camera.updateMatrixWorld(true);
instance.view.camera.lookAt(new Vector3(0, 0, 0));

const controls = new OrbitControls(instance.view.camera, instance.domElement);
controls.minDistance = 1;

instance.view.setControls(controls);
instance.view.minNearPlane = 0.1;

// Request redraw
instance.notifyChange();

Inspector.attach('inspector', instance);
StatusBar.bind(instance);

/**
 * @param {MouseEvent} event
 */
function highlight(event) {
    for (const map of allMaps) {
        map.colorimetry.brightness = 0;
        map.colorimetry.saturation = 1;
        map.colorimetry.contrast = 1;
    }

    const picked = instance.pickObjectsAt(event);
    if (picked.length > 0) {
        picked.sort((a, b) => a.distance - b.distance);

        const first = picked[0];

        if (first) {
            const entity = first.entity;
            if (isMap(entity)) {
                entity.colorimetry.brightness = 0.3;
                entity.colorimetry.saturation = 2;
                entity.colorimetry.contrast = 1.5;
            }
        }
    }
    instance.notifyChange(allMaps);
}

instance.domElement.addEventListener('mousemove', highlight);
