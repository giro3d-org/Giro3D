/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import OSM from 'ol/source/OSM.js';
import { AdditiveBlending, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import StaticImageSource from '@giro3d/giro3d/sources/StaticImageSource.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindButton } from './widgets/bindButton.js';
import { bindTextInput } from './widgets/bindTextInput.js';
import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 0x0a3b59,
});

const map = new Map({ extent, backgroundColor: 'white' });

instance.add(map);

// Create the OpenStreetMap color layer using an OpenLayers source.
// See https://openlayers.org/en/latest/apidoc/module-ol_source_OSM-OSM.html
// for more informations.
const osm = new ColorLayer({
    name: 'osm',
    source: new TiledImageSource({ source: new OSM() }),
});

map.addLayer(osm);

instance.view.camera.position.set(0, 0, 80000000);

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.enableRotate = false;

instance.view.setControls(controls);

Inspector.attach('inspector', instance);
StatusBar.bind(instance);

let url = null;

const extentPreview = new Mesh(
    new PlaneGeometry(1, 1, 1, 1),
    new MeshBasicMaterial({
        color: 'white',
        opacity: 0.1,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
    }),
);

instance.scene.add(extentPreview);

let topLeftCorner;

function drawExtent() {
    return new Promise(resolve => {
        let clickCount = 0;

        const onMouseMove = mouseEvent => {
            if (topLeftCorner) {
                const picked = instance.pickObjectsAt(mouseEvent)[0];
                if (picked) {
                    const currentPoint = picked.point;
                    const width = Math.abs(topLeftCorner.x - currentPoint.x);
                    const height = Math.abs(topLeftCorner.y - currentPoint.y);

                    extentPreview.scale.set(width, height, 1);

                    const center = new Vector3().lerpVectors(currentPoint, topLeftCorner, 0.5);

                    extentPreview.position.copy(center);

                    extentPreview.updateMatrixWorld(true);

                    instance.notifyChange();
                }
            }
        };

        const onClick = mouseEvent => {
            clickCount++;
            const picked = instance.pickObjectsAt(mouseEvent)[0];
            if (picked) {
                controls.enabled = false;
                extentPreview.visible = true;
                const point = picked.point;
                if (clickCount === 1) {
                    topLeftCorner = point;
                    extentPreview.scale.set(0, 0, 1);
                } else if (clickCount === 2) {
                    instance.domElement.removeEventListener('mousedown', onClick);
                    instance.domElement.removeEventListener('mousemove', onMouseMove);

                    topLeftCorner = null;

                    const { x, y } = extentPreview.position;
                    const scale = extentPreview.scale;

                    controls.enabled = true;

                    resolve(
                        Extent.fromCenterAndSize(
                            instance.coordinateSystem,
                            { x, y },
                            scale.x,
                            scale.y,
                        ),
                    );
                }
            }
        };

        instance.domElement.addEventListener('mousedown', onClick);
        instance.domElement.addEventListener('mousemove', onMouseMove);
    });
}

let currentImage;

const showErrorMessage = (show, message) => {
    const errorElement = document.getElementById('error');
    if (show) {
        errorElement.innerText = `Failed to load remote image: ${message}`;
        errorElement.style.display = 'block';
    } else {
        errorElement.style.display = 'none';
    }
};

const startButton = bindButton('draw', button => {
    button.disabled = true;
    showErrorMessage(false);

    drawExtent().then(extent => {
        if (currentImage) {
            map.removeLayer(currentImage, { disposeLayer: true });
        }
        const source = new StaticImageSource({
            extent,
            source: url,
        });
        currentImage = new ColorLayer({ source });

        source.addEventListener('loaded', () => (extentPreview.visible = false));
        source.addEventListener('error', ({ error }) => {
            extentPreview.visible = false;

            showErrorMessage(true, error.message);
        });

        map.addLayer(currentImage);
        instance.notifyChange(map);
        button.disabled = false;
    });
});

const [setCurrentUrl, currentUrl] = bindTextInput('url', v => {
    url = v;
    startButton.disabled = !url;
});

setCurrentUrl(currentUrl);
