import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import PotreePointCloud from '@giro3d/giro3d/entities/PotreePointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import PotreeSource from '@giro3d/giro3d/sources/PotreeSource.js';

import StatusBar from './widgets/StatusBar.js';

const source = new PotreeSource(
    'https://3d.oslandia.com/potree/pointclouds/lion_takanawa',
    'cloud.js',
);

const potree = new PotreePointCloud(source);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:3857',
    backgroundColor: 'black',
});

function placeCamera() {
    const camera = instance.view.camera;

    const pos = new Vector3(6.757520397934977, -10.102934086721376, 7.402449241148831);
    const lookAt = new Vector3(0.5, 0.5, 5);

    const controls = new OrbitControls(camera, instance.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    camera.lookAt(lookAt);
    controls.target.copy(lookAt);
    camera.position.copy(pos);

    instance.view.setControls(controls);

    StatusBar.bind(instance, { radius: 5 });
}

instance.add(potree).then(placeCamera);
instance.notifyChange(instance.view.camera);

Inspector.attach('inspector', instance);

instance.domElement.addEventListener('dblclick', e => {
    console.log(instance.pickObjectsAt(e, { radius: 5, limit: 10 }));
});
