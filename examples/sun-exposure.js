/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import XYZ from 'ol/source/XYZ';
import * as THREE from 'three';
import {
    AmbientLight,
    BoxGeometry,
    DirectionalLight,
    Mesh,
    MeshStandardMaterial,
    PlaneGeometry,
    SphereGeometry,
    Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import Instance from '@giro3d/giro3d/core/Instance';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer';
import Entity3D from '@giro3d/giro3d/entities/Entity3D';
import Map from '@giro3d/giro3d/entities/Map';
import { MapLightingMode } from '@giro3d/giro3d/entities/MapLightingOptions';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat';
import Inspector from '@giro3d/giro3d/gui/Inspector';
import DrawTool from '@giro3d/giro3d/interactions/DrawTool';
import SunExposure from '@giro3d/giro3d/interactions/SunExposure';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource';
import Fetcher from '@giro3d/giro3d/utils/Fetcher';

import { bindButton } from './widgets/bindButton';
import { bindDropDown } from './widgets/bindDropDown';
import { bindNumberInput } from './widgets/bindNumberInput';
import { bindTextInput } from './widgets/bindTextInput';
import { bindToggle } from './widgets/bindToggle';
import { makeColorRamp } from './widgets/makeColorRamp';
import StatusBar from './widgets/StatusBar';
import updateColorMapPreview from './widgets/updateColorMapPreview';

const lambert93 = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const utm32 = CoordinateSystem.register(
    'EPSG:25832',
    '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const params = {
    abortController: new AbortController(),
    aoiShape: null,
    helpers: false,
    showInputs: true,
    scenario: 'simple',
    activeAttribute: 'irradiation',
    spatialResolution: 10,
    date: new Date(Date.UTC(2025, 6, 21)),
    startTime: 8,
    endTime: 16,
    originalVolume: new THREE.Box3().makeEmpty(),
    volume: null,
    boxHelper: null,
    temporalResolutionMinutes: 60,
    currentObjects: [],
    inputs: [],
};

/**
 * @param {Instance} instance
 * @param {Vector3} center
 */
function createLights(instance, center) {
    // Note: those lights are for illustrative purposes,
    // they are not part of the sun exposure computation.

    const main = new DirectionalLight();
    const secondary = new DirectionalLight('white', 0.3);
    const ambientLight = new AmbientLight('white', 0.2);

    instance.add(ambientLight);

    instance.add(main);
    instance.add(main.target);
    instance.add(secondary);
    instance.add(secondary.target);

    main.target.position.copy(center);
    main.position.set(center.x + 1000, center.y + 300, 1000);
    main.updateMatrixWorld(true);
    main.target.updateMatrixWorld(true);

    params.currentObjects.push(main);
    params.currentObjects.push(main.target);

    secondary.target.position.copy(center);
    secondary.position.set(center.x - 1000, center.y + 300, 1000);
    secondary.updateMatrixWorld(true);
    secondary.target.updateMatrixWorld(true);

    params.currentObjects.push(secondary);
    params.currentObjects.push(secondary.target);

    params.currentObjects.push(ambientLight);
}

/**
 * @typedef Scenario object
 * @property {Extent} areaOfInterest
 * @property {THREE.Box3} volume
 * @property {Vector3} center,
 * @property {Array<THREE.Object3D|Entity3D>} inputs
 * @property {[number, number, number]} allowedSpatialResolutionRange
 */

/**
 * @param {Instance} instance
 * @returns {Promise<Scenario>}
 */
async function planeOnlyScenario(instance) {
    const center = Coordinates.WGS84(23.43, 0).as(lambert93);
    const width = 200;
    const areaOfInterest = Extent.fromCenterAndSize(lambert93, center, width, width);
    const plane = new Mesh(
        new PlaneGeometry(width, width),
        new MeshStandardMaterial({ color: 'white' }),
    );

    const centerVec3 = center.toVector3();
    plane.position.copy(centerVec3);
    plane.updateMatrixWorld();

    await instance.add(plane);

    const inputs = [plane];

    return {
        areaOfInterest,
        inputs,
        allowedSpatialResolutionRange: [0.5, 20, 1],
        center: centerVec3,
        volume: areaOfInterest.toBox3(-1, 1),
    };
}

/**
 * @param {Instance} instance
 * @returns {Promise<Scenario>}
 */
async function planeBoxScenario(instance) {
    const center = Coordinates.WGS84(23.4384024785, 0).as(lambert93);
    const width = 300;
    const areaOfInterest = Extent.fromCenterAndSize(lambert93, center, width, width);
    const plane = new Mesh(
        new PlaneGeometry(width, width),
        new MeshStandardMaterial({ color: 'white' }),
    );
    const box = new Mesh(
        new BoxGeometry(30, 30, 60),
        new MeshStandardMaterial({ color: '#89dce5' }),
    );

    const centerVec3 = center.toVector3();
    plane.position.copy(centerVec3);
    box.position.set(centerVec3.x, centerVec3.y, 30);
    plane.updateMatrixWorld();
    box.updateMatrixWorld();

    await instance.add(plane);
    await instance.add(box);

    const volume = new THREE.Box3();
    volume.expandByObject(plane);
    volume.expandByObject(box);

    const inputs = [plane, box];

    return {
        areaOfInterest,
        allowedSpatialResolutionRange: [1, 50, 1],
        inputs,
        center: centerVec3,
        volume,
    };
}

/**
 * @param {Instance} instance
 * @returns {Promise<Scenario>}
 */
async function sphereScenario(instance) {
    const center = Coordinates.WGS84(48.85304790669139, 2.3497154907829603).as(lambert93);
    const width = 300;
    const areaOfInterest = Extent.fromCenterAndSize(lambert93, center, width, width);
    const plane = new Mesh(
        new PlaneGeometry(width, width),
        new MeshStandardMaterial({ color: 'white' }),
    );
    const sphere = new Mesh(new SphereGeometry(30), new MeshStandardMaterial({ color: '#89dce5' }));

    const centerVec3 = center.toVector3();
    plane.position.copy(centerVec3);
    sphere.position.set(centerVec3.x, centerVec3.y, 30);
    plane.updateMatrixWorld();
    sphere.updateMatrixWorld();

    await instance.add(plane);
    await instance.add(sphere);

    const inputs = [plane, sphere];

    const volume = new THREE.Box3();
    volume.expandByObject(plane);
    volume.expandByObject(sphere);

    return {
        areaOfInterest,
        inputs,
        allowedSpatialResolutionRange: [1, 50, 1],
        center: centerVec3,
        volume,
    };
}

/**
 * @param {Instance} instance
 * @returns {Promise<Scenario>}
 */
async function cityBlockScenario(instance) {
    const center = Coordinates.WGS84(45.93506, 6.63125).as(lambert93);

    const loader = new GLTFLoader();
    const model = await loader.loadAsync('https://3d.oslandia.com/giro3d/gltf/jena/scene.gltf');

    model.scene.position.copy(center);
    model.scene.rotateX(Math.PI / 2);
    model.scene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model.scene);
    const actualCenter = box.getCenter(new Vector3());
    actualCenter.setZ(box.min.z);
    const size = box.getSize(new Vector3());
    const areaOfInterest = Extent.fromCenterAndSize(lambert93, actualCenter, size.x, size.y);

    await instance.add(model.scene);

    return {
        areaOfInterest,
        inputs: [model.scene],
        allowedSpatialResolutionRange: [0.1, 50, 0.5],
        center: actualCenter,
        volume: box,
    };
}

