import { Color, DoubleSide, MathUtils, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import DrawTool, {
    afterRemovePointOfRing,
    afterUpdatePointOfRing,
    inhibitHook,
    limitRemovePointHook,
} from '@giro3d/giro3d/interactions/DrawTool.js';
import Shape, {
    DEFAULT_SURFACE_OPACITY,
    angleSegmentFormatter,
    isShapePickResult,
    slopeSegmentFormatter,
} from '@giro3d/giro3d/entities/Shape.js';
import Fetcher from '@giro3d/giro3d/utils/Fetcher.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

import { bindButton } from './widgets/bindButton.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindDropDown } from './widgets/bindDropDown.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:2154',
    backgroundColor: null,
});

const extent = Extent.fromCenterAndSize('EPSG:2154', { x: 972_027, y: 6_299_491 }, 10_000, 10_000);

const map = new Map({
    extent,
    backgroundColor: 'gray',
    hillshading: {
        enabled: true,
        intensity: 0.6,
        elevationLayersOnly: true,
    },
    side: DoubleSide,
});
instance.add(map);

const noDataValue = -1000;

const capabilitiesUrl =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue,
})
    .then(source => {
        map.addLayer(
            new ElevationLayer({
                extent: map.extent,
                preloadImages: true,
                resolutionFactor: 0.5,
                minmax: { min: 500, max: 1500 },
                source: source,
            }),
        );
    })
    .catch(console.error);

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(source => {
        map.addLayer(
            new ColorLayer({
                preloadImages: true,
                extent: map.extent,
                source: source,
            }),
        );
    })
    .catch(console.error);

const center = extent.centerAsVector2();
instance.view.camera.position.set(center.x - 1000, center.y - 1000, 3000);
const lookAt = new Vector3(center.x, center.y, 200);
instance.view.camera.lookAt(lookAt);
instance.notifyChange(instance.view.camera);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.copy(lookAt);
controls.saveState();
instance.view.setControls(controls);

/** @type {Shape[]} */
const shapes = [];

const options = {
    lineWidth: 2,
    borderWidth: 1,
    vertexRadius: 4,
    color: '#2978b4',
    areaUnit: 'm',
    lengthUnit: 'm',
    slopeUnit: 'deg',
    surfaceOpacity: DEFAULT_SURFACE_OPACITY,
};

const tool = new DrawTool({ instance });

let abortController;

document.addEventListener('keydown', e => {
    switch (e.key) {
        case 'Escape':
            try {
                abortController.abort();
            } catch {
                console.log('aborted');
            }
            break;
    }
});

function vertexLabelFormatter({ position }) {
    const latlon = new Coordinates(instance.referenceCrs, position.x, position.y).as('EPSG:4326');

    return `lat: ${latlon.latitude.toFixed(5)}°, lon: ${latlon.longitude.toFixed(5)}°`;
}

const exportButton = bindButton('export', () => {
    const featureCollection = {
        type: 'FeatureCollection',
        features: shapes.map(m => m.toGeoJSON()),
    };

    const text = JSON.stringify(featureCollection, null, 2);

    const blob = new Blob([text], { type: 'application/geo+json' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.download = `shapes.geojson`;
    link.href = url;
    link.click();
});

const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
});

const slopeFormatter = opts => {
    switch (options.slopeUnit) {
        case 'deg':
            return angleSegmentFormatter(opts);
        case 'pct':
            return slopeSegmentFormatter(opts);
    }
};

const surfaceLabelFormatter = ({ area }) => {
    switch (options.areaUnit) {
        case 'm': {
            if (area > 1_000_000) {
                return `${numberFormat.format(area / 1_000_000)} km²`;
            }
            return `${numberFormat.format(Math.round(area))} m²`;
        }
        case 'ha':
            return `${numberFormat.format(area / 10000)} ha`;
        case 'acre':
            return `${numberFormat.format(area / 4_046.8564224)} acres`;
    }
};

const lengthFormatter = ({ length }) => {
    switch (options.lengthUnit) {
        case 'm':
            return `${numberFormat.format(Math.round(length))} m`;
        case 'ft':
            return `${numberFormat.format(Math.round(length * 3.28084))} ft`;
    }
};

// Overrides the default formatter for vertical lines
const verticalLineLabelFormatter = ({ vertexIndex, length }) => {
    if (vertexIndex === 0) {
        return null;
    }

    switch (options.lengthUnit) {
        case 'm':
            return `${numberFormat.format(Math.round(length))} m`;
        case 'ft':
            return `${numberFormat.format(Math.round(length * 3.28084))} ft`;
    }
};

