/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    Color,
    DirectionalLight,
    AmbientLight,
    Vector3,
    GridHelper,
    MathUtils,
    AlwaysStencilFunc,
    BackSide,
    DecrementWrapStencilOp,
    FrontSide,
    IncrementWrapStencilOp,
    Mesh,
    MeshBasicMaterial,
    Plane,
    PlaneHelper,
    MeshStandardMaterial,
    NotEqualStencilFunc,
    PlaneGeometry,
    ReplaceStencilOp,
    Clock,
} from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

const tmpVec3 = new Vector3();

const crs = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const instance = new Instance({
    target: 'view',
    crs,
    backgroundColor: 0xcccccc,
    renderer: {
        stencil: true,
    },
});

// Add a sunlight
const sun = new DirectionalLight('#ffffff', 1.4);
sun.position.set(1, 0, 1).normalize();
sun.updateMatrixWorld(true);
instance.scene.add(sun);

// We can look below the floor, so let's light also a bit there
const sun2 = new DirectionalLight('#ffffff', 0.5);
sun2.position.set(0, -1, 1);
sun2.updateMatrixWorld();
instance.scene.add(sun2);

// Add ambient light
const ambientLight = new AmbientLight(0xffffff, 1);
instance.scene.add(ambientLight);
instance.view.minNearPlane = 0.5;

const ifc = new Tiles3D({
    url: 'https://3d.oslandia.com/3dtiles/19_rue_Marc_Antoine_Petit_ifc/tileset.json',
});

// Hide some elements that don't bring visual value
ifc.addEventListener('object-created', evt => {
    const scene = evt.obj;
    scene.traverse(obj => {
        if (obj.userData?.class === 'IfcSpace') {
            obj.visible = false;
            instance.notifyChange();
        }
    });
});

function placeCamera(position, lookAt) {
    instance.view.camera.position.set(position.x, position.y, position.z);
    instance.view.camera.lookAt(lookAt);
    // create controls
    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(lookAt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    instance.view.setControls(controls);

    instance.notifyChange(instance.view.camera);
}

let newMeshes = [];

const baseMat = new MeshBasicMaterial();
baseMat.depthWrite = false;
baseMat.depthTest = false;
baseMat.colorWrite = false;
baseMat.stencilWrite = true;
baseMat.stencilFunc = AlwaysStencilFunc;

const stencilBack = baseMat.clone();
stencilBack.side = BackSide;
stencilBack.stencilFail = IncrementWrapStencilOp;
stencilBack.stencilZFail = IncrementWrapStencilOp;
stencilBack.stencilZPass = IncrementWrapStencilOp;

const stencilFront = baseMat.clone();
stencilFront.side = FrontSide;
stencilFront.stencilFail = DecrementWrapStencilOp;
stencilFront.stencilZFail = DecrementWrapStencilOp;
stencilFront.stencilZPass = DecrementWrapStencilOp;

function createStencilMeshes(baseMesh, plane) {
    if (baseMesh.userData.__stencilFront != null) {
        return;
    }

    if (baseMesh.userData.__stencil === true) {
        return;
    }

    const material = baseMesh.material;
    const geometry = baseMesh.geometry;

    if (geometry.boundingBox == null) {
        geometry.computeBoundingBox();
    }

    const bbox = geometry.boundingBox.clone().applyMatrix4(baseMesh.matrixWorld);
    if (!plane.intersectsBox(bbox)) {
        return;
    }

    stencilBack.clippingPlanes = [plane];
    stencilFront.clippingPlanes = [plane];

    const meshBack = new Mesh(geometry, stencilBack);
    const meshFront = new Mesh(geometry, stencilFront);

    meshBack.renderOrder = 1;
    meshFront.renderOrder = 1;

    baseMesh.userData.__stencilFront = meshFront;
    baseMesh.userData.__stencilBack = meshBack;

    meshBack.updateMatrixWorld(true);
    meshFront.updateMatrixWorld(true);

    meshBack.name = 'back';
    meshFront.name = 'front';

    meshFront.userData.__stencil = true;
    meshBack.userData.__stencil = true;

    newMeshes.push([baseMesh, meshBack, meshFront]);
    // instance.add(meshBack);
    // instance.add(meshFront);
}

// add pointcloud to scene
function initializeCamera() {
    const bbox = ifc.getBoundingBox();

    const ratio = bbox.getSize(tmpVec3).x / bbox.getSize(tmpVec3).z;

    const position = bbox
        .getCenter(new Vector3())
        .clone()
        .add(bbox.getSize(tmpVec3).multiply(new Vector3(-2, -2, ratio)));

    const lookAt = bbox.getCenter(tmpVec3);
    lookAt.z = bbox.min.z;

    placeCamera(position, lookAt);

    const grid = new GridHelper(60, 10);
    grid.rotateX(MathUtils.degToRad(90));

    grid.position.copy(lookAt);

    instance.add(grid);
    grid.updateMatrixWorld(true);

    const planeCenter = bbox.getCenter(new Vector3());
    planeCenter.setZ(planeCenter.z + 8);

    const plane = new Plane()
        .setFromNormalAndCoplanarPoint(new Vector3(0, 0, 1), planeCenter)
        .negate();

    const planeHelper = new PlaneHelper(plane, 50);

    instance.add(planeHelper);

    planeHelper.position.copy(planeCenter);

    planeHelper.updateMatrixWorld(true);

    ifc.clippingPlanes = [plane];

    instance.addEventListener('update-end', () => {
        newMeshes.length = 0;
        ifc.traverseMeshes(m => createStencilMeshes(m, plane));
        if (newMeshes.length > 0) {
            for (const [parent, a, b] of newMeshes) {
                parent.add(a, b);
                parent.updateMatrixWorld(true);
            }
            instance.notifyChange();
        }
    });

    const planeMesh = new Mesh(
        new PlaneGeometry(50, 50),
        new MeshStandardMaterial({
            color: 'black',
            metalness: 0.1,
            side: BackSide,
            roughness: 0.75,

            stencilWrite: true,
            stencilRef: 0,
            stencilFunc: NotEqualStencilFunc,
            stencilFail: ReplaceStencilOp,
            stencilZFail: ReplaceStencilOp,
            stencilZPass: ReplaceStencilOp,
        }),
    );

    planeMesh.renderOrder = 5;
    planeMesh.onAfterRender = renderer => renderer.clearStencil();

    planeMesh.position.copy(planeCenter);
    planeMesh.lookAt(planeCenter.clone().add(plane.normal));
    planeMesh.updateMatrixWorld(true);

    instance.add(planeMesh);

    // const c = plane.constant;

    // const clock = new Clock();

    // function animate() {
    //     const dt = clock.getDelta();
    //     plane.constant = c + 20 * Math.sin(dt);

    //     instance.render();
    //     requestAnimationFrame(animate);
    // }

    // animate();

    StatusBar.bind(instance);
}

instance.add(ifc).then(initializeCamera);

Inspector.attach('inspector', instance);
