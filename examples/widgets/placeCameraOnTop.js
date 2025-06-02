import { MathUtils, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

export function placeCameraOnTop(volume, instance) {
    if (!instance) {
        return;
    }

    const center = volume.getCenter(new Vector3());
    const size = volume.getSize(new Vector3());

    const camera = instance.view.camera;
    const top = volume.max.z;
    const fov = camera.fov;
    const aspect = camera.aspect;

    const hFov = MathUtils.degToRad(fov) / 2;
    const altitude = (Math.max(size.x / aspect, size.y) / Math.tan(hFov)) * 0.5;

    instance.view.camera.position.set(center.x, center.y - 1, altitude + top);
    instance.view.camera.lookAt(center);

    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    instance.view.setControls(controls);
    instance.notifyChange(instance.view.camera);
}