function fromGeoJSON(feature) {
    if (feature.type !== 'Feature') {
        throw new Error('not a valid GeoJSON feature');
    }

    const crs = 'EPSG:4326';

    const getPoint = c => {
        const coord = new Coordinates(crs, c[0], c[1], c[2] ?? 0);
        return coord.as(instance.referenceCrs, coord).toVector3();
    };

    const uuid = MathUtils.generateUUID();
    let result;

    switch (feature.geometry.type) {
        case 'Point':
            result = new Shape({
                showVertexLabels: true,
                showLine: false,
                showVertices: true,
                beforeRemovePoint: inhibitHook,
                vertexLabelFormatter,
            });
            result.setPoints([getPoint(feature.geometry.coordinates)]);
            break;
        case 'MultiPoint':
            result = new Shape({
                showVertexLabels: true,
                showLine: false,
                showVertices: true,
                beforeRemovePoint: limitRemovePointHook(1),
                vertexLabelFormatter,
            });
            result.setPoints(feature.geometry.coordinates.map(getPoint));
            break;
        case 'LineString':
            result = new Shape({
                showVertexLabels: false,
                showLine: true,
                showVertices: true,
                showSegmentLabels: true,
                segmentLabelFormatter: lengthFormatter,
                beforeRemovePoint: limitRemovePointHook(2),
            });
            result.setPoints(feature.geometry.coordinates.map(getPoint));
            break;
        case 'Polygon':
            result = new Shape({
                showVertexLabels: false,
                showLine: true,
                showVertices: true,
                showSurface: true,
                showSurfaceLabel: true,
                surfaceLabelFormatter,
                beforeRemovePoint: limitRemovePointHook(4), // We take into account the doubled first/last point
                afterRemovePoint: afterRemovePointOfRing,
                afterUpdatePoint: afterUpdatePointOfRing,
            });
            result.setPoints(feature.geometry.coordinates[0].map(getPoint));
            break;
    }

    return result;
}

const removeShapesButton = bindButton('remove-shapes', () => {
    shapes.forEach(m => instance.remove(m));
    shapes.length = 0;
    removeShapesButton.disabled = true;
    exportButton.disabled = true;
    instance.notifyChange();
});

function importGeoJSONFile(json) {
    for (const feature of json.features) {
        const shape = fromGeoJSON(feature);
        instance.add(shape);
        shapes.push(shape);
    }

    if (shapes.length > 0) {
        removeShapesButton.disabled = false;
        exportButton.disabled = false;
    }
    instance.notifyChange();
}

Fetcher.json('data/default-shapes.geojson').then(json => {
    importGeoJSONFile(json);
});

bindButton('import', () => {
    const input = document.createElement('input');
    input.type = 'file';

    input.onchange = () => {
        const file = input.files[0];

        const reader = new FileReader();
        reader.readAsText(file);

        reader.onload = readerEvent => {
            const text = readerEvent.target.result;
            // @ts-expect-error typing
            const json = JSON.parse(text);
            importGeoJSONFile(json);
        };
    };

    input.click();
});

function disableDrawButtons(disabled) {
    const group = document.getElementById('draw-group');
    const buttons = group.getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
        const button = buttons.item(i);
        button.disabled = disabled;
    }
}

/**
 * @param {HTMLButtonElement} button - TTh
 * @param {*} callback
 * @param {*} specificOptions
 */
function createShape(button, callback, specificOptions) {
    disableDrawButtons(true);

    button.classList.remove('btn-primary');
    button.classList.add('btn-secondary');

    abortController = new AbortController();

    callback
        .bind(tool)({
            signal: abortController.signal,
            ...options,
            ...specificOptions,
            onTemporaryPointMoved: () => console.log('onTemporaryPointMoved'),
        })
        .then(shape => {
            if (shape) {
                shapes.push(shape);
                removeShapesButton.disabled = false;
                exportButton.disabled = false;
            }
        })
        .catch(e => {
            if (e.message !== 'aborted') {
                console.log(e);
            }
        })
        .finally(() => {
            disableDrawButtons(false);
            button.classList.add('btn-primary');
            button.classList.remove('btn-secondary');
        });
}

