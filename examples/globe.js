import { AmbientLight, DirectionalLight, MathUtils, Vector3 } from 'three';

import { TopoJSON } from 'ol/format.js';
import OSM from 'ol/source/OSM.js';
import XYZ from 'ol/source/XYZ.js';
import { Fill, Style } from 'ol/style.js';

import GlobeControls from '@giro3d/giro3d/controls/GlobeControls.js';
import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Sun from '@giro3d/giro3d/core/geographic/Sun.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import BlendingMode from '@giro3d/giro3d/core/layer/BlendingMode.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Atmosphere from '@giro3d/giro3d/entities/Atmosphere.js';
import Glow from '@giro3d/giro3d/entities/Glow.js';
import Globe from '@giro3d/giro3d/entities/Globe.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import GlobeControlsInspector from '@giro3d/giro3d/gui/GlobeControlsInspector.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';
import StaticImageSource from '@giro3d/giro3d/sources/StaticImageSource.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import SphericalPanorama from '@giro3d/giro3d/entities/SphericalPanorama.js';

import StatusBar from './widgets/StatusBar.js';

import { bindButton } from './widgets/bindButton.js';
import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindDatePicker } from './widgets/bindDatePicker.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import { updateLabel } from './widgets/updateLabel.js';

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:4978',
    backgroundColor: 'black',
});

/////////////////////////////// Globe creations ///////////////////////////////////////////////////

const earth = new Globe({
    lighting: {
        enabled: true,
    },
    graticule: {
        enabled: true,
        color: 'black',
        xStep: 10, // In degrees
        yStep: 10, // In degrees
        xOffset: 0,
        yOffset: 0,
        opacity: 0.5,
        thickness: 0.5, // In degrees
    },
    backgroundColor: '#001B35',
});

earth.name = 'Earth';

instance.add(earth);

const moon = new Globe({
    lighting: {
        enabled: true,
    },
    graticule: {
        enabled: true,
        color: 'black',
        xStep: 10, // In degrees
        yStep: 10, // In degrees
        xOffset: 0,
        yOffset: 0,
        opacity: 0.5,
        thickness: 0.5, // In degrees
    },
    backgroundColor: 'grey',
    // For the moon we use a custom ellipsoid
    ellipsoid: new Ellipsoid({
        semiMajorAxis: 1_738_100,
        semiMinorAxis: 1_736_000,
    }),
});

moon.name = 'Moon';

instance.add(moon);

const moonLayer = new ColorLayer({
    source: new GeoTIFFSource({
        url: 'https://3d.oslandia.com/giro3d/rasters/moon.tif',
        crs: 'EPSG:4326',
    }),
});

moon.addLayer(moonLayer);

const mars = new Globe({
    lighting: {
        enabled: true,
    },
    graticule: {
        enabled: true,
        color: 'black',
        xStep: 10, // In degrees
        yStep: 10, // In degrees
        xOffset: 0,
        yOffset: 0,
        opacity: 0.5,
        thickness: 0.5, // In degrees
    },
    backgroundColor: '#C64600',
    // For Mars we use a custom ellipsoid
    // See https://tharsis.gsfc.nasa.gov/geodesy.html
    ellipsoid: new Ellipsoid({
        semiMajorAxis: 3_396_200,
        semiMinorAxis: 3_376_189,
    }),
});

mars.name = 'Mars';

instance.add(mars);

const marsLayer = new ColorLayer({
    source: new GeoTIFFSource({
        // From https://www.solarsystemscope.com/textures/
        url: 'https://3d.oslandia.com/giro3d/rasters/8k_mars.tif',
        crs: 'EPSG:4326',
    }),
});

mars.addLayer(marsLayer);

// The sun is so huge that it would be impractical
// to display it in its actual scale.
const SUN_SIZE_FACTOR = 0.1;

const sun = new Globe({
    lighting: {
        enabled: false,
    },
    graticule: {
        enabled: true,
        color: 'black',
        xStep: 10, // In degrees
        yStep: 10, // In degrees
        xOffset: 0,
        yOffset: 0,
        opacity: 0.5,
        thickness: 0.5, // In degrees
    },
    backgroundColor: 'grey',
    // For the sun we use a spherical ellipsoid
    ellipsoid: new Ellipsoid({
        semiMajorAxis: 696_340_000 * SUN_SIZE_FACTOR,
        semiMinorAxis: 696_340_000 * SUN_SIZE_FACTOR,
    }),
});

sun.name = 'Sun';

instance.add(sun);

const sunLayer = new ColorLayer({
    source: new GeoTIFFSource({
        // From https://www.solarsystemscope.com/textures/
        url: 'https://3d.oslandia.com/giro3d/rasters/8k_sun.tif',
        crs: 'EPSG:4326',
    }),
});

