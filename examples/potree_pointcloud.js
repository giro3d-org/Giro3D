import { Color } from 'three';

import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import PotreeSource from '@giro3d/giro3d/sources/PotreeSource.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';

import StatusBar from './widgets/StatusBar.js';
import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindProgress } from './widgets/bindProgress.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import { formatPointCount } from './widgets/formatPointCount.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import { placeCameraOnTop } from './widgets/placeCameraOnTop.js';

// Some Potree datasets contain LAZ files.
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

const options = {
    attribute: 'position',
    colorRamp: 'greys',
    min: 0,
    max: 100,
};

/** @type {PointCloud} */
let entity;

/** @type {Instance} */
let instance;

function updateActiveAttribute() {
    const attribute = options.attribute;

    entity.setActiveAttribute(attribute);

    const classificationGroup = document.getElementById('classification-group');
    const colorMapGroup = document.getElementById('ramp-group');

    const shouldDisplayClassifications = attribute.toLowerCase() === 'classification';
    classificationGroup.style.display = shouldDisplayClassifications ? 'block' : 'none';
    colorMapGroup.style.display =
        !shouldDisplayClassifications && attribute !== 'Color' && attribute !== 'COLOR_PACKED'
            ? 'flex'
            : 'none';

    updateColorMap();
}

const [setProgress, progressElement] = bindProgress('progress');

const [, , , setAvailableAttributes] = bindDropDown('attribute', attribute => {
    options.attribute = attribute;

    if (entity) {
        updateActiveAttribute();
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

function updateColorMapMinMax() {
    if (!entity) {
        return;
    }

    const min = entity.activeAttribute.min ?? 0;
    const max = entity.activeAttribute.max ?? 255;

    const lowerBound = min;
    const upperBound = max;

    setMin(min, lowerBound, upperBound);
    setMax(max, lowerBound, upperBound);
}

const [, currentRamp] = bindDropDown('ramp', ramp => {
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

function populateGUI(entity) {
    document.getElementById('accordion').style.display = 'block';

    const tableElement = document.getElementById('table');
    tableElement.style.display = 'block';

    progressElement.style.display = 'none';
}

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function updateDisplayedPointCounts(count, displayed) {
    const pointCountElement = document.getElementById('point-count');
    pointCountElement.innerHTML = count != null ? formatPointCount(count, numberFormat) : 'unknown';
    pointCountElement.title = count != null ? numberFormat.format(count) : 'unknown';

    const activePointCountElement = document.getElementById('displayed-point-count');
    activePointCountElement.innerHTML = formatPointCount(displayed, numberFormat);
    activePointCountElement.title = numberFormat.format(displayed);
}

async function load(url) {
    progressElement.style.display = 'block';

    const source = new PotreeSource({ url });

    source.addEventListener('progress', () => setProgress(source.progress));

    await source.initialize();

    const metadata = await source.getMetadata();

    let crs = 'unknown';
    if (metadata.crs != null) {
        crs = metadata.crs.name;
        Instance.registerCRS(metadata.crs.name, metadata.crs.definition);
    }

    instance = new Instance({
        target: 'view',
        crs: crs,
        backgroundColor: null,
        renderer: {
            logarithmicDepthBuffer: true,
        },
    });

    // Let's enable Eye Dome Lighting to make the point cloud more readable.
    instance.renderingOptions.enableEDL = true;
    instance.renderingOptions.EDLRadius = 0.6;
    instance.renderingOptions.EDLStrength = 5;

    entity = new PointCloud({ source });

    try {
        await instance.add(entity);
    } catch (err) {
        if (err instanceof Error) {
            const messageElement = document.getElementById('message');
            messageElement.innerText = err.message;
            messageElement.style.display = 'block';
        }
        console.error(err);
        return;
    } finally {
        progressElement.style.display = 'none';
    }

    // Create the color map. The color ramp and bounds will be set later.
    entity.colorMap = new ColorMap({ colors: [], min: 0, max: 1 });

    instance.addEventListener('update-end', () =>
        updateDisplayedPointCounts(entity.pointCount, entity.displayedPointCount),
    );

    placeCameraOnTop(entity.getBoundingBox(), instance);

    setAvailableAttributes(
        metadata.attributes.map((att, index) => ({
            id: att.name,
            name: att.name,
            selected: index === 0,
        })),
    );

    if (metadata.attributes.length > 0) {
        options.attribute = metadata.attributes[0].name;
        entity.setActiveAttribute(metadata.attributes[0].name);
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

    bindToggle('show-dataset', show => {
        entity.visible = show;
        instance.notifyChange(entity);
    });

    populateGUI(entity);

    updateActiveAttribute();

    Inspector.attach('inspector', instance);
    StatusBar.bind(instance, { disableUrlUpdate: true });
}

const defaultUrl = 'https://3d.oslandia.com/potree/pointclouds/lion_takanawa/cloud.js';

// Extract dataset URL from URL
const url = new URL(document.URL);
let datasetUrl = url.searchParams.get('dataset');
if (!datasetUrl) {
    datasetUrl = defaultUrl;
    url.searchParams.append('dataset', datasetUrl);
    window.history.replaceState({}, null, url.toString());
}

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
