import { Vector3 } from 'three';

import FirstPersonControls from '@giro3d/giro3d/controls/FirstPersonControls.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import { MODE } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.fromEpsg(2154),
    backgroundColor: null,
});

const pointCloud = new Tiles3D({
    url: 'https://3d.oslandia.com/3dtiles/eglise_saint_blaise_arles/tileset.json',
    pointCloudMode: MODE.COLOR,
});

instance.add(pointCloud);

// Position our camera
const camera = instance.view.camera;
camera.position.set(831542.2870560559, 6287655.35350404, 31.86644500706522);
camera.lookAt(new Vector3(831585.923, 6287652.23, 27.461));
camera.updateMatrixWorld();

// And create our controls
const controls = new FirstPersonControls(instance, { focusOnMouseOver: true });

controls.reset();

instance.domElement.focus();
instance.notifyChange(camera);

Inspector.attach('inspector', instance);

StatusBar.bind(instance, { disableUrlUpdate: true });
