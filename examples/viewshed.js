import CoordinateSystem from "@giro3d/giro3d/core/geographic/CoordinateSystem";
import Instance from "@giro3d/giro3d/core/Instance";
import Inspector from "@giro3d/giro3d/gui/Inspector";
import { AmbientLight, BoxGeometry, DirectionalLight, Mesh, MeshStandardMaterial, Plane, PlaneGeometry } from "three";
import { MapControls } from "three/examples/jsm/Addons.js";
import StatusBar from "./widgets/StatusBar";
import * as THREE from 'three';
import { OBB } from "3d-tiles-renderer";

const instance = new Instance({
    crs: CoordinateSystem.epsg3857,
    backgroundColor: '#726c69',
    target: 'view',
});

const plane = new Mesh(
    new PlaneGeometry(100, 100, 1, 1),
    new MeshStandardMaterial({ color: 'white' }),
);

const box = new Mesh(
    new BoxGeometry(10, 10, 10, 1, 1),
    new MeshStandardMaterial({ color: 'blue' })
);

const ambient = new AmbientLight('white', 0.2);
const sun = new DirectionalLight('white', 1.5);
sun.target.position.set(0, 0, 0);
sun.position.set(100, 100, 100);

instance.add(plane);
instance.add(box);

box.position.set(0, 0, 5);
box.updateMatrixWorld(true);

sun.updateMatrixWorld(true);
instance.scene.updateMatrixWorld();
instance.add(sun);
instance.add(sun.target);
instance.add(ambient);

instance.view.goTo(plane);

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.target.set(0, 0, 0);

instance.view.setControls(controls);

const MAX_DIST = 30;
const observer = new THREE.Vector3(0, 10, 4);

const observerMesh = new THREE.AxesHelper(20);
observerMesh.position.copy(observer);
instance.add(observerMesh);
observerMesh.updateMatrixWorld();

const depthMaterial = new THREE.ShaderMaterial({

    uniforms: {
        observerPosition: { value: observer },
        maxDistance: { value: MAX_DIST }
    },
    vertexShader: /* glsl */`
        varying vec3 vWorldPos;
        void main() {
            vec4 worldPos = modelMatrix * vec4(position,1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,

    fragmentShader: /* glsl */`
        uniform vec3 observerPosition;
        uniform float maxDistance;
        varying vec3 vWorldPos;
        void main() {
            float d = length(vWorldPos - observerPosition);
            float encoded = clamp(d / maxDistance, 0.0, 1.0);
            gl_FragColor = vec4(encoded, encoded, encoded, 1.0);
        }
      `
});
function cubeFaceMaterial(cubeTexture, face)
{
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

    constructor(scene, observer) {
        this.cubemap = new THREE.WebGLCubeRenderTarget(4096, { type: THREE.HalfFloatType });
        this.cubeCamera = new THREE.CubeCamera(0.1, MAX_DIST, this.cubemap);
        scene.add(this.cubeCamera);
        this.scene = scene;
        this.observer = observer;
        this.maxDist = MAX_DIST;
        this.injected = new WeakSet();

        this.debugmesh = createCubemapDebugMeshes(50, this.cubemap.texture);
        this.debugmesh.position.set(200, 25, 0);
        this.debugmesh.updateMatrixWorld(true);
        instance.add(this.debugmesh);
    }

    render() {
        this.debugmesh.visible = false;
        observerMesh.visible = false;
        this.cubeCamera.position.copy(this.observer);
        this.cubeCamera.updateMatrixWorld(true);
        this.scene.overrideMaterial = depthMaterial;
        this.cubeCamera.update(instance.renderer, this.scene);
        this.scene.overrideMaterial = null;
        this.debugmesh.visible = true;
        observerMesh.visible = true;
    }

    inject(mat) {
        if (!mat || this.injected.has(mat)) return;

        mat.onBeforeCompile = (shader) => {

            shader.uniforms.visibilityMap = { value: this.cubemap.texture };
            shader.uniforms.observerPos = { value: this.observer };
            shader.uniforms.maxDist = { value: this.maxDist };

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

                gl_FragColor.rgb = mix(gl_FragColor.rgb, tint, 0.5);

                #include <dithering_fragment>
                `
            );
        };

        mat.needsUpdate = true;
        this.injected.add(mat);
    }

    scan() {
        this.scene.traverse(obj => {
            if (!obj.isMesh || obj == this.debugmesh || obj.parent == this.debugmesh) return;
            this.inject(obj.material);
        });
    }

    update() {
        this.render();
        this.scan();
    }
}

const visibility = new VisibilityManager(instance.scene, observer);
instance.addEventListener('after-render', () => visibility.update());

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
