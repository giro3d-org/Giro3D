/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import proj4 from 'proj4';
import { Vector3 } from 'three';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import * as MemoryUsage from '@giro3d/giro3d/core/MemoryUsage.js';

const VIEW_PARAM = 'view';
let currentURL = '';
// Use default locale
const NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

const LATLON_FORMAT = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
});

let progressBar;
let isCameraMoving = false;
let percent;
let memoryUsage;
let currentInstance;
let additionalInstances = [];
let pickingRadius;
const tmpVec3 = new Vector3();
const lastCameraPosition = new Vector3(0, 0, 0);
let coordinates;
let pickedPoint;
let crsButton;
let coordsAsLatLon = false;
let ecefToLatlonConverter;

function processUrl(instance, url) {
    const pov = new URL(url).searchParams.get(VIEW_PARAM);
    if (pov) {
        try {
            const [x, y, z, tx, ty, tz] = pov.split(',').map(s => Number.parseFloat(s));

            instance.view.camera.position.set(x, y, z);
            instance.view.controls?.target?.set(tx, ty, tz);
        } finally {
            instance.notifyChange();
        }
    }
}

function updateUrl() {
    const url = new URL(document.URL);
    url.searchParams.delete(VIEW_PARAM);

    function round10(n) {
        return Math.round(n * 10) / 10;
    }

    const cam = currentInstance.view.camera.position;
    const target = currentInstance?.view.controls?.target;
    if (target) {
        const pov = `${round10(cam.x)},${round10(cam.y)},${round10(cam.z)},${round10(target.x)},${round10(target.y)},${round10(target.z)}`;

        if (pov === currentURL) {
            return;
        }

        currentURL = pov;
        url.searchParams.append(VIEW_PARAM, pov);

        window.history.replaceState({}, null, url.toString());
    }
}

function updateCameraMoving() {
    const cameraPosition = currentInstance.view.camera.getWorldPosition(tmpVec3);
    // Don't pick while the camera is moving
    if (!lastCameraPosition || lastCameraPosition.distanceToSquared(cameraPosition) < 3) {
        isCameraMoving = false;
    } else {
        lastCameraPosition.copy(cameraPosition);
        isCameraMoving = true;
    }
}

function updateProgressFrameRequester() {
    progressBar.style.width = `${currentInstance.progress * 100}%`;
    percent.innerText = `${Math.round(currentInstance.progress * 100)}%`;

    const mem = currentInstance.getMemoryUsage();

    if (additionalInstances.length > 0) {
        for (const instance of additionalInstances) {
            const otherMem = instance.getMemoryUsage();
            mem.cpuMemory += otherMem.cpuMemory;
            mem.gpuMemory += otherMem.gpuMemory;
        }
    }

    if (memoryUsage) {
        const memoryUsageString = `Mem ${MemoryUsage.format(mem.cpuMemory)} (CPU), ${MemoryUsage.format(mem.gpuMemory)} (GPU)`;
        const threshold = 512 * 1024 * 1024; // 512 MB
        if (mem.cpuMemory > threshold || mem.gpuMemory > threshold) {
            memoryUsage.classList.add('text-danger');
            memoryUsage.classList.add('fw-bold');
        } else {
            memoryUsage.classList.remove('text-danger');
            memoryUsage.classList.remove('fw-bold');
        }
        memoryUsage.innerText = memoryUsageString;
    }
}

function updateCoordinates() {
    const coords = pickedPoint;

    const crs = currentInstance.coordinateSystem.id;
    crsButton.innerText = coordsAsLatLon ? 'lat/lon' : crs;

    if (coords) {
        coordinates.classList.remove('d-none');

        const { x, y, z } = coords;

        if (coordsAsLatLon && ecefToLatlonConverter != null) {
            if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
                const [lon, lat, alt] = ecefToLatlonConverter.forward([x, y, z]);
                coordinates.textContent = `lat: ${LATLON_FORMAT.format(lat)}, lon: ${LATLON_FORMAT.format(lon)}, altitude: ${NUMBER_FORMAT.format(alt)}`;
            } else {
                coordinates.textContent = `lat: NaN, lon: NaN, altitude: NaN`;
            }
        } else {
            coordinates.textContent = `x: ${NUMBER_FORMAT.format(x)}, y: ${NUMBER_FORMAT.format(y)}, z: ${NUMBER_FORMAT.format(z)}`;
        }
    } else {
        coordinates.classList.add('d-none');
    }
}

function pick(mouseEvent) {
    updateCameraMoving();

    // Don't pick while the camera is moving
    if (!isCameraMoving) {
        const picked = currentInstance.pickObjectsAt(mouseEvent, {
            limit: 1,
            radius: pickingRadius,
            sortByDistance: true,
        });

        pickedPoint = picked[0]?.point;
        updateCoordinates();
    }
}

/**
 * Updates the attribution in the status bar.
 * @param {string} html The HTML content of the attributions.
 */
function setAttributionHtml(html) {
    document.getElementById('attributions').innerHTML = html;
}

/**
 * @param {Instance} instance The instance.
 * @param {object} [options] The options.
 * @param {number} [options.radius] The radius of the picking.
 * @param {boolean} [options.disableUrlUpdate] Disable automatic URL update.
 * @param {boolean} [options.disableCoordinates] Disable automatic coordinates update.
 * @param {[Instance] | Instance} [options.additionalInstances] Additional instances to track.
 */
function bind(instance, options = {}) {
    pickingRadius = options.radius;
    currentInstance = instance;
    if (!options.disableCoordinates) {
        // Bind events
        coordinates = document.getElementById('coordinates');
        instance.domElement.addEventListener('mousemove', pick);
    }

    try {
        ecefToLatlonConverter = proj4(instance.coordinateSystem.id, 'EPSG:4979');
    } catch (e) {
        ecefToLatlonConverter = null;
    }

    progressBar = document.getElementById('progress-bar');
    percent = document.getElementById('loading-percent');
    memoryUsage = document.getElementById('memory-usage');
    crsButton = document.getElementById('crs');

    crsButton.onclick = function onclick() {
        coordsAsLatLon = !coordsAsLatLon;
        updateCoordinates();
    };

    if (options.additionalInstances) {
        if (Array.isArray(options.additionalInstances)) {
            additionalInstances.push(...options.additionalInstances);
        } else {
            additionalInstances.push(options.additionalInstances);
        }
    }

    instance.addEventListener('update-end', updateProgressFrameRequester);

    if (!options.disableUrlUpdate) {
        setInterval(updateUrl, 200);
        processUrl(instance, document.URL);
    }
}

export default { updateUrl, bind, setAttributionHtml };
