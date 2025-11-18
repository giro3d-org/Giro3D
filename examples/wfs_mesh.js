/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { tile } from 'ol/loadingstrategy.js';
import VectorSource from 'ol/source/Vector.js';
import { createXYZ } from 'ol/tilegrid.js';
import { Color, CubeTextureLoader } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { MathUtils } from 'three/src/math/MathUtils.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.register(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

const extent = Extent.fromCenterAndSize(crs, { x: 1842741, y: 5174060 }, 30000, 30000);

const instance = new Instance({
    target: 'view',
    crs,
});

const map = new Map({ extent });

instance.add(map);

const capabilitiesUrl =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        map.addLayer(
            new ColorLayer({
                name: 'wmts_orthophotos',
                extent: map.extent,
                source: orthophotoWmts,
            }),
        );
    })
    .catch(console.error);

// define the source of our data
const busLinesSource = new VectorSource({
    format: new GeoJSON(),
    url: function url(tileExtent) {
        return `${
            'https://download.data.grandlyon.com/wfs/rdata' +
            '?SERVICE=WFS' +
            '&VERSION=2.0.0' +
            '&request=GetFeature' +
            '&typename=tcl_sytral.tcllignebus_2_0_0' +
            '&outputFormat=application/json;%20subtype=geojson' +
            '&SRSNAME=EPSG:3946' +
            '&startIndex=0' +
            '&bbox='
        }${tileExtent.join(',')},EPSG:3946`;
    },
    strategy: tile(createXYZ({ tileSize: 512 })),
});

function randColor() {
    const hue = MathUtils.randFloat(0, 1);
    return new Color().setHSL(hue, 0.8, 0.5, 'srgb');
}

function makeStyle() {
    return { color: randColor(), width: 8, renderOrder: MathUtils.randInt(0, 200) };
}

const lineStyles = {};

// Create the `FeatureCollection` entity that will load our features as meshes.
const busLines = new FeatureCollection({
    name: 'bus lines',
    source: busLinesSource,
    extent,
    minLevel: 0,
    maxLevel: 0,
    elevation: 50,
    // we can modify the mesh through the `style` property
    style: feat => {
        const lineName = feat.getProperties().ligne;
        const selected = feat.get('selected');
        // color according to line name
        if (!lineStyles[lineName]) {
            lineStyles[lineName] = makeStyle();
        }
        const { color, width, renderOrder } = lineStyles[lineName];
        let lineWidth = width ?? 20;
        let lineColor = color ?? new Color('white');

        if (selected) {
            lineWidth *= 1.5;
            lineColor = 'red';
        }

        return {
            stroke: {
                color: lineColor,
                lineWidth,
                lineWidthUnits: 'world',
                depthTest: false,
                renderOrder: selected ? 2000 : renderOrder,
            },
        };
    },
});

// Let's add our bus lines feature collection to the scene
instance.add(busLines);

// define another source
const busStopSource = new VectorSource({
    format: new GeoJSON(),
    url: function url(tileExtent) {
        return `${
            'https://download.data.grandlyon.com/wfs/rdata' +
            '?SERVICE=WFS' +
            '&VERSION=2.0.0' +
            '&request=GetFeature' +
            '&typename=tcl_sytral.tclarret' +
            '&outputFormat=application/json; subtype=geojson' +
            '&SRSNAME=EPSG:3946' +
            '&bbox='
        }${tileExtent.join(',')},EPSG:3946`;
    },
    strategy: tile(createXYZ({ tileSize: 512 })),
});
// Create the `FeatureCollection` entity that will load our features as meshes.
const busStops = new FeatureCollection({
    name: 'bus stops',
    source: busStopSource,
    extent,
    minLevel: 0,
    maxLevel: 0,
    elevation: 50,
    style: feat => {
        const selected = feat.get('selected');
        const image = 'https://3d.oslandia.com/giro3d/images/bus-front.png';

        return {
            point: {
                color: 'white',
                pointSize: selected ? 40 : 20,
                image,
                renderOrder: selected ? 3000 : 2500,
            },
        };
    },
});
instance.add(busStops);

// add a skybox background, just to look nicer :-)
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

const center = extent.centerAsVector3();

instance.view.camera.position.set(center.x - 300, center.y - 300, 5000);
instance.view.camera.lookAt(center);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = extent.centerAsVector3();
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
instance.view.setControls(controls);

const labelElement = document.createElement('div');
labelElement.classList.value = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';

const text = document.createElement('span');
text.style.marginLeft = '0.5rem';

const busStopSymbol = document.createElement('i');
busStopSymbol.classList.add('bi', 'bi-geo-alt-fill');

const busLineSymbol = document.createElement('i');
busLineSymbol.classList.add('bi', 'bi-bus-front-fill');

labelElement.appendChild(text);

const label = new CSS2DObject(labelElement);

label.visible = false;
instance.add(label);

let previousObjects = [];
const objectsToUpdate = [];

function pick(e) {
    previousObjects.forEach(obj => obj.userData.feature.set('selected', false));

    const pickResults = instance.pickObjectsAt(e, {
        sortByDistance: true,
        where: [busStops, busLines],
    });

    const found = pickResults[0];

    if (found) {
        const obj = found.object;
        const feature = obj.userData.feature;
        if (feature) {
            feature.set('selected', true);
            objectsToUpdate.push(obj);
        }
        if (found.entity === busStops) {
            text.innerText = `Bus stop "${feature.get('nom')}"`;
            labelElement.insertBefore(busStopSymbol, text);
            busLineSymbol.remove();
        } else if (found.entity === busLines) {
            text.innerText = `Bus line ${feature.get('ligne')}`;
            labelElement.insertBefore(busLineSymbol, text);
            busStopSymbol.remove();
        }

        // Virtually any inner markup is supported, here we're just inserting text
        label.name = text.innerText;
        // take the middle vertex as position
        label.position.set(found.point.x, found.point.y, found.point.z);
        label.updateMatrixWorld();
        label.visible = true;
        instance.notifyChange(label);
    } else {
        label.visible = false;
        instance.notifyChange(label);
    }

    busLines.updateStyles();
    busStops.updateStyles();
    previousObjects = [...objectsToUpdate];
    objectsToUpdate.length = 0;
}

instance.domElement.addEventListener('mousemove', pick);

bindToggle('showBusStops', v => {
    busStops.visible = v;
    instance.notifyChange();
});
bindToggle('showBusLines', v => {
    busLines.visible = v;
    instance.notifyChange();
});
bindToggle('showMap', v => {
    map.visible = v;
    instance.notifyChange();
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
