import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import OSM from 'ol/source/OSM.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';
import { bindTextInput } from './widgets/bindTextInput.js';
import { bindButton } from './widgets/bindButton.js';
import { AdditiveBlending, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import StaticImageSource from '@giro3d/giro3d/sources/StaticImageSource.js';

// Define the extent of the map in the web mercator projection.
const extent = new Extent(
    'EPSG:3857',
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

// `viewerDiv` will contain Giro3D' rendering area (the canvas element)
const viewerDiv = document.getElementById('viewerDiv');

// Creates a Giro3D instance
const instance = new Instance(viewerDiv, {
    crs: extent.crs(),
    renderer: {
        clearColor: 0x0a3b59,
    },
});

// Creates a map that will contain the layer
const map = new Map('planar', { extent, backgroundColor: 'white' });

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

instance.useTHREEControls(controls);

Inspector.attach(document.getElementById('panelDiv'), instance);
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
                        Extent.fromCenterAndSize(instance.referenceCrs, { x, y }, scale.x, scale.y),
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
            map.removeLayer(currentImage, { disposLayer: true });
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

const [currentUrl, setUrl] = bindTextInput('url', v => {
    url = v;
    startButton.disabled = !url;
});

url = currentUrl;
startButton.disabled = !url;
