import colormap from 'colormap';

import {
    AmbientLight,
    ArrowHelper,
    BasicShadowMap,
    BoxGeometry,
    CameraHelper,
    Color,
    DirectionalLight,
    DirectionalLightHelper,
    Mesh,
    MeshStandardMaterial,
    PointLight,
    PointLightHelper,
    Vector3,
    VSMShadowMap,
} from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import XYZ from 'ol/source/XYZ.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import { MapLightingMode } from '@giro3d/giro3d/entities/MapLightingOptions.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Sun from '@giro3d/giro3d/core/geographic/Sun.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';
import { bindButton } from './widgets/bindButton.js';
import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindNumericalDropDown } from './widgets/bindNumericalDropDown.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import { updateLabel } from './widgets/updateLabel.js';

const EXTENT_SIZE = 20_000;

const min = 1500;
const max = 2000;

// Monument Valley coordinates
const center = new Coordinates('EPSG:4326', -110.08252, 36.98715).as('EPSG:3857').toVector3();

const extent = Extent.fromCenterAndSize('EPSG:3857', center, EXTENT_SIZE, EXTENT_SIZE);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:3857',
    backgroundColor: null,
});

const map = new Map({
    extent,
    // Enables light-based shading on this map
    lighting: {
        enabled: true,
        mode: MapLightingMode.LightBased,
    },
    discardNoData: true,
    terrain: {
        segments: 64,
    },
    subdivisionThreshold: 1,
    backgroundColor: '#c0bfbc',
});

instance.add(map);

const northArrow = new ArrowHelper(
    new Vector3(0, 1, 0),
    new Vector3(center.x, extent.north + 500, min),
    EXTENT_SIZE * 0.5,
    'yellow',
    EXTENT_SIZE * 0.1,
    EXTENT_SIZE * 0.02,
);

instance.add(northArrow);

northArrow.updateMatrixWorld(true);

const token =
    'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ';

const elevationLayer = new ElevationLayer({
    extent,
    preloadImages: true,
    minmax: { min, max },
    colorMap: new ColorMap({ colors: makeColorRamp('turbidity'), min, max }),
    source: new TiledImageSource({
        extent,
        format: new MapboxTerrainFormat(),
        source: new XYZ({
            projection: 'EPSG:3857',
            url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${token}`,
        }),
    }),
});
map.addLayer(elevationLayer).catch(console.error);

const colorLayer = new ColorLayer({
    extent,
    preloadImages: true,
    source: new TiledImageSource({
        extent,
        source: new XYZ({
            projection: 'EPSG:3857',
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${token}`,
        }),
    }),
});
map.addLayer(colorLayer).catch(console.error);

instance.view.camera.position.set(-12254256, 4417664, 9400);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target.set(center.x, center.y, 1600);
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
instance.view.setControls(controls);

// Light & shadow management
const lightParams = {
    zenith: 45,
    azimuth: 315,
    shadowBias: -0.0001,
    normalBias: 0,
    /** @type {number} */
    shadowMapType: VSMShadowMap,
    enableShadows: true,
    /** @type {'directional' | 'point'} */
    lightType: 'directional',
    shadowIntensity: 1,
    distance: EXTENT_SIZE * 4,
    directionalLightIntensity: 3,
    pointLightIntensity: 20000000,
    ambientIntensity: 0.5,
    shadowVolumeSize: EXTENT_SIZE,
    shadowVolumeNear: 50000,
    shadowVolumeFar: 150000,
    shadowMapResolution: 512,
    color: new Color('white'),
    ambientColor: new Color('white'),
    showHelpers: false,
};

instance.renderer.shadowMap.enabled = true;
instance.renderer.shadowMap.type = BasicShadowMap;

/** @type {DirectionalLight} */
let directionalLight;
/** @type {PointLight} */
let pointLight;
/** @type {PointLightHelper} */
let pointLightHelper;
/** @type {DirectionalLightHelper} */
let directionalLightHelper;
/** @type {CameraHelper} */
let shadowCameraHelper;

const ambientLight = new AmbientLight('#dbf1ff', 0.5);

instance.add(ambientLight);

