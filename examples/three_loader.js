import {
    AnimationMixer,
    Clock,
    Color,
    DirectionalLight,
    Fog,
    HemisphereLight,
    Mesh,
    MeshPhongMaterial,
    PlaneGeometry,
    Vector3,
} from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';
import { bindNumericalDropDown } from './widgets/bindNumericalDropDown.js';

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg3857,
});

const camera = instance.view.camera;

instance.renderer.shadowMap.enabled = true;

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
instance.view.setControls(controls);

const clock = new Clock();

// we can access the THREE.js scene directly
instance.scene.background = new Color(0xa0a0a0);
instance.scene.fog = new Fog(0xa0a0a0, 10, 50);

// adding lights directly to scene is ok
const hemiLight = new HemisphereLight(0xffffff, 0x444444, 2);
hemiLight.position.set(0, 0, 20);
hemiLight.updateMatrixWorld();
instance.scene.add(hemiLight);

const dirLight = new DirectionalLight(0xffffff, 3);
dirLight.position.set(-3, 10, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 4;
dirLight.shadow.camera.bottom = -4;
dirLight.shadow.camera.left = -4;
dirLight.shadow.camera.right = 4;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 40;
instance.scene.add(dirLight);
instance.scene.add(dirLight.target);
dirLight.updateMatrixWorld();

// Let's now setup a "ground" to receive the shadows
const mesh = new Mesh(
    new PlaneGeometry(200, 200),
    new MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }),
);
mesh.receiveShadow = true;
// Contrary to lights, every meshes should be added through `instance.add`, in order for Giro3D to
// be aware of them. Otherwise the objects will just disappear.
// For technical details, see how MainLoop.js calculates camera near and far.
instance.add(mesh);

// Let's load objects using one of the THREE loaders.
const loader = new GLTFLoader();
loader.load('https://threejs.org/examples/models/gltf/Soldier.glb', gltf => {
    gltf.scene.traverse(object => {
        // @ts-expect-error typing
        if (object.isMesh) {
            object.castShadow = true;
        }
    });

    // this code is virtually identical to this example:
    // https://threejs.org/examples/webgl_animation_multiple
    const model1 = clone(gltf.scene);
    const model2 = clone(gltf.scene);
    const model3 = clone(gltf.scene);
    const models = [model1, model2, model3];

    const mixer1 = new AnimationMixer(model1);
    const mixer2 = new AnimationMixer(model2);
    const mixer3 = new AnimationMixer(model3);
    const mixers = [mixer1, mixer2, mixer3];

    mixer1.clipAction(gltf.animations[0]).play(); // idle
    mixer2.clipAction(gltf.animations[1]).play(); // run
    mixer3.clipAction(gltf.animations[3]).play(); // walk

    model1.position.x = 1;
    model1.rotation.x = Math.PI / 2;
    model1.updateMatrixWorld();
    model2.position.x = 0;
    model2.rotation.x = Math.PI / 2;
    model2.updateMatrixWorld();
    model3.position.x = 2;
    model3.rotation.x = Math.PI / 2;
    model3.updateMatrixWorld();

    // except for this part, we add directly to instance to make Giro3D aware of these models
    instance.add(model1);
    instance.add(model2);
    instance.add(model3);

    // let's move our camera and control target
    // We add 1 to z to look at the waist. The 0, 0, 0 is located at the soldier's feet.
    const lookAt = new Vector3(0, 0, 1).add(model1.position);
    camera.position.set(2, 6, 3);
    camera.lookAt(lookAt);
    controls.target.copy(lookAt);
    controls.saveState();

    // you can hook yourself to event of the rendering loop.
    instance.addEventListener('after-camera-update', () => {
        const delta = clock.getDelta();

        for (const mixer of mixers) {
            mixer.update(delta);
        }
        for (const model of models) {
            model.updateMatrixWorld();
            instance.notifyChange(model);
        }
    });

    instance.notifyChange();

    let where = models;
    bindNumericalDropDown('pick_source', newMode => {
        if (newMode === 1) {
            where = [model1];
        } else if (newMode === 2) {
            where = [model2];
        } else if (newMode === 3) {
            where = [model3];
        } else {
            where = models;
        }
    });

    const formatter = new Intl.NumberFormat();

    function format(point) {
        return `x: ${formatter.format(point.x)}\n
                y: ${formatter.format(point.y)}\n
                z: ${formatter.format(point.z)}`;
    }

    instance.domElement.addEventListener('dblclick', e => {
        const picked = instance.pickObjectsAt(e, { limit: 1, where });
        if (picked.length === 0) {
            document.getElementById('selectedDiv').innerText = 'No object found';
        } else {
            document.getElementById('selectedDiv').innerHTML = `
                Picked ${picked[0].object.name} at:<br>
                ${format(picked[0].point)}!`;
        }
    });
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
