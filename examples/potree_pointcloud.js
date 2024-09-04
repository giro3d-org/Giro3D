import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import PotreePointCloud from '@giro3d/giro3d/entities/PotreePointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import PotreeSource from '@giro3d/giro3d/sources/PotreeSource.js';

import StatusBar from './widgets/StatusBar.js';
import { bindToggle } from './widgets/bindToggle.js';
import { bindSlider } from './widgets/bindSlider.js';
import { updateLabel } from './widgets/updateLabel.js';

const source = new PotreeSource('https://3d.oslandia.com/potree/pointclouds/lion_takanawa');

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:3857',
    backgroundColor: null,
});

function placeCamera() {
    const camera = instance.view.camera;

    const pos = new Vector3(7.5, -9.14, 9.1);
    const lookAt = new Vector3(0.5, 0, 4.3);

    const controls = new OrbitControls(camera, instance.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    camera.position.copy(pos);

    camera.lookAt(lookAt);
    controls.target.copy(lookAt);

    instance.view.setControls(controls);

    instance.notifyChange(instance.view.camera);

    Inspector.attach('inspector', instance);

    StatusBar.bind(instance, { radius: 5 });
}

const potree = new PotreePointCloud(source);

instance.add(potree).then(placeCamera).catch(console.error);

const renderingOptions = instance.renderingOptions;

renderingOptions.enableEDL = true;
renderingOptions.enableInpainting = true;
renderingOptions.inpaintingSteps = 1;
renderingOptions.enablePointCloudOcclusion = true;

bindToggle('edl', v => {
    renderingOptions.enableEDL = v;
    instance.notifyChange();
});
bindToggle('inpainting', v => {
    renderingOptions.enableInpainting = v;
    instance.notifyChange();
});
bindSlider('size', v => {
    potree.pointSize = v;
    updateLabel('size-label', 'Point size: ' + (v > 0 ? v.toString() : 'auto'));
    instance.notifyChange(potree);
});
