import {
    Vector2,
    Vector3,
    CubeTextureLoader,
    DirectionalLight,
    AmbientLight,
    Fog,
    Color,
    MathUtils,
    DoubleSide,
} from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { DotScreenPass } from 'three/examples/jsm/postprocessing/DotScreenPass.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import GeoJSON from 'ol/format/GeoJSON.js';
import VectorSource from 'ol/source/Vector.js';
import { createXYZ } from 'ol/tilegrid.js';
import { tile } from 'ol/loadingstrategy.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
// NOTE: changing the imported name because we use the native `Map` object in this example.
import Giro3dMap from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const SKY_COLOR = new Color(0xf1e9c6);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:2154',
    backgroundColor: SKY_COLOR,
});

function initPass() {
    // const pass = new DotScreenPass(new Vector2(0, 0), 0.1, 80);
    instance.engine._renderPipeline.effectComposer.addPass(pass);
    instance.removeEventListener('after-render', initPass);
}
const pass = new BokehPass(instance.scene, instance.view.camera, {
    focus: 50,
    aperture: 0.05 * 0.00001,
    maxblur: 0.05,
});
instance.engine.renderingOptions.customPasses = [pass];

const extent = new Extent('EPSG:2154', -111629.52, 1275028.84, 5976033.79, 7230161.64);

// create a map
const map = new Giro3dMap({
    extent,
    backgroundColor: 'gray',
    lighting: {
        enabled: true,
        elevationLayersOnly: true,
    },
    discardNoData: true,
    side: DoubleSide,
});

instance.add(map);

const noDataValue = -1000;

const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

// Let's build the elevation layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue,
})
    .then(elevationWmts => {
        map.addLayer(
            new ElevationLayer({
                name: 'elevation',
                extent: map.extent,
                // We don't need the full resolution of terrain
                // because we are not using any shading. This will save a lot of memory
                // and make the terrain faster to load.
                resolutionFactor: 0.25,
                minmax: { min: 0, max: 5000 },
                noDataOptions: {
                    replaceNoData: false,
                },
                source: elevationWmts,
            }),
        );
    })
    .catch(console.error);

// Let's build the color layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        map.addLayer(
            new ColorLayer({
                name: 'color',
                extent: map.extent,
                source: orthophotoWmts,
            }),
        );
    })
    .catch(console.error);

const buildingSource = new VectorSource({
    format: new GeoJSON(),
    url: function url(bbox) {
        return `${
            'https://data.geopf.fr/wfs/ows' +
            '?SERVICE=WFS' +
            '&VERSION=2.0.0' +
            '&request=GetFeature' +
            '&typename=BDTOPO_V3:batiment' +
            '&outputFormat=application/json' +
            '&SRSNAME=EPSG:2154' +
            '&startIndex=0' +
            '&bbox='
        }${bbox.join(',')},EPSG:2154`;
    },
    strategy: tile(createXYZ({ tileSize: 512 })),
});

const hoverColor = new Color('yellow');

// This is the style function that will assign a different style depending on a feature's attribute.
// The `feature` argument is an OpenLayers feature.
const buildingStyle = feature => {
    const properties = feature.getProperties();
    let fillColor = '#FFFFFF';

    const hovered = properties.hovered ?? false;
    const clicked = properties.clicked ?? false;

    switch (properties.usage_1) {
        case 'Industriel':
            fillColor = '#f0bb41';
            break;
        case 'Agricole':
            fillColor = '#96ff0d';
            break;
        case 'Religieux':
            fillColor = '#41b5f0';
            break;
        case 'Sportif':
            fillColor = '#ff0d45';
            break;
        case 'Résidentiel':
            fillColor = '#cec8be';
            break;
        case 'Commercial et services':
            fillColor = '#d8ffd4';
            break;
    }

    const fill = clicked
        ? 'yellow'
        : hovered
          ? new Color(fillColor).lerp(hoverColor, 0.2) // Let's use a slightly brighter color for hover
          : fillColor;

    return {
        fill: {
            color: fill,
            shading: true,
        },
        stroke: {
            color: clicked ? 'yellow' : hovered ? 'white' : 'black',
            lineWidth: clicked ? 5 : undefined,
        },
    };
};

// Let's compute the extrusion offset of building polygons to give them walls.
const extrusionOffsetCallback = feature => {
    const properties = feature.getProperties();
    const buildingHeight = properties['hauteur'];
    const extrusionOffset = -buildingHeight;

    if (Number.isNaN(extrusionOffset)) {
        return null;
    }
    return extrusionOffset;
};

const featureCollection = new FeatureCollection({
    source: buildingSource,
    extent,
    extrusionOffset: extrusionOffsetCallback,
    style: buildingStyle,
    minLevel: 11,
    maxLevel: 11,
});

instance.add(featureCollection);

// To make sure that the buildings remain correctly displayed whenever
// one entity become transparent (i.e it's opacity is less than 1), we need
// to set the render of the feature collection to be greater than the map's.
map.renderOrder = 0;
featureCollection.renderOrder = 1;

// Add a sunlight
const sun = new DirectionalLight('#ffffff', 2);
sun.position.set(1, 0, 1).normalize();
sun.updateMatrixWorld(true);
instance.scene.add(sun);

