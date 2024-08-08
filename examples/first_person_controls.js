import { Vector3 } from 'three';

import FirstPersonControls from '@giro3d/giro3d/controls/FirstPersonControls.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Tiles3DSource from '@giro3d/giro3d/sources/Tiles3DSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

const viewerDiv = document.getElementById('viewerDiv');

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const instance = new Instance(viewerDiv, {
    crs: 'EPSG:2154',
    renderer: {
        clearColor: 0xcccccc,
    },
});

// Configure and add Point Cloud to the scene
instance.add(
    new Tiles3D(
        'pointcloud',
        new Tiles3DSource('https://3d.oslandia.com/3dtiles/eglise_saint_blaise_arles/tileset.json'),
    ),
);

// Position our camera
instance.view.camera.position.set(831542.2870560559, 6287655.35350404, 31.86644500706522);
instance.view.camera.lookAt(new Vector3(831585.923, 6287652.23, 27.461));
instance.view.camera.updateMatrixWorld();
// And create our controls
const controls = new FirstPersonControls(instance, {
    focusOnMouseOver: true,
});
controls.reset();
instance.domElement.focus();

instance.notifyChange(instance.view.camera);

Inspector.attach(document.getElementById('panelDiv'), instance);
StatusBar.bind(instance, { disableUrlUpdate: true });