const createLights = () => {
    if (directionalLight) {
        directionalLight.target.removeFromParent();
        directionalLight.dispose();
        directionalLight.removeFromParent();
    }

    if (directionalLightHelper) {
        directionalLightHelper.dispose();
        directionalLightHelper.removeFromParent();
    }

    if (shadowCameraHelper) {
        shadowCameraHelper.dispose();
        shadowCameraHelper.removeFromParent();
    }

    if (pointLight) {
        pointLight.dispose();
        pointLight.removeFromParent();
    }

    if (pointLightHelper) {
        pointLightHelper.dispose();
        pointLightHelper.removeFromParent();
    }

    directionalLight = new DirectionalLight(
        lightParams.color,
        lightParams.directionalLightIntensity,
    );

    instance.add(directionalLight);
    instance.add(directionalLight.target);

    directionalLight.name = 'sunlight';
    directionalLight.target.name = 'sunlight target';

    directionalLight.castShadow = true;
    directionalLight.position.set(center.x, center.y, lightParams.distance);
    directionalLight.target.position.set(center.x, center.y, 2200);

    const size = lightParams.shadowMapResolution;
    directionalLight.shadow.mapSize.set(size, size);

    directionalLight.shadow.bias = lightParams.shadowBias;
    directionalLight.shadow.normalBias = lightParams.normalBias;
    directionalLight.shadow.intensity = lightParams.shadowIntensity;

    // @ts-expect-error casting to number
    instance.renderer.shadowMap.type = lightParams.shadowMapType;

    directionalLight.shadow.camera.top = lightParams.shadowVolumeSize;
    directionalLight.shadow.camera.bottom = -lightParams.shadowVolumeSize;
    directionalLight.shadow.camera.left = -lightParams.shadowVolumeSize;
    directionalLight.shadow.camera.right = lightParams.shadowVolumeSize;
    directionalLight.shadow.camera.near = lightParams.shadowVolumeNear;
    directionalLight.shadow.camera.far = lightParams.shadowVolumeFar;

    directionalLight.updateMatrixWorld(true);
    directionalLight.target.updateMatrixWorld(true);

    directionalLight.shadow.updateMatrices(directionalLight);

    directionalLightHelper = new DirectionalLightHelper(directionalLight, 200, lightParams.color);
    instance.add(directionalLightHelper);

    shadowCameraHelper = new CameraHelper(directionalLight.shadow.camera);
    instance.add(shadowCameraHelper);

    pointLight = new PointLight(lightParams.color, 20_000_000, 4000);
    pointLight.castShadow = true;
    pointLight.shadow.bias = lightParams.shadowBias;
    pointLight.shadow.normalBias = lightParams.normalBias;
    pointLight.shadow.intensity = lightParams.shadowIntensity;
    pointLight.shadow.camera.near = 1;
    pointLight.shadow.camera.far = 10000;
    pointLight.shadow.mapSize.set(size, size);
    pointLight.position.set(center.x, center.y, min + 400);

    pointLight.updateMatrixWorld(true);

    pointLightHelper = new PointLightHelper(pointLight, 200, 'black');
    instance.add(pointLightHelper);
    pointLightHelper.updateMatrixWorld(true);

    instance.add(pointLight);

    updateLightsAndHelpers();
};

createLights();

// Example GUI

function updatePointLight() {
    pointLight.visible = lightParams.lightType === 'point';

    pointLight.intensity = lightParams.pointLightIntensity;
    pointLight.shadow.intensity = lightParams.shadowIntensity;
    pointLightHelper.visible = pointLight.visible && lightParams.showHelpers;

    instance.notifyChange();
}

function updateDirectionalLight() {
    const pos = Sun.getLocalPosition({
        point: center,
        zenith: lightParams.zenith,
        azimuth: lightParams.azimuth,
        distance: lightParams.distance,
    });

    directionalLight.position.copy(pos);

    directionalLight.updateMatrixWorld(true);
    directionalLight.target.updateMatrixWorld(true);

    directionalLight.shadow.bias = lightParams.shadowBias;
    directionalLight.shadow.normalBias = lightParams.normalBias;
    directionalLight.shadow.intensity = lightParams.shadowIntensity;

    directionalLight.shadow.camera.top = lightParams.shadowVolumeSize;
    directionalLight.shadow.camera.bottom = -lightParams.shadowVolumeSize;
    directionalLight.shadow.camera.left = -lightParams.shadowVolumeSize;
    directionalLight.shadow.camera.right = lightParams.shadowVolumeSize;
    directionalLight.shadow.camera.near = lightParams.shadowVolumeNear;
    directionalLight.shadow.camera.far = lightParams.shadowVolumeFar;

    directionalLight.shadow.camera.updateProjectionMatrix();
    directionalLight.shadow.camera.updateMatrix();

    directionalLightHelper.update();
    directionalLightHelper.updateMatrixWorld(true);

    shadowCameraHelper.update();
    shadowCameraHelper.updateMatrixWorld(true);

    directionalLight.intensity = lightParams.directionalLightIntensity;

    directionalLight.visible = lightParams.lightType === 'directional';
    shadowCameraHelper.visible = directionalLight.visible && lightParams.showHelpers;
    directionalLightHelper.visible = directionalLight.visible && lightParams.showHelpers;

    instance.notifyChange();
}

