import CoordinateSystem from "@giro3d/giro3d/core/geographic/CoordinateSystem";
import Instance from "@giro3d/giro3d/core/Instance";
import Inspector from "@giro3d/giro3d/gui/Inspector";
import { MapControls } from "three/examples/jsm/Addons.js";
import { TransformControls } from 'three/addons/controls/TransformControls';
import StatusBar from "./widgets/StatusBar";
import * as THREE from 'three';
import { OBB } from "3d-tiles-renderer";

const instance = new Instance({
    crs: CoordinateSystem.epsg3857,
    backgroundColor: '#726c69',
    target: 'view',
});

const ambient = new THREE.AmbientLight('white', 0.2);
const sun = new THREE.DirectionalLight('white', 1.5);
sun.target.position.set(0, 0, 0);
sun.position.set(100, 100, 100);
sun.updateMatrixWorld(true);
instance.add(sun);
instance.add(sun.target);
instance.add(ambient);

const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 'white' }),
);
instance.add(plane);

const rand = (a, b) => { return a + Math.random() * (b - a); };
for (let i = 0; i < 25; i++) {

    const h = rand(5, 20);

    const box = new THREE.Mesh(
        new THREE.BoxGeometry(6, 6, h),
        new THREE.MeshStandardMaterial({
            color: new THREE.Color(Math.random(), Math.random(), Math.random())
        })
    );
    box.position.set(rand(-80, 80), rand(-80, 80), 0.5 + h / 2);
    box.updateMatrixWorld(true);
    instance.add(box);
}

instance.scene.updateMatrixWorld();
instance.view.goTo(plane);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target.set(0, 0, 0);
instance.view.setControls(controls);

const MAX_DIST = 100;

const DISTANCE_MATERIAL_SHADERS = {
    vertex: `
        varying vec3 vWorldPos;
        void main() {
            vec4 worldPos = modelMatrix * vec4(position,1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }`,
    fragment: `
        uniform vec3 observerPosition;
        uniform float maxDistance;
        varying vec3 vWorldPos;
        void main() {
            float d = length(vWorldPos - observerPosition);
            float k = clamp(d / maxDistance, 0.0, 1.0);
            gl_FragColor = vec4(k, k, k, 1.0);
        }`
};

function cubeFaceMaterial(cubeTexture, face) {
    return new THREE.ShaderMaterial({
        uniforms:{
            cubeMap:{
                value:cubeTexture
            }
        },
        vertexShader:`
            varying vec2 vUv;
            void main()
            {
                vUv = uv;
                gl_Position =
                    projectionMatrix *
                    modelViewMatrix *
                    vec4(position,1.0);
            }
        `,
        fragmentShader:`
            uniform samplerCube cubeMap;
            varying vec2 vUv;

            vec3 getDirection(vec2 uv, int face)
            {
                // convert 0..1 UV to -1..1
                uv = uv * 2.0 - 1.0;

                if(face == 0) // +X
                    return normalize(vec3(1.0, uv.y, -uv.x));
                if(face == 1) // -X
                    return normalize(vec3(-1.0, uv.y, uv.x));
                if(face == 2) // +Y
                    return normalize(vec3(uv.x, 1.0, -uv.y));
                if(face == 3) // -Y
                    return normalize(vec3(uv.x, -1.0, uv.y));
                if(face == 4) // +Z
                    return normalize(vec3(uv.x, uv.y, 1.0));
                if(face == 5) // -Z
                  return normalize(vec3(-uv.x, uv.y, -1.0));
            }
            void main()
            {
                vec3 dir = getDirection(vUv, ${face});
                gl_FragColor = textureCube(cubeMap, dir);
            }
        `,
        side:THREE.DoubleSide
    });
}

function createCubemapDebugMeshes(size, tex) {
    const group = new THREE.Group();
    group.name = "cubemap";

    // +X
    let p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cubeFaceMaterial(tex, 0));
    p.position.x = size / 2;
    p.rotation.y = Math.PI / 2;
    group.add(p);

    // -X
    p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cubeFaceMaterial(tex, 1));
    p.position.x = -size / 2;
    p.rotation.y = -Math.PI / 2;
    group.add(p);

    // +Y
    p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cubeFaceMaterial(tex, 2));
    p.position.y = size / 2;
    p.rotation.x = -Math.PI / 2;
    group.add(p);

    // -Y
    p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cubeFaceMaterial(tex, 3));
    p.position.y = -size / 2;
    p.rotation.x = Math.PI / 2;
    group.add(p);

    // +Z
    p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cubeFaceMaterial(tex, 4));
    p.position.z = size / 2;
    group.add(p);

    // -Z
    p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cubeFaceMaterial(tex, 5));
    p.position.z = -size / 2;
    p.rotation.y = Math.PI;
    group.add(p);
    return group;
}