bindButton('point', button => {
    createShape(button, tool.createPoint, {
        showVertexLabels: true,
        vertexLabelFormatter,
    });
});
bindButton('multipoint', button => {
    createShape(button, tool.createMultiPoint, {
        showVertexLabels: true,
        vertexLabelFormatter,
    });
});
bindButton('segment', button => {
    createShape(button, tool.createSegment, {
        segmentLabelFormatter: lengthFormatter,
        showSegmentLabels: true,
    });
});
bindButton('linestring', button => {
    createShape(button, tool.createLineString, {
        segmentLabelFormatter: lengthFormatter,
        showSegmentLabels: true,
    });
});
bindButton('ring', button => {
    createShape(button, tool.createRing, {
        showLineLabel: true,
        lineLabelFormatter: lengthFormatter,
    });
});
bindButton('polygon', button => {
    createShape(button, tool.createPolygon, {
        surfaceLabelFormatter,
        showSurfaceLabel: true,
    });
});
bindDropDown('area-unit', v => {
    options.areaUnit = v;
    shapes.forEach(shape => shape.rebuildLabels());
});
bindDropDown('length-unit', v => {
    options.lengthUnit = v;
    shapes.forEach(shape => shape.rebuildLabels());
});
bindDropDown('slope-unit', v => {
    options.slopeUnit = v;
    shapes.forEach(shape => shape.rebuildLabels());
});
bindButton('vertical-measurement', button => {
    createShape(button, tool.createVerticalMeasure, {
        verticalLineLabelFormatter: verticalLineLabelFormatter,
        segmentLabelFormatter: slopeFormatter,
    });
});
bindButton('angle-measurement', button => {
    createShape(button, tool.createSector);
});
bindSlider('point-radius', v => {
    options.vertexRadius = v;
    shapes.forEach(m => {
        m.vertexRadius = v;
    });
});
bindSlider('line-width', v => {
    options.lineWidth = v;
    shapes.forEach(m => {
        m.lineWidth = v;
    });
});
bindSlider('border-width', v => {
    options.borderWidth = v;
    shapes.forEach(m => {
        m.borderWidth = v;
    });
});
bindSlider('surface-opacity', v => {
    options.surfaceOpacity = v;
    shapes.forEach(m => {
        m.surfaceOpacity = v;
    });
});
bindColorPicker('color', v => {
    // @ts-expect-error conversion
    options.color = v;
    shapes.forEach(m => {
        m.color = v;
    });
});

function pickShape(mouseEvent) {
    const pickResults = instance.pickObjectsAt(mouseEvent, { where: shapes });
    const first = pickResults[0];
    if (isShapePickResult(first)) {
        return first.entity;
    }

    return null;
}

let isEditModeActive = false;
let highlightHoveredShape = false;
let editedShape = null;

const editButton = bindButton('edit-clicked-shape', () => {
    highlightHoveredShape = true;
    editButton.disabled = true;

    const onclick = (/** @type {MouseEvent} */ mouseEvent) => {
        if (mouseEvent.button === 0) {
            instance.domElement.removeEventListener('click', onclick);
            const shape = pickShape(mouseEvent);

            if (shape) {
                editedShape = shape;
                isEditModeActive = true;
                highlightHoveredShape = false;

                shape.color = 'yellow';

                tool.enterEditMode({
                    shapesToEdit: [shape],
                    onPointInserted: arg => console.log('onPointInserted', arg),
                    onPointUpdated: arg => console.log('onPointMoved', arg),
                    onPointRemoved: arg => console.log('onPointRemoved', arg),
                });
            }
        }
    };

    const onrightlick = () => {
        editButton.disabled = false;
        tool.exitEditMode();
        isEditModeActive = false;
        if (editedShape) {
            editedShape.color = options.color;
            editedShape = null;
        }
        instance.domElement.removeEventListener('contextmenu', onrightlick);
    };

    instance.domElement.addEventListener('click', onclick);
    instance.domElement.addEventListener('contextmenu', onrightlick);
});

function mousemove(mouseEvent) {
    if (shapes.length === 0) {
        return;
    }

    for (const shape of shapes) {
        shape.labelOpacity = 1;
    }

    if (isEditModeActive || highlightHoveredShape) {
        const shape = pickShape(mouseEvent);

        if (shape) {
            if (isEditModeActive && shape === editedShape) {
                // Dim labels so the user can properly insert vertices on segments.
                shape.labelOpacity = 0.5;
            }
            if (highlightHoveredShape) {
                shape.color = new Color(options.color).offsetHSL(0, 0, 0.2);
            }
        }
    }
}

instance.domElement.addEventListener('mousemove', mousemove);

// We want to prevent moving the camera while dragging a point
tool.addEventListener('start-drag', () => {
    controls.enabled = false;
});
tool.addEventListener('end-drag', () => {
    controls.enabled = true;
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
