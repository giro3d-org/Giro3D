import { Color } from 'three';

import XYZ from 'ol/source/XYZ.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import COPCSource from '@giro3d/giro3d/sources/COPCSource.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';

import StatusBar from './widgets/StatusBar.js';
import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindNumberInput } from './widgets/bindNumberInput.js';
import { bindProgress } from './widgets/bindProgress.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { formatPointCount } from './widgets/formatPointCount.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import { placeCameraOnTop } from './widgets/placeCameraOnTop.js';

// LAS processing requires the WebAssembly laz-perf library
// This path is specific to your project, and must be set accordingly.
setLazPerfPath('/assets/wasm');

// We use this CRS when the point cloud does not have a CRS defined.
// It is technically the WebMercator CRS, but we label it 'unknown' to make
// it very explicit that it is not correct.
// See https://gitlab.com/giro3d/giro3d/-/issues/514
Instance.registerCRS(
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
    enableFilters: false,
};

/** @type {PointCloud} */
let entity;

/** @type {ColorLayer} */
let colorLayer;

function updateColoring() {
    const attribute = options.attribute;

    if (options.mode === 'layer') {
        if (colorLayer != null) {
            entity.setColorLayer(colorLayer);
            entity.setColoringMode('layer');
        }
    } else {
        entity.setColoringMode('attribute');
        entity.setActiveAttribute(attribute);
    }

    const classificationGroup = document.getElementById('classification-group');
    const colorMapGroup = document.getElementById('ramp-group');

    const shouldDisplayClassifications = attribute === 'Classification';
    classificationGroup.style.display = shouldDisplayClassifications ? 'block' : 'none';
    colorMapGroup.style.display =
        !shouldDisplayClassifications && attribute !== 'Color' ? 'flex' : 'none';

    if (options.mode !== 'layer') {
        updateColorMap();
    }
}

const [setProgress, progressElement] = bindProgress('progress');

const [, , , setAvailableAttributes] = bindDropDown('attribute', attribute => {
    options.attribute = attribute;

    if (entity) {
        updateColoring();
    }
});

const [setMin] = bindSlider('min', min => {
    options.min = Math.round(min);
    if (entity && instance) {
        entity.colorMap.min = min;
        instance.notifyChange(entity);
        document.getElementById('label-bounds').innerHTML =
            `Bounds: <b>${options.min}</b> — <b>${options.max}<b>`;
    }
});

const [setMax] = bindSlider('max', max => {
    options.max = Math.round(max);
    if (entity && instance) {
        entity.colorMap.max = max;
        instance.notifyChange(entity);
        document.getElementById('label-bounds').innerHTML =
            `Bounds: <b>${options.min}</b> — <b>${options.max}<b>`;
    }
});

bindToggle('show-tile-volumes', v => {
    entity.showNodeVolumes = v;
});

bindToggle('show-volume', v => {
    entity.showVolume = v;
});

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

function updateColorMapMinMax() {
    if (!entity) {
        return;
    }

    const min = entity.activeAttribute.min ?? 0;
    const max = entity.activeAttribute.max ?? 255;

    const step = entity.activeAttribute.type === 'float' ? 0.0001 : 1;

    const lowerBound = min;
    const upperBound = max;

    setMin(min, lowerBound, upperBound, step);
    setMax(max, lowerBound, upperBound, step);
}

bindDropDown('ramp', ramp => {
    options.colorRamp = ramp;
    updateColorMap();
});

function updateColorMap() {
    if (entity && instance) {
        entity.colorMap.colors = makeColorRamp(options.colorRamp);

        updateColorMapMinMax();

        instance.notifyChange();
    }
}

function loadMap(instance, extent) {
    const map = new Map({ extent, depthTest: false });

    instance.add(map);

    const key =
        'pk.eyJ1IjoidG11Z3VldCIsImEiOiJjbGJ4dTNkOW0wYWx4M25ybWZ5YnpicHV6In0.KhDJ7W5N3d1z3ArrsDjX_A';

    // Adds a XYZ elevation layer with MapBox terrain RGB tileset
    const elevationLayer = new ElevationLayer({
        extent,
        resolutionFactor: 0.25,
        source: new TiledImageSource({
            format: new MapboxTerrainFormat(),
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
                projection: 'EPSG:3857',
            }),
        }),
    });
    map.addLayer(elevationLayer);

    // Adds a XYZ color layer with MapBox satellite tileset
    colorLayer = new ColorLayer({
        extent,
        resolutionFactor: 0.5,
        source: new TiledImageSource({
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
                projection: 'EPSG:3857',
            }),
        }),
    });
    map.addLayer(colorLayer);

    return map;
}

/**
 * @param {string} crs
 */