// We can look below the floor, so let's light also a bit there
const sun2 = new DirectionalLight('#ffffff', 0.5);
sun2.position.set(0, 1, 1);
sun2.updateMatrixWorld();
instance.scene.add(sun2);

// Add an ambient light
const ambientLight = new AmbientLight(0xffffff, 0.2);
instance.scene.add(ambientLight);

instance.view.camera.position.set(913349.2364044407, 6456426.459171033, 1706.0108044011636);

const lookAt = new Vector3(913896, 6459191, 200);
instance.view.camera.lookAt(lookAt);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.4;
controls.target.copy(lookAt);
controls.saveState();
instance.view.setControls(controls);

// add a skybox background
const cubeTextureLoader = new CubeTextureLoader();
cubeTextureLoader.setPath('image/skyboxsun25deg_zup/');
const cubeTexture = cubeTextureLoader.load([
    'px.jpg',
    'nx.jpg',
    'py.jpg',
    'ny.jpg',
    'pz.jpg',
    'nz.jpg',
]);

instance.scene.background = cubeTexture;

// information on click
const resultTable = document.getElementById('results');

let lastCameraPosition = new Vector3(0, 0, 0);
const tempVec3 = new Vector3(0, 0, 0);

function truncate(value, length) {
    if (value == null) {
        return null;
    }

    const text = `${value}`;

    if (text.length < length) {
        return text;
    }

    return text.substring(0, length) + '…';
}

// Fill the attribute table with the objects' attributes.
function fillTable(objects) {
    resultTable.innerHTML = '';
    document.getElementById('card').style.display = objects.length > 0 ? 'block' : 'none';

    for (const obj of objects) {
        if (!obj.userData.feature) {
            continue;
        }
        const p = obj.userData.feature.getProperties();

        const entries = [];
        for (const [key, value] of Object.entries(p)) {
            if (key !== 'geometry' && key !== 'clicked' && key !== 'hovered') {
                const entry = `<tr>
                <td title="${key}"><code>${truncate(key, 12)}</code></td>
                <td title="${value}">${truncate(value, 18) ?? '<code>null</code>'}</td>
                </tr>`;
                entries.push(entry);
            }
        }

        resultTable.innerHTML += `
        <table class="table table-sm table-striped">
            <thead>
                <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Value</th>
                </tr>
            </thead>
            <tbody>
                ${entries.join('')}
            </tbody>
        </table>
    `;
    }
}

const previousHovered = [];
const previousClicked = [];
const objectsToUpdate = [];

function pick(e, click) {
    const pickedObjects = instance.pickObjectsAt(e, {
        where: [featureCollection],
    });

    if (click) {
        previousClicked.forEach(obj => obj.userData.feature.set('clicked', false));
    } else {
        previousHovered.forEach(obj => obj.userData.feature.set('hovered', false));
    }

    const property = click ? 'clicked' : 'hovered';

    objectsToUpdate.length = 0;

    if (pickedObjects.length > 0) {
        const picked = pickedObjects[0];
        const obj = picked.object;
        const { feature } = obj.userData;

        feature.set(property, true);

        objectsToUpdate.push(obj);
    }

    if (click) {
        fillTable(objectsToUpdate);
    }

    // To avoid updating all the objects and lose a lot of performance,
    // we only update the objects that have changed.
    const updatedObjects = [...previousHovered, ...previousClicked, ...objectsToUpdate];
    if (click) {
        previousClicked.splice(0, previousClicked.length, ...objectsToUpdate);
    } else {
        previousHovered.splice(0, previousHovered.length, ...objectsToUpdate);
    }

    if (updatedObjects.length > 0) {
        featureCollection.updateStyles(updatedObjects);
    }
}

const hover = e => pick(e, false);
const click = e => pick(e, true);

instance.domElement.addEventListener('mousemove', hover);
instance.domElement.addEventListener('click', click);

const DOWN_VECTOR = new Vector3(0, 0, -1);
const EARTH_RADIUS = 6_3781_000;
const tmpVec3 = new Vector3();

const fog = new Fog(SKY_COLOR, 1, 2);
instance.scene.fog = fog;

function processFogAndClippingPlanes(camera) {
    // Compute the tilt, in radians, of the camera.
    const tilt = DOWN_VECTOR.angleTo(camera.camera.getWorldDirection(tmpVec3));

    const altitude = MathUtils.clamp(camera.camera.position.z, 20, 100000);

    const maxFarPlane = 9_999_999;
    const actualTilt = MathUtils.clamp(tilt, 0, Math.PI / 3);
    const horizon = Math.sqrt(2 * altitude * EARTH_RADIUS) * 0.2;

    camera.maxFarPlane = MathUtils.mapLinear(actualTilt, 0, Math.PI / 3, maxFarPlane, horizon);
    fog.far = camera.far;
    fog.near = MathUtils.lerp(camera.near, camera.far, 0.2);
}

instance.addEventListener('after-camera-update', event =>
    processFogAndClippingPlanes(event.camera),
);

processFogAndClippingPlanes(instance.view);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
