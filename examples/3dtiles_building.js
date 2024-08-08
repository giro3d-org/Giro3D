import { Color, DirectionalLight, AmbientLight, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Tiles3DSource from '@giro3d/giro3d/sources/Tiles3DSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

const tmpVec3 = new Vector3();

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

// add some lights
const sun = new DirectionalLight('#ffffff', 1.4);
sun.position.set(1, 0, 1).normalize();
sun.updateMatrixWorld(true);
instance.scene.add(sun);

// We can look below the floor, so let's light also a bit there
const sun2 = new DirectionalLight('#ffffff', 0.5);
sun2.position.set(0, -1, 1);
sun2.updateMatrixWorld();
instance.scene.add(sun2);

// ambient
const ambientLight = new AmbientLight(0xffffff, 1);
instance.scene.add(ambientLight);
instance.view.minNearPlane = 0.5;

// Configure Point Cloud
const ifc = new Tiles3D(
    new Tiles3DSource('https://3d.oslandia.com/3dtiles/19_rue_Marc_Antoine_Petit_ifc/tileset.json'),
);

// Hide some elements that don't bring visual value
ifc.addEventListener('object-created', evt => {
    const obj = evt.obj;
    if (obj.userData?.class === 'IfcSpace') {
        obj.visible = false;
    }
});

function placeCamera(position, lookAt) {
    instance.view.camera.position.set(position.x, position.y, position.z);
    instance.view.camera.lookAt(lookAt);
    // create controls
    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(lookAt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    instance.useTHREEControls(controls);

    instance.notifyChange(instance.view.camera);
}

// add pointcloud to scene
function initializeCamera() {
    const bbox = ifc.root.bbox
        ? ifc.root.bbox
        : ifc.root.boundingVolume.box.clone().applyMatrix4(ifc.root.matrixWorld);

    // instance.view.camera.far = 2.0 * bbox.getSize(tmpVec3).length();

    const ratio = bbox.getSize(tmpVec3).x / bbox.getSize(tmpVec3).z;
    const position = bbox.min
        .clone()
        .add(bbox.getSize(tmpVec3).multiply({ x: -2, y: -2, z: ratio }));
    const lookAt = bbox.getCenter(tmpVec3);
    lookAt.z = bbox.min.z;
    placeCamera(position, lookAt);

    StatusBar.bind(instance);
}

instance.add(ifc).then(initializeCamera);

Inspector.attach(document.getElementById('panelDiv'), instance);

const resultsTable = document.getElementById('results-body');
const formatter = new Intl.NumberFormat();

function format(point) {
    return `x: ${formatter.format(point.x)}\n
            y: ${formatter.format(point.y)}\n
            z: ${formatter.format(point.z)}`;
}

let highlighted;
let highlightColor = new Color(0xff7171);
function highlight(evt) {
    const picked = instance.pickObjectsAt(evt, { radius: 5, limit: 10, where: [ifc] });
    if (highlighted) {
        // reset style
        highlighted.material.color.copy(highlighted.material.userData.oldColor);
        highlighted.material.needsUpdate = true;
        instance.notifyChange(highlighted);
    }
    if (picked.length === 0) {
        const row = document.createElement('tr');
        const count = document.createElement('th');
        count.setAttribute('scope', 'row');
        count.innerText = '-';
        const coordinates = document.createElement('td');
        coordinates.innerText = '-';
        const distanceToCamera = document.createElement('td');
        distanceToCamera.innerText = '-';
        row.append(count, coordinates, distanceToCamera);
        resultsTable.replaceChildren(row);
    } else {
        const obj = picked[0].object;
        // keep the old color to reset it later
        if (!obj.material.userData.oldColor) {
            obj.material.userData.oldColor = obj.material.color.clone();
        }
        obj.material.color.copy(highlightColor);
        instance.notifyChange(obj);

        highlighted = obj;

        const rows = [];
        for (const [name, value] of Object.entries(obj.userData)) {
            if (name !== 'oldColor' && name !== 'parentEntity') {
                const row = document.createElement('tr');
                const nameCell = document.createElement('td');
                nameCell.innerHTML = `<code>${name}</code>`;
                const valueCell = document.createElement('td');
                valueCell.innerText = value;
                row.append(nameCell, valueCell);
                rows.push(row);
            }
        }
        resultsTable.replaceChildren(...rows);
    }
}

instance.domElement.addEventListener('click', highlight);