async function fetchCrsDefinition(crs) {
    const code = crs.split(':')[1];

    async function fetchText(url) {
        const res = await fetch(url, { mode: 'cors' });
        const def = await res.text();
        return def;
    }

    const def = await fetchText(`https://epsg.io/${code}.proj4?download=1`);

    Instance.registerCRS(crs, def);

    return def;
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

let filters = [null, null, null];

function updateFilters(source) {
    source.filters = options.enableFilters ? filters : null;
}

function bindFilter(index, attributes, onChange) {
    const filter = {
        dimension: 'Z',
        operator: 'not',
        value: 0,
    };

    filters[index - 1] = filter;

    const [, , , setFilterAttributes] = bindDropDown(
        `filter-${index}-attribute`,
        filterAttribute => {
            filter.dimension = filterAttribute;
            onChange();
        },
    );
    bindDropDown(`filter-${index}-operator`, filterOperator => {
        filter.operator = filterOperator;
        onChange();
    });
    bindNumberInput(`filter-${index}-value`, v => {
        filter.value = v;
        onChange();
    });

    setFilterAttributes(
        attributes.map((a, i) => {
            return { id: a.name, name: a.name, selected: i === 0 };
        }),
    );
}

/**
 * @param {string} crs
 * @param {PointCloud} entity
 * @param {COPCSource} source
 */
function populateGUI(crs, entity, source) {
    document.getElementById('accordion').style.display = 'block';

    const tableElement = document.getElementById('table');
    tableElement.style.display = 'block';

    /** @type {HTMLLinkElement} */
    // @ts-expect-error casting
    const projectionElement = document.getElementById('projection');
    if (crs != null) {
        projectionElement.href = `https://epsg.io/${instance.referenceCrs.split(':')[1]}`;
        projectionElement.innerHTML = instance.referenceCrs;
    } else {
        projectionElement.parentElement.remove();
    }

    progressElement.style.display = 'none';

    const attributes = entity.getSupportedAttributes();

    // Bind the 3 filters
    bindFilter(1, attributes, () => updateFilters(source));
    bindFilter(2, attributes, () => updateFilters(source));
    bindFilter(3, attributes, () => updateFilters(source));

    bindToggle('filters', v => {
        options.enableFilters = v;
        updateFilters(source);
    });
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
        crs: metadata.crs?.name ?? 'unknown',
        backgroundColor: null,
    });

    setAvailableAttributes(
        metadata.attributes.map((att, index) => ({
            id: att.name,
            name: att.name,
            selected: index === 0,
        })),
    );

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

    // Such as setting the min and max of the colormap bounds.
    setMin(volume.min.z, volume.min.z, volume.max.z);
    setMax(volume.max.z, volume.min.z, volume.max.z);

    updateColoring();
    updateColorMap();

    bindToggle('show-dataset', show => {
        entity.visible = show;
        instance.notifyChange(entity);
    });

    bindToggle('radio-layer', v => {
        if (v) {
            options.mode = 'layer';
            document.getElementById('group-attribute').style.display = 'none';

            updateColoring();
        }
    });

    bindToggle('radio-attribute', v => {
        if (v) {
            options.mode = 'attribute';
            document.getElementById('group-attribute').style.display = 'block';

            updateColoring();
        }
    });

    // If the source provides a coordinate system, we can load a map
    // to display as a geographic context and be able to check that the
    // point cloud is properly positioned.
    if (metadata.crs) {
        try {
            await fetchCrsDefinition(metadata.crs.name);

            // We create the extent from the volume of the point cloud.
            const extent = Extent.fromBox3(instance.referenceCrs, volume);
            const map = loadMap(instance, extent.withRelativeMargin(1.2));

            document.getElementById('basemap-group').style.display = 'block';
            bindToggle('show-basemap', show => {
                map.visible = show;
                instance.notifyChange(map);
            });
        } catch (e) {
            console.warn('could not load map: ' + e);
        }
    }

    // Let's populate the classification list with default values from the ASPRS classifications.
    addClassification(0, 'Created, never classified', entity.classifications);
    addClassification(1, 'Unclassified', entity.classifications);
    addClassification(2, 'Ground', entity.classifications);
    addClassification(3, 'Low vegetation', entity.classifications);
    addClassification(4, 'Medium vegetation', entity.classifications);
    addClassification(5, 'High vegetation', entity.classifications);
    addClassification(6, 'Building', entity.classifications);
    addClassification(7, 'Low point (noise)', entity.classifications);
    addClassification(8, 'Reserved', entity.classifications);
    addClassification(9, 'Water', entity.classifications);
    addClassification(10, 'Rail', entity.classifications);
    addClassification(11, 'Road surface', entity.classifications);
    addClassification(12, 'Reserved', entity.classifications);
    addClassification(13, 'Wire - Guard (shield)', entity.classifications);
    addClassification(14, 'Wire - Conductor (Phase)', entity.classifications);
    addClassification(15, 'Transmission Tower', entity.classifications);
    addClassification(16, 'Wire Structure connector (e.g Insulator)', entity.classifications);
    addClassification(17, 'Bridge deck', entity.classifications);
    addClassification(18, 'High noise', entity.classifications);

    populateGUI(metadata.crs?.name, entity, source);

    Inspector.attach('inspector', instance);

    StatusBar.bind(instance, { disableUrlUpdate: true });

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

const classificationNames = new Array(32);

function addClassification(number, name, array) {
    const currentColor = array[number].color.getHexString();

    const template = `
    <div class="form-check">
        <input
            class="form-check-input"
            type="checkbox"
            checked
            role="switch"
            id="class-${number}"
            autocomplete="off"
        />
        <label class="form-check-label w-100" for="class-${number}">
            <div class="row">
                <div class="col" style="font-size: 13px">${name}</div>
                <div class="col-auto">
                    <input
                        type="color"
                        style="height: 1rem; padding: 1px;"
                        class="form-control form-control-color float-end"
                        id="color-${number}"
                        value="#${currentColor}"
                        title="Classification color"
                    />
                </div>
            </div>
        </label>
    </div>
    `;

    const node = document.createElement('div');
    node.innerHTML = template;
    document.getElementById('classifications').appendChild(node);

    // Let's change the classification color with the color picker value
    bindColorPicker(`color-${number}`, v => {
        // Parse it into a THREE.js color
        const color = new Color(v);

        array[number].color = color;

        instance.notifyChange();
    });

    classificationNames[number] = name;

    bindToggle(`class-${number}`, enabled => {
        // By toggling the .visible property of a classification,
        // all points that have this classification are hidden/shown.
        array[number].visible = enabled;
        instance.notifyChange();
    });
}

load(datasetUrl).catch(console.error);
