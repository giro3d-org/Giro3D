/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

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
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import OffscreenInstance from '@giro3d/giro3d/core/OffscreenInstance.js';

let instance;
let camera;
let mixers = [];
let models = [];
const clock = new Clock();

function tick() {
    const delta = clock.getDelta();

    // AnimationMixer runs exactly as it would with plain Three.js, independently of the camera;
    // we just drive it ourselves every frame.
    for (const mixer of mixers) {
        mixer.update(delta);
    }

    // The scene's matrixWorldAutoUpdate is off (InstanceBase sets this, same as Instance), so
    // WebGLRenderer.render() won't recompute world matrices on its own. AnimationMixer only
    // touches each bone's *local* transform, so without this, the animated pose would never
    // propagate past the bind pose (the same reason three-js-integration.js calls this too).
    for (const model of models) {
        model.updateMatrixWorld();
    }

    // Unconditional: the models above keep animating regardless of whether the camera (see the
    // 'cameraTransform' message below) is moving.
    instance.notifyChange();

    self.requestAnimationFrame(tick);
}

self.addEventListener('message', event => {
    const { canvas, resize, cameraTransform } = event.data;

    if (resize) {
        instance.engine.onWindowResize(resize.width, resize.height);
        return;
    }

    if (cameraTransform) {
        // Mirrors the main thread's MapControls-driven camera (see offscreen-instance.js) onto
        // the real camera here. updateMatrixWorld() is required because nothing else touches
        // this camera's world matrix between messages, and the MainLoop update that
        // notifyChange() triggers reads it before the next render.
        camera.position.fromArray(cameraTransform.position);
        camera.quaternion.fromArray(cameraTransform.quaternion);
        camera.updateMatrixWorld();
        instance.notifyChange(camera);
        return;
    }

    instance = new OffscreenInstance({
        canvas,
        crs: CoordinateSystem.epsg3857,
    });

    instance.renderer.shadowMap.enabled = true;

    // MainLoop's automatic near/far plane computation only looks at Giro3D entities and objects
    // added through instance.threeObjects (see the TODO in MainLoop.ts); the ground and models
    // below are added straight to instance.scene, so it would see no objects at all and clamp
    // the far plane to 0, making everything disappear. Not needed here anyway: nothing in this
    // scene moves far from the camera.
    instance.mainLoop.automaticCameraPlaneComputation = false;

    // A darker, cooler palette than three-js-integration.js's, so this doesn't read as a copy
    // of it at a glance: this one's about running off the main thread, not about the model.
    instance.scene.background = new Color(0x05070a);
    instance.scene.fog = new Fog(0x05070a, 15, 55);

    const hemiLight = new HemisphereLight(0x8ab4f8, 0x0a0e14, 1.5);
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

    // A ground plane to receive the shadows. PlaneGeometry already lies flat in the XY plane
    // (normal along +Z), which matches Giro3D's Z-up convention without needing a rotation.
    const ground = new Mesh(
        new PlaneGeometry(200, 200),
        new MeshPhongMaterial({ color: 0x12151c, depthWrite: false }),
    );
    ground.receiveShadow = true;
    instance.scene.add(ground);

    // The main thread's camera is the single source of truth (see offscreen-instance.js): it
    // sends its initial transform right after this message, so there's no pose to set up here.
    camera = instance.view.camera;

    // Loaded the same way as the three-js-integration example, using one of the Three.js
    // loaders directly: this exercises GLTFLoader actually fetching and parsing a real asset
    // from inside a Worker, not just rendering a static scene.
    const loader = new GLTFLoader();
    loader.load('https://threejs.org/examples/models/gltf/Soldier.glb', gltf => {
        gltf.scene.traverse(object => {
            // @ts-expect-error typing
            if (object.isMesh) {
                object.castShadow = true;
            }
        });

        // this code is virtually identical to the three-js-integration example, and to
        // https://threejs.org/examples/webgl_animation_multiple
        const model1 = clone(gltf.scene);
        const model2 = clone(gltf.scene);
        const model3 = clone(gltf.scene);
        models = [model1, model2, model3];

        const mixer1 = new AnimationMixer(model1);
        const mixer2 = new AnimationMixer(model2);
        const mixer3 = new AnimationMixer(model3);
        mixers = [mixer1, mixer2, mixer3];

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

        // OffscreenInstance has no entity system, so unlike instance.add() in other examples,
        // we add directly to the Three.js scene.
        for (const model of models) {
            instance.scene.add(model);
        }

        self.requestAnimationFrame(tick);
    });
});
