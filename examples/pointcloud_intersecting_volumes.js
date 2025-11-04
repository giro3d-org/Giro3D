/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Color, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import COPCSource from '@giro3d/giro3d/sources/COPCSource.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';

import { bindProgress } from './widgets/bindProgress.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { formatPointCount } from './widgets/formatPointCount.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import { placeCameraOnTop } from './widgets/placeCameraOnTop.js';
import StatusBar from './widgets/StatusBar.js';

// LAS processing requires the WebAssembly laz-perf library
// This path is specific to your project, and must be set accordingly.
setLazPerfPath('/assets/wasm');

// We use this CRS when the point cloud does not have a CRS defined.
// It is technically the WebMercator CRS, but we label it 'unknown' to make
// it very explicit that it is not correct.
// See https://gitlab.com/giro3d/giro3d/-/issues/514
CoordinateSystem.register(
    'unknown',
    '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
);

/** @type {Instance} */
let instance;

const options = {
    mode: 'attribute',
    attribute: 'position',
    colorRamp: 'bathymetry',
    min: 0,
    max: 100,
};

/** @type {PointCloud} */
let entity;

const [setProgress, progressElement] = bindProgress('progress');

bindToggle('edl', v => {
    instance.renderingOptions.enableEDL = v;
    instance.notifyChange();
});

bindToggle('inpainting', v => {
    instance.renderingOptions.enableInpainting = v;
    instance.renderingOptions.enablePointCloudOcclusion = v;
    instance.notifyChange();
});

bindSlider('point-size', size => {
    if (entity) {
        entity.pointSize = size;
        document.getElementById('point-size-label').innerHTML =
            `Point size: <b>${size === 0 ? 'auto' : size.toFixed(0)}</b>`;
    }
});

function updateColorMap() {
    if (entity && instance) {
        entity.colorMap.colors = makeColorRamp(options.colorRamp);
        instance.notifyChange();
    }
}

/**
 * @param {number} code
 */
async function fetchCrsDefinitionFromEpsg(code) {
    async function fetchText(url) {
        const res = await fetch(url, { mode: 'cors' });
        const def = await res.text();
        return def;
    }

    return await fetchText(`https://epsg.io/${code}.proj4?download=1`);
}

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function updateDisplayedPointCounts(count, displayed) {
    const pointCountElement = document.getElementById('point-count');
    pointCountElement.innerHTML = formatPointCount(count, numberFormat);
    pointCountElement.title = numberFormat.format(count);

    const activePointCountElement = document.getElementById('displayed-point-count');
    activePointCountElement.innerHTML = formatPointCount(displayed, numberFormat);
    activePointCountElement.title = numberFormat.format(displayed);
}