function updateLightsAndHelpers() {
    updateDirectionalLight();
    updatePointLight();

    northArrow.visible = lightParams.showHelpers;

    instance.notifyChange();
}

const [setColorLayerToggle] = bindToggle('colorLayers', state => {
    map.lighting.elevationLayersOnly = !state;
    instance.notifyChange(map);
});

const [setAzimuth] = bindSlider('azimuth', azimuth => {
    map.lighting.hillshadeAzimuth = azimuth;
    lightParams.azimuth = azimuth;
    updateLightsAndHelpers();
    updateLabel('azimuth-label', `Azimuth: ${Math.round(azimuth)}°`);
    instance.notifyChange(map);
});

const [setZenith] = bindSlider('zenith', zenith => {
    map.lighting.hillshadeZenith = zenith;
    lightParams.zenith = zenith;
    updateLightsAndHelpers();
    updateLabel('zenith-label', `Zenith: ${Math.round(zenith)}°`);
    instance.notifyChange(map);
});

const [setLightColor] = bindColorPicker('color', v => {
    lightParams.color = new Color(v);
    directionalLight.color = lightParams.color;
    pointLight.color = lightParams.color;
    instance.notifyChange();
});

const [setAmbientColor] = bindColorPicker('ambient-color', v => {
    lightParams.ambientColor = new Color(v);
    ambientLight.color = lightParams.ambientColor;
    instance.notifyChange();
});

const [setShadowMapResolution] = bindSlider('shadow-map-resolution', size => {
    lightParams.shadowMapResolution = size;

    createLights();

    instance.notifyChange();
});

const [setShadowMapBias] = bindSlider('shadow-map-bias', bias => {
    lightParams.shadowBias = bias;

    updateLightsAndHelpers();

    instance.notifyChange();
});

const [setShadowMapNormalBias] = bindSlider('shadow-map-normal-bias', bias => {
    lightParams.normalBias = bias;

    updateLightsAndHelpers();

    instance.notifyChange();
});

const [setShadowVolumeSize] = bindSlider('shadow-volume-size', size => {
    lightParams.shadowVolumeSize = size;

    updateLightsAndHelpers();

    instance.notifyChange();
});

const [setLightType] = bindDropDown('light-type', type => {
    // @ts-expect-error casting to string
    lightParams.lightType = type;

    document.getElementById('point-light-params').style.display =
        lightParams.lightType === 'point' ? 'block' : 'none';
    document.getElementById('directional-light-params').style.display =
        lightParams.lightType === 'directional' ? 'block' : 'none';

    updateLightsAndHelpers();
});

const [setEnableShadows] = bindToggle('enable-shadows', v => {
    lightParams.enableShadows = v;
    directionalLight.castShadow = v;
    pointLight.castShadow = v;

    instance.notifyChange();
});

const [setShadowMapType] = bindNumericalDropDown('shadow-map-type', type => {
    lightParams.shadowMapType = type;
    // @ts-expect-error casting to number
    instance.renderer.shadowMap.type = type;
});

const [setMode] = bindNumericalDropDown('mode', newMode => {
    const simpleGroup = document.getElementById('simpleGroup');
    const realisticGroup = document.getElementById('realisticGroup');
    const shadingGroup = document.getElementById('shadingParams');
    const shadowGroup = document.getElementById('group-shadows');
    const noShadowGroup = document.getElementById('group-noshadows');

    switch (newMode) {
        case -1:
            map.lighting.enabled = false;
            shadingGroup.style.display = 'none';
            shadowGroup.style.display = 'none';
            noShadowGroup.style.display = 'block';
            break;
        case MapLightingMode.Hillshade:
            shadingGroup.style.display = 'block';
            simpleGroup.style.display = 'block';
            realisticGroup.style.display = 'none';
            map.lighting.enabled = true;
            map.lighting.mode = MapLightingMode.Hillshade;
            shadowGroup.style.display = 'none';
            noShadowGroup.style.display = 'block';
            break;
        case MapLightingMode.LightBased:
            shadingGroup.style.display = 'block';
            simpleGroup.style.display = 'none';
            realisticGroup.style.display = 'block';
            map.lighting.enabled = true;
            map.lighting.mode = MapLightingMode.LightBased;
            shadowGroup.style.display = 'block';
            noShadowGroup.style.display = 'none';
            break;
    }

    instance.notifyChange(map);
});

