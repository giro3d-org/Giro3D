import TileWMS from 'ol/source/TileWMS.js';

import { Vector3, CubeTextureLoader } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Tiles3DSource from '@giro3d/giro3d/sources/Tiles3DSource.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const tmpVec3 = new Vector3();

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:2154',
});

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
instance.view.setControls(controls);

// Adds a WMS imagery layer
const wmsOthophotoSource = new TiledImageSource({
    source: new TileWMS({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:2154',
        crossOrigin: 'anonymous',
        params: {
            LAYERS: ['ORTHOIMAGERY.ORTHOPHOTOS'],
            FORMAT: 'image/jpeg',
        },
    }),
});

const pointcloud = new Tiles3D(new Tiles3DSource('https://3d.oslandia.com/lidar_hd/tileset.json'));

// add pointcloud to scene
function initializeCameraPosition(layer) {
    const bbox = layer.root.bbox
        ? layer.root.bbox
        : layer.root.boundingVolume.box.clone().applyMatrix4(layer.root.matrixWorld);

    // configure camera
    instance.view.camera.far = 2.0 * bbox.getSize(tmpVec3).length();

    const ratio = bbox.getSize(tmpVec3).x / bbox.getSize(tmpVec3).z;
    const position = bbox.min
        .clone()
        .add(bbox.getSize(tmpVec3).multiply({ x: 0, y: 0, z: ratio * 0.5 }));
    const lookAt = bbox.getCenter(tmpVec3);
    lookAt.z = bbox.min.z;
    instance.view.camera.position.set(position.x, position.y, position.z);
    instance.view.camera.lookAt(lookAt);
    controls.target.copy(lookAt);
    controls.saveState();

    const colorLayer = new ColorLayer({
        name: 'orthophoto-ign',
        // The extent is useful to restrict the processing of the image layer
        // (which is much bigger than our point cloud).
        extent: Extent.fromBox3('EPSG:2154', bbox),
        source: wmsOthophotoSource,
    });

    pointcloud.attach(colorLayer);

    instance.renderingOptions.enableEDL = true;
    instance.renderingOptions.enableInpainting = true;
    instance.renderingOptions.enablePointCloudOcclusion = true;

    // refresh scene
    instance.notifyChange(instance.view.camera);
}
instance.add(pointcloud).then(initializeCameraPosition);

// add a skybox background
const cubeTextureLoader = new CubeTextureLoader();
cubeTextureLoader.setPath('image/skyboxsun25deg_zup/');
const cubeTexture = cubeTextureLoader.load([
    'px.jpg',
    'nx.jpg',
    'py.jpg',
    'ny.jpg',
    'pz.jpg',
    'nz.jpg',
]);

instance.scene.background = cubeTexture;

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