/**
 * @param {Instance} instance
 * @param {Extent} extent
 */
async function createMap(instance, extent) {
    const map = new Map({
        backgroundColor: 'white',
        lighting: {
            enabled: true,
            mode: MapLightingMode.LightBased,
            elevationLayersOnly: true,
        },
        extent,
        terrain: {
            enabled: true,
            skirts: {
                enabled: true,
                depth: 0,
            },
        },
    });

    await instance.add(map);

    const key =
        'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ';

    // Adds a XYZ elevation layer with MapBox terrain RGB tileset
    const elevationLayer = new ElevationLayer({
        name: 'xyz_elevation',
        extent,
        // We dont want the full resolution because the terrain
        // mesh has a much lower resolution than the raster image
        resolutionFactor: 0.5,
        minmax: { min: 0, max: 5000 },
        source: new TiledImageSource({
            format: new MapboxTerrainFormat(),
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
                projection: 'EPSG:3857',
                crossOrigin: 'anonymous',
            }),
        }),
    });
    await map.addLayer(elevationLayer);

    // Adds a XYZ color layer with MapBox satellite tileset
    const satelliteLayer = new ColorLayer({
        name: 'xyz_color',
        extent,
        source: new TiledImageSource({
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
                projection: 'EPSG:3857',
                crossOrigin: 'anonymous',
            }),
        }),
    });
    await map.addLayer(satelliteLayer);

    return map;
}