sun.addLayer(sunLayer);

const allGlobes = [earth, moon, mars, sun];

/////////////////////////////// Star background /////////////////////////////////////////////////

const background = new SphericalPanorama({
    radius: 10_000_000,
    subdivisionThreshold: 0.4,
    depthTest: false,
});
background.name = 'background';
background.renderOrder = -9999;
instance.add(background);

const starLayer = new ColorLayer({
    source: new StaticImageSource({
        source: 'https://3d.oslandia.com/giro3d/images/4k_stars_milky_way.jpg',
        extent: Extent.equirectangular,
    }),
});

background.addLayer(starLayer);

/////////////////////////////// Earth layers ////////////////////////////////////////////////////

const mapboxApiKey =
    'pk.eyJ1IjoidG11Z3VldCIsImEiOiJjbGJ4dTNkOW0wYWx4M25ybWZ5YnpicHV6In0.KhDJ7W5N3d1z3ArrsDjX_A';

// Adds a XYZ elevation layer with MapBox terrain RGB tileset
const elevationLayer = new ElevationLayer({
    name: 'elevation',
    preloadImages: true,
    colorMap: new ColorMap({ colors: makeColorRamp('greens'), min: -1500, max: 6000 }),
    minmax: { min: -500, max: 8000 },
    resolutionFactor: 0.5,
    source: new TiledImageSource({
        retries: 0,
        format: new MapboxTerrainFormat(),
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${mapboxApiKey}`,
            projection: 'EPSG:3857',
        }),
    }),
});
earth.addLayer(elevationLayer).catch(console.error);

const watermask = new ColorLayer({
    name: 'watermask',
    source: new VectorSource({
        dataProjection: 'EPSG:4326',
        data: {
            url: 'https://3d.oslandia.com/giro3d/vectors/water_mask.topojson',
            format: new TopoJSON(),
        },
        style: new Style({
            fill: new Fill({
                color: '#22274a',
            }),
        }),
    }),
});

earth.addLayer(watermask);

// Adds a XYZ color layer with MapBox satellite tileset
const satellite = new ColorLayer({
    name: 'satellite',
    preloadImages: true,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${mapboxApiKey}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});
earth.addLayer(satellite).catch(e => console.error(e));

// Create the OpenStreetMap color layer using an OpenLayers source.
// See https://openlayers.org/en/latest/apidoc/module-ol_source_OSM-OSM.html
// for more informations.
const osm = new ColorLayer({
    name: 'OSM',
    source: new TiledImageSource({ source: new OSM() }),
});
earth.addLayer(osm).catch(e => console.error(e));

const clouds = new ColorLayer({
    name: 'clouds',
    blendingMode: BlendingMode.Add,
    source: new StaticImageSource({
        source: 'https://3d.oslandia.com/giro3d/images/cloud_cover.webp',
        extent: Extent.WGS84,
    }),
});
earth.addLayer(clouds).catch(console.error);

/////////////////////////////// Lighting //////////////////////////////////////////////////////

// Let's add a sun in our scene
const sunlight = new DirectionalLight('white', 4);
sunlight.name = 'sun';

instance.add(sunlight);
instance.add(sunlight.target);

sunlight.updateMatrixWorld(true);

const ambientLight = new AmbientLight('white', 0.3);
instance.add(ambientLight);

/////////////////////////////// Atmospheres //////////////////////////////////////////////////

const earthAtmosphere = new Atmosphere({ ellipsoid: earth.ellipsoid });
earthAtmosphere.name = 'Earth atmosphere';
instance.add(earthAtmosphere);

const marsAtmosphere = new Atmosphere({
    ellipsoid: mars.ellipsoid,
    wavelengths: [0.414, 0.443, 0.475], // To give the atmosphere the rusty color of Mars
});
marsAtmosphere.name = 'Mars atmosphere';
instance.add(marsAtmosphere);

// For the sun we don't use an atmosphere, but a glow
const sunGlow = new Glow({
    color: '#ff7800',
    ellipsoid: sun.ellipsoid,
});

sunGlow.name = 'sun glow';

instance.add(sunGlow);

/////////////////////////////// Camera & controls ///////////////////////////////////////////

const defaultCameraPosition = new Vector3(35_785_000 + Ellipsoid.WGS84.semiMajorAxis, 0, 0);

// Geostationary orbit at 36,000 km
instance.view.camera.position.copy(defaultCameraPosition);
instance.view.camera.lookAt(new Vector3(0, 0, 0));

const controls = new GlobeControls({ instance });

instance.view.setControls(controls);

/////////////////////////////// Example GUI bindings ///////////////////////////////////////////

const [setGraticule] = bindToggle('graticule', enabled => {
    allGlobes.forEach(g => (g.graticule.enabled = enabled));
    instance.notifyChange(allGlobes);
});

setGraticule(earth.graticule.enabled);

const [setAtmosphere] = bindToggle('atmosphere', enabled => {
    earthAtmosphere.visible = enabled && earth.visible;
    marsAtmosphere.visible = enabled && mars.visible;
    sunGlow.visible = enabled && sun.visible;

    instance.notifyChange([earthAtmosphere, marsAtmosphere, sunGlow]);
});

const getActiveGlobe = () => {
    return allGlobes.find(g => g.visible);
};

function update() {
    const globe = getActiveGlobe();

    if (globe == null) {
        return;
    }

    const { x, y, z } = instance.view.camera.position;
    let altitude = globe.ellipsoid.toGeodetic(x, y, z).altitude;
    altitude = MathUtils.clamp(altitude, 2, +Infinity);

    controls.minDistance = globe.ellipsoid.semiMajorAxis;
    controls.maxDistance = globe.ellipsoid.semiMajorAxis * 6;

    instance.view.minNearPlane = altitude < 100_000 ? 10 : altitude / 5;
    instance.view.maxFarPlane = 1_000_000_000;

    // Let's adjust the graticule step and thickness so that
    // it more or less always look the same when altitude changes.
    if (earth.graticule.enabled) {
        let step = 0;
        if (altitude > 10_000_000) {
            step = 10;
        } else if (altitude > 3_000_000) {
            step = 5;
        } else if (altitude > 1_000_000) {
            step = 2;
        } else if (altitude > 500_000) {
            step = 1;
        } else {
            step = 0.5;
        }

        const thickness = MathUtils.mapLinear(altitude, 200, 39_000_000, 0.002, 0.9);

        earth.graticule.xStep = step;
        earth.graticule.yStep = step;
        earth.graticule.thickness = thickness;
    }

    // Let's make the clouds transparent when we zoom in.
    const opacity = MathUtils.mapLinear(altitude, 12_000_000, 30_000_000, 0, 1);
    clouds.opacity = MathUtils.clamp(opacity, 0, 1);
    earthAtmosphere.opacity = clouds.opacity;

    // Let's increase the shading on the terrain when we zoom out
    const zFactor = MathUtils.mapLinear(altitude, 12_000_000, 30_000_000, 1, 10);
    earth.lighting.zFactor = MathUtils.clamp(zFactor, 1, 10);

    background.object3d.position.set(x, y, z);
    background.object3d.updateMatrixWorld(true);
}

update();

const updateColorMap = () => {
    const minmax = earth.getElevationMinMaxForVisibleTiles();

    if (minmax != null && isFinite(minmax.min) && isFinite(minmax.max)) {
        const colorMap = elevationLayer.colorMap;
        colorMap.min = MathUtils.lerp(minmax.min, colorMap.min, 0.8);
        colorMap.max = MathUtils.lerp(minmax.max, colorMap.max, 0.8);

        instance.notifyChange(elevationLayer);
    }
};

setInterval(updateColorMap, 50);

instance.addEventListener('after-camera-update', update);

const sunParams = {
    latitude: 9,
    longitude: -41,
};

const updateSunDirection = (latitude, longitude) => {
    const position = Ellipsoid.WGS84.toCartesian(
        sunParams.latitude,
        sunParams.longitude,
        50_000_000,
    );

    sunlight.position.copy(position);
    sunlight.target.position.set(0, 0, 0);
    sunlight.target.updateMatrixWorld(true);
    sunlight.updateMatrixWorld(true);

    const normal = Ellipsoid.WGS84.getNormal(sunParams.latitude, sunParams.longitude);
    earthAtmosphere.setSunPosition(position);
    marsAtmosphere.setSunPosition(position);
};

const [setSunLatitude] = bindSlider('sunLatitude', lat => {
    sunParams.latitude = lat;
    updateSunDirection(sunParams.latitude, sunParams.longitude);
    updateLabel('sunLatitudeLabel', `Lat: ${Math.round(Math.abs(lat))}° ${lat >= 0 ? 'N' : 'S'}`);
});

const [setSunLongitude] = bindSlider('sunLongitude', lon => {
    sunParams.longitude = lon;
    updateSunDirection(sunParams.latitude, sunParams.longitude);
    updateLabel('sunLongitudeLabel', `Lon: ${Math.round(Math.abs(lon))} ${lon >= 0 ? 'E' : 'W'}°`);
});

const [setLighting] = bindToggle('lighting', enabled => {
    earth.lighting.enabled = enabled;
    document.getElementById('lightingParams').style.display = enabled ? 'block' : 'none';
    instance.notifyChange(earth);
});

function setSunPosition(date) {
    const sunPosition = Sun.getGeographicPosition(date);

    setSunLongitude(sunPosition.longitude);
    setSunLatitude(sunPosition.latitude);
}

let date = new Date();

const [setDate] = bindDatePicker('date', date => {
    setSunPosition(date);
});

const [setTime] = bindSlider('time', seconds => {
    const h = seconds / 3600;
    const wholeH = Math.floor(h);

    const m = (h - wholeH) * 60;
    const wholeM = Math.floor(m);

    date.setUTCHours(wholeH, wholeM);

    setSunPosition(date);

    document.getElementById('timeLabel').innerText =
        `${wholeH.toString().padStart(2, '0')}:${wholeM.toString().padStart(2, '0')} UTC`;
});

const setCurrentDate = date => {
    setSunPosition(date);
    setDate(date);
    setTime(date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds());
};

bindButton('now', () => {
    date = new Date();
    setCurrentDate(date);
});

const [setSunPositionMode] = bindDropDown('sun-position-mode', newMode => {
    const datePicker = document.getElementById('date-picker');
    const locationPicker = document.getElementById('sun-location');
    const timeSlider = document.getElementById('timeContainer');

    datePicker.style.display = 'none';
    locationPicker.style.display = 'none';
    timeSlider.style.display = 'none';

    switch (newMode) {
        case 'custom-date':
            datePicker.style.display = 'block';
            timeSlider.style.display = 'block';
            break;
        case 'custom-location':
            locationPicker.style.display = 'block';
            break;
    }
});

const [setGraticuleColor] = bindColorPicker('graticule-color', color => {
    allGlobes.forEach(g => (g.graticule.color = color));
    instance.notifyChange(allGlobes);
});

function setLayers(...name) {
    for (const layer of earth.getLayers()) {
        layer.visible = name.includes(layer.name);
    }
}

const [setAmbientIntensity] = bindSlider('ambientIntensity', intensity => {
    ambientLight.intensity = intensity;
    instance.notifyChange();
});

const [setSunIntensity] = bindSlider('sunIntensity', intensity => {
    sunlight.intensity = intensity;
    instance.notifyChange();
});

const [setGlobe] = bindDropDown('globe-selector', globe => {
    allGlobes.forEach(g => (g.visible = false));

    switch (globe) {
        case 'moon':
            moon.visible = true;
            break;
        case 'sun':
            sun.visible = true;
            break;
        case 'earth':
            earth.visible = true;
            break;
        case 'mars':
            mars.visible = true;
            break;
    }

    document.getElementById('earth-params').style.display = earth.visible ? 'block' : 'none';
    document.getElementById('lightingGroup').style.display = sun.visible ? 'none' : 'block';
    document.getElementById('sunParams').style.display = sun.visible ? 'none' : 'block';

    earthAtmosphere.visible = earth.visible;
    marsAtmosphere.visible = mars.visible;
    sunGlow.visible = sun.visible;

    instance.notifyChange(allGlobes);
});

const reset = () => {
    setGlobe('earth'); // TODO
    setLayers('satellite', 'clouds');
    setAtmosphere(true);
    setGraticule(false);
    setGraticuleColor(0x000000);
    setSunLatitude(9);
    setSunLongitude(-41);
    setAmbientIntensity(0.4);
    setSunIntensity(4);
    setLighting(true);
    setSunPositionMode('custom-location');

    instance.view.camera.position.copy(defaultCameraPosition);
    instance.view.camera.lookAt(new Vector3(0, 0, 0));

    populateLayerList();
};

bindButton('reset', reset);

function populateLayerList() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';

    const entries = [`<li class="list-group-item list-group-item-secondary">Layers</li>`];

    const createEntry = (name, visible) => {
        const entry = `
            <li class="list-group-item">
                <input id="layer-${name}" class="form-check-input me-1" ${visible ? 'checked' : ''} type="checkbox" />
                <label class="form-check-label" for="layer-${name}">${name}</label>
            </li>
        `;

        entries.push(entry);
    };

    for (const layer of earth.getColorLayers().reverse()) {
        createEntry(layer.name, layer.visible);
    }

    for (const layer of earth.getElevationLayers()) {
        createEntry(layer.name, layer.visible);
    }

    list.innerHTML = entries.join('\n');

    for (const layer of earth.getLayers()) {
        bindToggle(`layer-${layer.name}`, visible => {
            layer.visible = visible;
            instance.notifyChange(earth);
        });
    }
}

reset();

const inspector = Inspector.attach('inspector', instance);
inspector.addPanel(new GlobeControlsInspector(inspector.gui, instance, controls));

StatusBar.bind(instance);