const [setOpacity, , opacitySlider] = bindSlider('opacity', percentage => {
    const opacity = percentage / 100.0;
    colorLayer.opacity = opacity;
    instance.notifyChange(map);
    opacitySlider.innerHTML = `${percentage}%`;
});

const [setIntensity] = bindSlider('intensity', intensity => {
    map.lighting.hillshadeIntensity = intensity;
    instance.notifyChange(map);
});

const [setDirectionalLightIntensity] = bindSlider('directional-light-intensity', v => {
    lightParams.directionalLightIntensity = v;
    directionalLight.intensity = v;
    instance.notifyChange();
});

const [setPointLightIntensity] = bindSlider('point-light-intensity', v => {
    lightParams.pointLightIntensity = v;
    pointLight.intensity = v;
    instance.notifyChange();
});

const [setShadowVolumeNear] = bindSlider('shadow-volume-near', v => {
    lightParams.shadowVolumeNear = v;
    directionalLight.shadow.camera.near = v;
    updateLightsAndHelpers();
    instance.notifyChange();
});

const [setShadowVolumeFar] = bindSlider('shadow-volume-far', v => {
    lightParams.shadowVolumeFar = v;
    directionalLight.shadow.camera.far = v;
    updateLightsAndHelpers();
    instance.notifyChange();
});

const [setAmbientIntensity] = bindSlider('ambient-intensity', v => {
    lightParams.ambientIntensity = v;
    ambientLight.intensity = v;
    instance.notifyChange();
});

const [setShadowIntensity] = bindSlider('shadow-map-intensity', v => {
    lightParams.shadowIntensity = v;
    updateLightsAndHelpers();
    instance.notifyChange();
});

const [setZFactor] = bindSlider('zFactor', zFactor => {
    map.lighting.zFactor = zFactor;
    instance.notifyChange(map);
});

const [setShowHelpers] = bindToggle('show-helpers', enabled => {
    lightParams.showHelpers = enabled;
    updateLightsAndHelpers();
    instance.notifyChange();
});

const cubes = [];

const reset = () => {
    cubes.forEach(c => {
        c.geometry.dispose();
        c.material.dispose();
        c.removeFromParent();
    });

    setColorLayerToggle(true);
    setLightColor('white');
    setAmbientColor('white');
    setLightType('directional');
    setIntensity(1);
    setEnableShadows(true);
    setShadowMapType(VSMShadowMap);
    setShadowVolumeSize(EXTENT_SIZE);
    setShadowMapResolution(2048);
    setShadowMapBias(-0.0001);
    setShadowMapNormalBias(0);
    setShadowVolumeNear(50000);
    setShadowVolumeFar(150000);
    setDirectionalLightIntensity(5);
    setPointLightIntensity(20000000);
    setAmbientIntensity(1);
    setShadowIntensity(1);
    setZFactor(1);
    setOpacity(100);
    setMode(MapLightingMode.LightBased);
    setShowHelpers(false);
    setAzimuth(252);
    setZenith(71);

    updateLightsAndHelpers();
};

bindButton('reset', () => {
    reset();
});

bindButton('create-cube', btn => {
    btn.disabled = true;

    const size = Math.random() * 500 + 100;
    const cube = new Mesh(
        new BoxGeometry(size, size, size),
        new MeshStandardMaterial({ color: new Color().setHSL(Math.random(), 0.5, 0.5) }),
    );
    cube.castShadow = true;
    cube.receiveShadow = true;

    cube.material.opacity = 0.5;
    cube.material.transparent = true;

    instance.add(cube);
    cubes.push(cube);

    const onMouseMove = e => {
        const picked = instance.pickObjectsAt(e, {
            sortByDistance: true,
            filter: p => p.object !== cube,
        })[0];
        if (picked) {
            const { x, y, z } = picked.point;

            cube.position.set(x, y, z + size / 2);
            cube.updateMatrixWorld(true);

            instance.notifyChange();
        }
    };

    instance.domElement.addEventListener('mousemove', onMouseMove);

    instance.domElement.addEventListener('mousedown', e => {
        cube.material.opacity = 1;
        cube.material.transparent = false;

        btn.disabled = false;

        instance.domElement.removeEventListener('mousemove', onMouseMove);

        instance.notifyChange();
    });
});

reset();

instance.domElement.addEventListener('mousemove', e => {
    const picked = instance.pickObjectsAt(e, { sortByDistance: true })[0];
    if (picked) {
        const { x, y, z } = picked.point;

        pointLight.position.set(x, y, z + 200);
        pointLight.updateMatrixWorld(true);
        pointLightHelper.update();
        pointLightHelper.updateMatrixWorld(true);

        instance.notifyChange();
    }
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
