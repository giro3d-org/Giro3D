/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Color } from 'three';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import COPCSource from '@giro3d/giro3d/sources/COPCSource.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';

import { bindProgress } from './widgets/bindProgress.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
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
bindSlider('subdivision-threshold', threshold => {
    if (entity) {
        entity.subdivisionThreshold = threshold;
        document.getElementById('subdivision-threshold-label').innerHTML =
            `Subdivision threshold: <b>${threshold}</b>`;
    }
});

// @ts-expect-error This is a range input.
const /** @type HTMLInputElement */ colorWeightRange = document.getElementById('color-weight');
// @ts-expect-error This is a range input.
const /** @type HTMLInputElement */ zWeightRange = document.getElementById('z-weight');
// @ts-expect-error This is a range input.
const /** @type HTMLInputElement */ classificationWeightRange =
        document.getElementById('classification-weight');

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

    // Let's enable Eye Dome Lighting to make the point cloud more readable.
    instance.renderingOptions.enableEDL = true;
    instance.renderingOptions.EDLRadius = 0.6;
    instance.renderingOptions.EDLStrength = 5;

    // Let's create our point cloud with the COPC source.
    entity = new PointCloud({ source });

    await instance.add(entity);

    // Create a black to white color ramp for the "Z" attribute
    const zAttribute = entity.getSupportedAttributes().find(att => att.name === 'Z');
    const colors = [];
    for (let i = 0; i < 255; i++) {
        const v = i / 255;
        colors.push(new Color(v, v, v));
    }
    const colorMap = new ColorMap({
        min: zAttribute.min,
        max: zAttribute.max,
        colors,
    });
    entity.elevationColorMap = colorMap;
    entity.setAttributeColorMap('Z', colorMap);

    const onWeightsUpdate = () => {
        const colorWeight = +colorWeightRange.value;
        const zWeight = +zWeightRange.value;
        const classificationWeight = +classificationWeightRange.value;

        const totalWeight = colorWeight + zWeight + classificationWeight;
        if (totalWeight === 0) {
            // default to color
            colorWeightRange.value = '1';
        }

        colorWeightRange.disabled = zWeight === 0 && classificationWeight === 0;
        zWeightRange.disabled = colorWeight === 0 && classificationWeight === 0;
        classificationWeightRange.disabled = colorWeight === 0 && zWeight === 0;

        if (colorWeightRange.disabled) {
            colorWeightRange.value = '1';
        }
        if (zWeightRange.disabled) {
            zWeightRange.value = '1';
        }
        if (classificationWeightRange.disabled) {
            classificationWeightRange.value = '1';
        }

        entity.setActiveAttributes([
            { name: 'Color', weight: +colorWeightRange.value },
            { name: 'Z', weight: +zWeightRange.value },
            { name: 'Classification', weight: +classificationWeightRange.value },
        ]);
    };

    colorWeightRange.addEventListener('input', onWeightsUpdate);
    zWeightRange.addEventListener('input', onWeightsUpdate);
    classificationWeightRange.addEventListener('input', onWeightsUpdate);
    onWeightsUpdate();

    // Let's get the volume of the point cloud for various operations.
    const volume = entity.getBoundingBox();

    // If the source provides a coordinate system, we can load a map
    // to display as a geographic context and be able to check that the
    // point cloud is properly positioned.
    const epsgCode = metadata.crs.srid?.tryGetEpsgCode();
    if (typeof epsgCode === 'number') {
        try {
            const definitionFromEpsg = await fetchCrsDefinitionFromEpsg(epsgCode);
            CoordinateSystem.register(metadata.crs.id, definitionFromEpsg);
        } catch (e) {
            console.warn('could not load map: ' + e);
        }
    }

    document.getElementById('accordion').style.display = 'block';
    progressElement.style.display = 'none';

    Inspector.attach('inspector', instance);

    if (instance.coordinateSystem.srid) {
        StatusBar.bind(instance, { disableUrlUpdate: true });
    }

    placeCameraOnTop(volume, instance);

    instance.notifyChange();
}

const datasetUrl = 'https://3d.oslandia.com/giro3d/pointclouds/autzen-classified.copc.laz';
load(datasetUrl).catch(console.error);