/**
 * @param {Instance} instance
 * @returns {Promise<Scenario>}
 */
async function terrainScenario(instance) {
    const center = Coordinates.WGS84(45.9231, 6.8697).as(lambert93);
    const size = 30_000;
    const extent = Extent.fromCenterAndSize(lambert93, center, size, size);

    const map = await createMap(instance, extent);

    return {
        areaOfInterest: extent,
        inputs: [map],
        allowedSpatialResolutionRange: [50, 1000, 100],
        center: center.toVector3(),
        volume: extent.toBox3(0, 5000),
    };
}

const scenarios = {
    box: planeBoxScenario,
    plane: planeOnlyScenario,
    terrain: terrainScenario,
    sphere: sphereScenario,
    'city-block': cityBlockScenario,
};

const colorMaps = {
    meanIrradiance: new ColorMap({ colors: makeColorRamp('magma'), min: 0, max: 0 }),
    irradiation: new ColorMap({ colors: makeColorRamp('jet'), min: 0, max: 0 }),
    hoursOfSunlight: new ColorMap({ colors: makeColorRamp('RdBu'), min: 0, max: 0 }),
};

const instance = new Instance({
    target: 'view',
    crs: lambert93,
    backgroundColor: 'white',
});

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.2;
instance.view.setControls(controls);

const compassMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.5,
    visible: false,
    color: 'white',
});

Fetcher.texture('https://3d.oslandia.com/giro3d/images/compass.webp', { flipY: true }).then(t => {
    compassMaterial.map = t;
    compassMaterial.visible = true;
    instance.notifyChange();
});

const compass = new Mesh(new PlaneGeometry(1, 1), compassMaterial);
compass.name = 'compass';

instance.add(compass);

const progressBar = document.getElementById('progress');

let currentPointCloud = null;
/** @type {SunExposure} */
let currentSunExposure = null;

/**
 * @param {string} scenarioName - The scenario to run.
 */
