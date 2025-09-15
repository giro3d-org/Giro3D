/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Color, Mesh } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import { ASPRS_CLASSIFICATIONS, MODE } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';

import StatusBar from './widgets/StatusBar.js';
import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.fromEpsg(2154),
    backgroundColor: null, // To make the canvas transparent and show the actual CSS background
});

// Enables post-processing effects to improve readability of point cloud.
instance.renderingOptions.enableEDL = true;
instance.renderingOptions.enableInpainting = true;
instance.renderingOptions.enablePointCloudOcclusion = true;

instance.view.camera.position.set(227137, 6876151, 128);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(227423, 6876442, 0);
controls.saveState();
instance.view.setControls(controls);

const classifications = ASPRS_CLASSIFICATIONS.map(c => c.clone());

// The default classifications provide colors for classifications 0-63,
// i.e the reserved range for ASPRS classifications.
// Classifications in the 64-255 range are user-defined.
classifications[64].color = new Color(0x94a770); // Classification "Sursol pérenne"
classifications[65].color = new Color(0xd3ff00); // Classification "Artefacts"
classifications[66].color = new Color(0x00ff8d); // Classification "Points virtuels"

// Original dataset extracted from the French IGN LIDAR HD
// database (https://geoservices.ign.fr/lidarhd#telechargementclassifiees),
// then converted to 3D Tiles with py3dtiles (https://gitlab.com/py3dtiles/py3dtiles)
const url =
    'https://3d.oslandia.com/giro3d/3d-tiles/LHD_FXX_0227_6877_PTS_C_LAMB93_IGN69/tileset.json';

const pointcloud = new Tiles3D({
    url,
    // Attributes in the original tileset do not have the same casing
    // as the names expected by the entity, so we have to map them.
    pointCloudAttributeMapping: {
        classification: 'Classification',
        intensity: 'Intensity',
    },
    pointCloudMode: MODE.CLASSIFICATION,
    errorTarget: 14,
    classifications,
});

instance.add(pointcloud);

const classificationNames = new Array(32);

// GUI controls for classification handling

function addClassification(number, name) {
    const currentColor = pointcloud.pointCloudClassifications[number].color.getHexString();

    const template = `
    <div class="form-check form-switch">
        <input
            class="form-check-input"
            type="checkbox"
            checked
            role="switch"
            id="class-${number}"
            autocomplete="off"
        />
        <label class="form-check-label w-100" for="class-${number}">
            <div class="row">
                <div class="col" >${name}</div>
                <div class="col-auto">
                    <input
                        type="color"
                        style="height: 1.5rem"
                        class="form-control form-control-color float-end"
                        id="color-${number}"
                        value="#${currentColor}"
                        title="Classification color"
                    />
                </div>
            </div>
        </label>
    </div>
    `;

    const node = document.createElement('div');
    node.innerHTML = template;
    document.getElementById('classifications').appendChild(node);

    // Let's change the classification color with the color picker value
    bindColorPicker(`color-${number}`, v => {
        // Parse it into a THREE.js color
        const color = new Color(v);

        pointcloud.pointCloudClassifications[number].color = color;

        instance.notifyChange();
    });

    classificationNames[number] = name;

    bindToggle(`class-${number}`, enabled => {
        // By toggling the .visible property of a classification,
        // all points that have this classification are hidden/shown.
        pointcloud.pointCloudClassifications[number].visible = enabled;
        instance.notifyChange();
    });
}

// Standard ASPRS classifications found in the dataset
addClassification(1, 'Unclassified');
addClassification(2, 'Ground');
addClassification(3, 'Low vegetation');
addClassification(4, 'Medium vegetation');
addClassification(5, 'High vegetation');
addClassification(6, 'Building');
addClassification(9, 'Water');

// Dataset-specific classifications
addClassification(64, 'Permanent above-ground structures');
addClassification(65, 'Artifacts');
addClassification(67, 'Virtual points');

const labelElement = document.createElement('div');
labelElement.classList.value = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';

const classifName = document.createElement('span');
classifName.style.marginLeft = '0.5rem';

const classifColor = document.createElement('span');
classifColor.classList.value = 'badge rounded-pill';
classifColor.style.color = 'white';
classifColor.style.background = 'red';
classifColor.style.width = '1rem';
classifColor.innerText = ' ';

labelElement.appendChild(classifColor);
labelElement.appendChild(classifName);

const label = new CSS2DObject(labelElement);

instance.add(label);

// Let's query the classification of the picked point and display it in the label.
function updateLabel(mouseEvent) {
    const results = instance.pickObjectsAt(mouseEvent, { radius: 6 });

    // Reset label visibility
    label.visible = false;

    if (results && results.length > 0) {
        for (const result of results) {
            const { object, point, index } = result;

            if (!(object instanceof Mesh)) {
                continue;
            }

            const classificationIndex = object.geometry.getAttribute('classification').getX(index);

            const classification = pointcloud.pointCloudClassifications[classificationIndex];

            // Let's ignore hidden classifications
            if (classification && classification.visible) {
                const color = classification.color.getHexString();
                classifColor.style.background = `#${color}`;

                classifName.innerText = classificationNames[classificationIndex];

                label.visible = true;
                label.position.copy(point);
                label.updateMatrixWorld(true);

                break;
            }
        }
    }

    instance.notifyChange();
}

bindSlider('pointSize', v => {
    pointcloud.pointSize = v;
    instance.notifyChange(pointcloud);
});

bindToggle('postProcessingEffects', v => {
    instance.renderingOptions.enableEDL = v;
    instance.renderingOptions.enableInpainting = v;
    instance.renderingOptions.enablePointCloudOcclusion = v;
    instance.notifyChange(pointcloud);
});

instance.domElement.addEventListener('mousemove', updateLabel);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