function buildViewProjectionMatrix(camera) {
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    return new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

function buildIntersectingVolumes() {
    const result = [];

    const fakePerspCamera = new PerspectiveCamera(90, 1, 200, 1000);
    fakePerspCamera.position.set(638690, 851602, 542);
    fakePerspCamera.lookAt(
        fakePerspCamera.position
            .clone()
            .add(new Vector3(-0.63259536468089, 0.7725958632603044, -0.054025333477148996)),
    );
    result.push({
        worldToBoxNdc: buildViewProjectionMatrix(fakePerspCamera),
        color: new Color(0xff0000),
    });

    const fakeOrthoCamera = new OrthographicCamera(-600, 600, 600, -600, 50, 400);
    fakeOrthoCamera.position.set(637173, 850000, 454);
    fakeOrthoCamera.lookAt(
        fakeOrthoCamera.position
            .clone()
            .add(new Vector3(0.04810697763524398, 0.998397464675122, 0.02980304066854412)),
    );
    result.push({
        worldToBoxNdc: buildViewProjectionMatrix(fakeOrthoCamera),
        color: new Color(0x00ff00),
    });

    return result;
}

const intersectingVolumes = buildIntersectingVolumes();

function updateIntersectingVolumes() {
    entity.intersectingVolumes.length = 0;
    // @ts-expect-error This element is an input
    const /** @type HTMLInputElement */ input = document.getElementById('intersecting-volumes');
    if (input.checked) {
        entity.intersectingVolumes.push(...intersectingVolumes);
    }
}

window.addEventListener('keydown', event => {
    if (event.key === 'g') {
        const camera = instance.view.camera;
        console.log('position', camera.getWorldPosition(new Vector3()).toArray());
        console.log('direction', camera.getWorldDirection(new Vector3()).toArray());
    }
});

function populateGUI() {
    document.getElementById('accordion').style.display = 'block';

    const tableElement = document.getElementById('table');
    tableElement.style.display = 'block';

    /** @type {HTMLLinkElement} */
    // @ts-expect-error casting
    const projectionElement = document.getElementById('projection');
    const epsgCode = instance.coordinateSystem.srid?.tryGetEpsgCode();
    if (typeof epsgCode === 'number') {
        projectionElement.href = `https://epsg.io/${epsgCode}`;
        projectionElement.innerHTML = instance.coordinateSystem.id;
    } else {
        projectionElement.parentElement.remove();
    }

    progressElement.style.display = 'none';
}

// Loads the point cloud from the url parameter
async function load(url) {
    progressElement.style.display = 'block';

    // Let's create the source
    const source = new COPCSource({ url });

    source.addEventListener('progress', () => setProgress(source.progress));

    try {
        // Initialize the source in advance, so that we can
        // access the metadata of the remote LAS file.
        await source.initialize();
    } catch (err) {
        if (err instanceof Error) {
            const messageElement = document.getElementById('message');
            messageElement.innerText = err.message;
            messageElement.style.display = 'block';
        }
        progressElement.style.display = 'none';
        console.error(err);
        return;
    }

    const metadata = await source.getMetadata();

    instance = new Instance({
        target: 'view',
        crs: metadata.crs,
        backgroundColor: null,
    });

    options.attribute = metadata.attributes[0].name;

    // Let's enable Eye Dome Lighting to make the point cloud more readable.
    instance.renderingOptions.enableEDL = true;
    instance.renderingOptions.EDLRadius = 0.6;
    instance.renderingOptions.EDLStrength = 5;

    // Let's create our point cloud with the COPC source.
    entity = new PointCloud({ source });

    await instance.add(entity);

    instance.addEventListener('update-end', () =>
        updateDisplayedPointCounts(entity.pointCount, entity.displayedPointCount),
    );

    // Let's get the volume of the point cloud for various operations.
    const volume = entity.getBoundingBox();

    // Create the color map. The color ramp and bounds will be set later.
    entity.colorMap = new ColorMap({ colors: [], min: 0, max: 1 });
    updateIntersectingVolumes();
    bindToggle('intersecting-volumes', () => {
        updateIntersectingVolumes();
        instance.notifyChange();
    });

    updateColorMap();

    // If the source provides a coordinate system, we can load a map
    // to display as a geographic context and be able to check that the
    // point cloud is properly positioned.
    const epsgCode = metadata.crs.srid?.tryGetEpsgCode();
    if (typeof epsgCode === 'number') {
        try {
            const definitionFromEpsg = await fetchCrsDefinitionFromEpsg(epsgCode);
            CoordinateSystem.register(metadata.crs.id, definitionFromEpsg);
            document.getElementById('basemap-group').style.display = 'block';
        } catch (e) {
            console.warn('could not load map: ' + e);
        }
    }

    populateGUI();

    Inspector.attach('inspector', instance);

    if (instance.coordinateSystem.srid) {
        StatusBar.bind(instance, { disableUrlUpdate: true });
    }

    placeCameraOnTop(volume, instance);

    instance.notifyChange();
}

const defaultUrl = 'https://3d.oslandia.com/giro3d/pointclouds/autzen-classified.copc.laz';

// Extract dataset URL from URL
const url = new URL(document.URL);
let datasetUrl = url.searchParams.get('dataset');
if (!datasetUrl) {
    datasetUrl = defaultUrl;
    url.searchParams.append('dataset', datasetUrl);
    window.history.replaceState({}, null, url.toString());
}

const fragments = new URL(datasetUrl).pathname.split('/');
document.getElementById('filename').innerText = fragments[fragments.length - 1];

// GUI controls for classification handling

load(datasetUrl).catch(console.error);