async function run(scenarioName) {
    if (params.currentObjects.length > 0) {
        params.currentObjects.forEach(o => instance.remove(o));
        params.currentObjects.length = 0;
    }

    if (currentPointCloud) {
        instance.remove(currentPointCloud);
        currentPointCloud = null;
    }

    params.volume = null;
    if (params.boxHelper) {
        instance.remove(params.boxHelper);
        params.boxHelper = null;
    }

    if (currentSunExposure) {
        currentSunExposure.dispose();
    }

    const scenario = scenarios[scenarioName];
    const { areaOfInterest, inputs, center, volume, allowedSpatialResolutionRange } =
        await scenario(instance);

    /** @type {HTMLInputElement} */
    // @ts-expect-error ignore that
    const spatialResInput = document.getElementById('spatial-resolution');
    const [minRes, maxRes, defaultRes] = allowedSpatialResolutionRange;
    spatialResInput.min = minRes;
    spatialResInput.max = maxRes;
    spatialResInput.value = defaultRes;
    params.spatialResolution = defaultRes;

    params.inputs = inputs;
    params.originalVolume = volume;
    params.currentObjects.push(...inputs);

    const dims = areaOfInterest.dimensions();

    const compassSize = dims.width * 2;
    compass.scale.set(compassSize, compassSize, 1);
    compass.position.set(center.x, center.y, center.z - 1);
    compass.updateMatrixWorld(true);
    instance.add(compass);

    const pov = instance.view.goTo(inputs[0]);

    createLights(instance, center);

    controls.target.set(pov.target.x, pov.target.y, 0);
    controls.update();
    controls.saveState();

    instance.notifyChange();

    const setActiveAttribute = (/** @type {string} */ att) => {
        updateColorMapPreview('gradient', colorMaps[att].colors);
        currentPointCloud?.setActiveAttribute(att);

        // Note that irradiation is technically in Watt-hour/m², but for readability,
        // we convert to Kilowatt-hour/m² to be displayed in the UI. Remember that
        // the actual values are in Watt-hour/m² though.
        const factor = att === 'irradiation' ? 0.001 : 1;

        const min = Math.abs(colorMaps[att].min * factor);
        const max = Math.abs(colorMaps[att].max * factor);

        document.getElementById('colorMapMin').innerText = min.toFixed(2);
        document.getElementById('colorMapMax').innerText = max.toFixed(2);
    };

    const onStart = () => {
        if (currentPointCloud) {
            instance.remove(currentPointCloud);
            currentPointCloud = null;
        }

        if (currentSunExposure) {
            currentSunExposure.dispose();
            currentSunExposure = null;
        }

        const yyyy = params.date.getUTCFullYear();
        const mm = params.date.getUTCMonth();
        const dd = params.date.getUTCDay();
        const start = new Date(Date.UTC(yyyy, mm, dd, params.startTime));
        const end = new Date(Date.UTC(yyyy, mm, dd, params.endTime));
        inputs.forEach(obj => (obj.visible = true));

        const sunExposure = new SunExposure({
            instance,
            showHelpers: params.helpers,
            objects: inputs,
            limits: Extent.fromBox3(lambert93, params.volume ?? params.originalVolume),
            spatialResolution: params.spatialResolution,
            colorMap: colorMaps['irradiation'],
            start,
            end,
            temporalResolution: params.temporalResolutionMinutes * 60,
        });

        currentSunExposure = sunExposure;

        sunExposure.addEventListener('progress', e => {
            const percent = (e.progress * 100).toFixed(0);
            console.log(`sun computation progress: ${percent}%`);

            progressBar.style.width = `${percent}%`;

            if (e.progress >= 1) {
                progressBar.parentElement.style.display = 'none';
            }
        });

        progressBar.parentElement.style.display = 'block';

        document.getElementById('attribute-group').style.display = 'none';

        params.abortController = new AbortController();

        const startButton = document.getElementById('start');
        const cancelButton = document.getElementById('cancel');

        startButton.classList.add('d-none');
        cancelButton.classList.remove('d-none');

        sunExposure
            .compute({ signal: params.abortController.signal })
            .then(results => {
                currentPointCloud = results.entity;
                if (!params.showInputs) {
                    inputs.forEach(obj => (obj.visible = false));
                }

                instance.notifyChange();
                colorMaps.meanIrradiance.min = results.variables.meanIrradiance.min;
                colorMaps.meanIrradiance.max = results.variables.meanIrradiance.max;

                colorMaps.irradiation.min = results.variables.irradiation.min;
                colorMaps.irradiation.max = results.variables.irradiation.max;

                colorMaps.hoursOfSunlight.min = results.variables.hoursOfSunlight.min;
                colorMaps.hoursOfSunlight.max = results.variables.hoursOfSunlight.max;

                results.entity.setAttributeColorMap('meanIrradiance', colorMaps.meanIrradiance);
                results.entity.setAttributeColorMap('irradiation', colorMaps.irradiation);
                results.entity.setAttributeColorMap('hoursOfSunlight', colorMaps.hoursOfSunlight);

                setActiveAttribute(params.activeAttribute);

                document.getElementById('attribute-group').style.display = 'flex';
            })
            .catch(console.warn)
            .finally(() => {
                startButton.classList.remove('d-none');
                cancelButton.classList.add('d-none');
                progressBar.parentElement.style.display = 'none';
            });
    };

    bindButton('start', onStart);
    bindButton('cancel', () => params.abortController.abort());

    bindDropDown('attribute', att => {
        params.activeAttribute = att;
        setActiveAttribute(att);
    });
}

const drawTool = new DrawTool({ instance });

function drawAoiShape() {
    drawTool
        .createPolygon({
            showVertices: true,
        })
        .then(shape => {
            const box = new THREE.Box3().setFromPoints([...shape.points]);
            box.min.setZ(-100000);
            box.max.setZ(100000);
            box.intersect(params.originalVolume);
            params.volume = box;
            const boxHelper = new THREE.Box3Helper(box, 'cyan');
            boxHelper.updateMatrixWorld(true);
            if (params.boxHelper) {
                instance.remove(params.boxHelper);
            }
            params.boxHelper = boxHelper;
            instance.add(boxHelper);
            instance.remove(shape);
            instance.notifyChange(boxHelper);
        });
}

bindNumberInput('spatial-resolution', v => (params.spatialResolution = v));
bindNumberInput('temporal-resolution', v => (params.temporalResolutionMinutes = v));
bindDropDown('scenario', s => {
    run(s).catch(console.error);
});
bindNumberInput('start-time', h => (params.startTime = h));
bindNumberInput('end-time', h => (params.endTime = h));
bindTextInput('date', date => {
    params.date = new Date(date);
});
bindButton('draw-aoi', drawAoiShape);
bindToggle('show-helpers', v => (params.helpers = v));
bindToggle('show-inputs', v => {
    params.showInputs = v;
    params.inputs.forEach(obj => (obj.visible = v));
    instance.notifyChange();
});

run('box').catch(console.error);

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