class VisibilityManager {

    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        this.observerMesh = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial({color: new THREE.Color(0x0000ff)}));
        this.observerMesh.position.copy(new THREE.Vector3(0, 10, 4));
        this.observerMesh.updateMatrixWorld(true);
        scene.add(this.observerMesh);

        this.cubemapTarget = new THREE.WebGLCubeRenderTarget(4096,
            {
                type: THREE.HalfFloatType,
                generateMipmaps: false,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter
            }
        );
        this.cubeCamera = new THREE.CubeCamera(0.1, MAX_DIST, this.cubemapTarget);
        scene.add(this.cubeCamera);

        this.debugmesh = createCubemapDebugMeshes(100, this.cubemapTarget.texture);
        this.debugmesh.position.set(200, 25, 0);
        this.debugmesh.updateMatrixWorld(true);
        instance.add(this.debugmesh);

        this.distanceMaterial = new THREE.ShaderMaterial({
            uniforms: {
                observerPosition: {value: this.observerMesh.position},
                maxDistance: {value: MAX_DIST}
            },
            vertexShader: DISTANCE_MATERIAL_SHADERS.vertex,
            fragmentShader: DISTANCE_MATERIAL_SHADERS.fragment
        });
        this.distanceMaterial.side = THREE.DoubleSide;

        // this.transformControls = new TransformControls(instance.view.camera, renderer.domElement);
        // this.transformControls.setMode('translate');
        // this.transformControls.addEventListener('dragging-changed', this.onControlDrag);
        // this.transformControls.addEventListener('objectChange', this.onControlChange);
        // this.transformControls.addEventListener('change', this.onControlChange);
        // this.transformControls.attach(this.observerMesh);
        // this.transformControls.getHelper().updateMatrixWorld();
        // scene.add(this.transformControls.getHelper());
        // instance.view.controls.addEventListener('change', this.updateTransformHelper);
    }

    // updateTransformHelper = () => {
    //     this.transformControls.getHelper().updateMatrixWorld();
    //     instance.notifyChange();
    // };
    // onControlDrag = (event) => {
    //     instance.view.controls.enabled = !event.value;
    // };
    // onControlChange = () => {
    //     this.transformControls.getHelper().updateMatrixWorld();
    //     instance.notifyChange(this.observerMesh);
    //     instance.notifyChange(this.transformControls.getHelper());
    //     this.update();
    // };

    update() {
        console.log(this.observerMesh.position)
        this.cubeCamera.position.copy(this.observerMesh.position);
        this.cubeCamera.updateMatrixWorld(true);

        const prevOverrideMaterial = this.scene.overrideMaterial;
        this.scene.overrideMaterial = this.distanceMaterial;
        this.observerMesh.visible = false;
        this.debugmesh.visible = false;

        this.cubeCamera.renderTarget.clear(this.renderer, true, true, true);
        this.cubeCamera.update(this.renderer, this.scene);

        this.observerMesh.visible = true;
        this.debugmesh.visible = true;
        this.scene.overrideMaterial = prevOverrideMaterial;

        this.scene.traverse(obj => {
            if (!obj.isMesh || !obj.material || obj === this.debugmesh || obj.parent === this.debugmesh || obj === this.observerMesh || obj.material.onBeforeCompile === this.injectShader) {
                return;
            }
            obj.material.userData.originalOnBeforeCompile = obj.material.onBeforeCompile;
            obj.material.onBeforeCompile = this.injectShader;
            obj.material.needsUpdate = true;
        });
    }
    injectShader = (shader) => {
        shader.uniforms.visibilityMap = { value: this.cubemapTarget.texture };
        shader.uniforms.observerPos = { value: this.observerMesh.position };
        shader.uniforms.maxDist = { value: MAX_DIST };

        shader.vertexShader =
            'varying vec3 vVisWorld;\n' +
            shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>

            vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
            vVisWorld = worldPos.xyz;
            `
        );

        shader.fragmentShader =
            'varying vec3 vVisWorld;\n' +
            'uniform samplerCube visibilityMap;\n' +
            'uniform vec3 observerPos;\n' +
            'uniform float maxDist;\n' +
            shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            vec3 dir = vVisWorld - observerPos;
            float dist = length(dir);
            vec3 ray = normalize(dir);

            float enc = textureCube(visibilityMap, ray).r;
            float stored = enc * maxDist;

            bool visible = dist <= stored + 0.5;

            vec3 tint = visible
                ? vec3(0.2, 1.0, 0.2)
                : vec3(1.0, 0.2, 0.2);

            gl_FragColor.rgb = mix(gl_FragColor.rgb, tint, 0.8);

            #include <dithering_fragment>
            `
        );
    };
}

const visibility = new VisibilityManager(instance.scene, instance.renderer);
instance.addEventListener('after-render', () => visibility.update());

Inspector.attach('inspector', instance);
StatusBar.bind(instance);

document.addEventListener('keydown', (ev) => {
    if (ev.key === "ArrowDown") {
        if (ev.ctrlKey) {
            visibility.observerMesh.position.z -= 1;
        } else {
            visibility.observerMesh.position.y -= 1;
        }
    } else if (ev.key === "ArrowUp") {
        if (ev.ctrlKey) {
            visibility.observerMesh.position.z += 1;
        } else {
            visibility.observerMesh.position.y += 1;
        }
    } else if (ev.key === "ArrowLeft") {
        visibility.observerMesh.position.x -= 1;
    } else if (ev.key === "ArrowRight") {
        visibility.observerMesh.position.x += 1;
    } else {
        return;
    }
    visibility.observerMesh.updateMatrixWorld(true);
    instance.notifyChange();
});
