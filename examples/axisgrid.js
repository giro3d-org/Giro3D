import colormap from 'colormap';

import { Color, DoubleSide } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import XYZ from 'ol/source/XYZ.js';

import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import AxisGrid, { TickOrigin } from '@giro3d/giro3d/entities/AxisGrid.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import GeoTIFFFormat from '@giro3d/giro3d/formats/GeoTIFFFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const x = -13602000;
const y = 5812000;
const halfWidth = 2500;

const extent = new Extent(
    CoordinateSystem.epsg3857,
    x - halfWidth,
    x + halfWidth,
    y - halfWidth,
    y + halfWidth,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
});

const map = new Map({
    extent,
    lighting: true,
    discardNoData: true,
    side: DoubleSide,
    backgroundColor: 'white',
});

const params = {
    useCustomCss: false,
};

instance.add(map);

const source = new TiledImageSource({
    source: new XYZ({
        minZoom: 10,
        maxZoom: 16,
        url: 'https://3d.oslandia.com/dem/MtStHelens-tiles/{z}/{x}/{y}.tif',
    }),
    format: new GeoTIFFFormat(),
});

const floor = 1100;
const ceiling = 2500;

const values = colormap({ colormap: 'viridis', nshades: 256 });
const colors = values.map(v => new Color(v));

const dem = new ElevationLayer({
    name: 'dem',
    extent,
    interpretation: Interpretation.Raw,
    source,
    colorMap: new ColorMap({ colors, min: floor, max: ceiling, mode: ColorMapMode.Elevation }),
});

map.addLayer(dem);

// Create an axis grid that encompasses the Map.
const axisGrid = new AxisGrid({
    volume: {
        extent: extent.withRelativeMargin(0.1),
        floor,
        ceiling,
    },
    ticks: {
        x: 1000,
        y: 1000,
        z: 200,
    },
});

/**
 * @param {object} param0
 * @param {HTMLSpanElement} param0.label - The label element.
 */
const onLabelCreated = ({ label }) => {
    if (params.useCustomCss) {
        label.classList.add('badge');
        label.classList.add('rounded-pill');
        label.classList.add('text-bg-light');
    }
};

// Let's customize the labels with bootstrap classes
// In you own application, you can use your own CSS classes of courses
axisGrid.addEventListener('label-created', onLabelCreated);

instance.add(axisGrid);

instance.view.camera.position.set(-13594700, 5819700, 7300);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target.set(-13603000, 5811000, 0);
instance.view.setControls(controls);

function bindAxisStep(axis) {
    bindSlider(`${axis}-axis-step`, v => {
        axisGrid.ticks[axis] = v;
        axisGrid.refresh();
        instance.notifyChange(axisGrid);
    });
}

bindAxisStep('x');
bindAxisStep('y');
bindAxisStep('z');

bindColorPicker('color', color => {
    axisGrid.color = color;
    instance.notifyChange(axisGrid);
});

bindToggle('entity', v => {
    axisGrid.visible = v;
    instance.notifyChange(axisGrid);
});
bindToggle('origin', v => {
    axisGrid.origin = v ? TickOrigin.Relative : TickOrigin.Absolute;
    axisGrid.refresh();
    instance.notifyChange(axisGrid);
});
bindToggle('ceiling', v => {
    axisGrid.showCeilingGrid = v;
    instance.notifyChange(axisGrid);
});
bindToggle('floor', v => {
    axisGrid.showFloorGrid = v;
    instance.notifyChange(axisGrid);
});
bindToggle('sides', v => {
    axisGrid.showSideGrids = v;
    instance.notifyChange(axisGrid);
});
bindToggle('adaptive-labels', v => {
    axisGrid.adaptiveLabels = v;
    instance.notifyChange(axisGrid);
});
bindToggle('custom-css', v => {
    params.useCustomCss = v;
    axisGrid.refresh();
    instance.notifyChange(axisGrid);
});

document.getElementById('randomize-position').onclick = () => {
    const current = axisGrid.volume.extent;
    const dims = current.dimensions();
    const center = current.centerAsVector3();
    const range = 5000;
    center.set(
        center.x + (Math.random() - 0.5) * range,
        center.y + (Math.random() - 0.5) * range,
        0,
    );
    const newExtent = new Extent(
        current.crs,
        center.x - dims.x / 2,
        center.x + dims.x / 2,
        center.y - dims.y / 2,
        center.y + dims.y / 2,
    );

    axisGrid.volume.extent = newExtent;
    axisGrid.refresh();
    instance.notifyChange(axisGrid);
};

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
