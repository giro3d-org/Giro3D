import { Color, MathUtils, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import { ColorLayer } from '@giro3d/giro3d/core/layer/index.js';
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
    slopeSegmentFormatter,
} from '@giro3d/giro3d/entities/Shape.js';
import Fetcher from '@giro3d/giro3d/utils/Fetcher.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

import { bindButton } from './widgets/bindButton.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindColorPicker } from './widgets/bindColorPicker.js';
import { bindDropDown } from './widgets/bindDropDown.js';

// Defines projection that we will use (taken from https://epsg.io/2154, Proj4js section)
Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const viewerDiv = document.getElementById('viewerDiv');
const instance = new Instance(viewerDiv, {
    crs: 'EPSG:2154',
    renderer: {
        clearColor: false,
    },
});

// create a map
const extent = Extent.fromCenterAndSize('EPSG:2154', { x: 972_027, y: 6_299_491 }, 10_000, 10_000);

const map = new Map('planar', {
    extent,
    backgroundColor: 'gray',
    hillshading: {
        enabled: true,
        intensity: 0.6,
        elevationLayersOnly: true,
    },
    doubleSided: true,
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
    .then(elevationWmts => {
        map.addLayer(
            new ElevationLayer({
                name: 'wmts_elevation',
                extent: map.extent,
                resolutionFactor: 1,
                minmax: { min: 500, max: 1500 },
                noDataOptions: {
                    replaceNoData: false,
                },
                source: elevationWmts,
            }),
        );
    })
    .catch(console.error);

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        map.addLayer(
            new ColorLayer({
                extent: map.extent,
                source: orthophotoWmts,
            }),
        );
    })
    .catch(console.error);

const center = extent.centerAsVector2();
instance.camera.camera3D.position.set(center.x - 1000, center.y - 1000, 3000);
const lookAt = new Vector3(center.x, center.y, 200);
instance.camera.camera3D.lookAt(lookAt);
instance.notifyChange(instance.camera.camera3D);

// Creates controls
const controls = new MapControls(instance.camera.camera3D, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.copy(lookAt);
controls.saveState();

instance.useTHREEControls(controls);

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

const tool = new DrawTool({
    instance,
    hoverColor: options.highlightColor,
    dragColor: options.dragColor,
});

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
            result = new Shape(uuid, {
                showVertexLabels: true,
                showLine: false,
                showVertices: true,
                beforeRemovePoint: inhibitHook,
                vertexLabelFormatter,
            });
            result.setPoints([getPoint(feature.geometry.coordinates)]);
            break;
        case 'MultiPoint':
            result = new Shape(uuid, {
                showVertexLabels: true,
                showLine: false,
                showVertices: true,
                beforeRemovePoint: limitRemovePointHook(1),
                vertexLabelFormatter,
            });
            result.setPoints(feature.geometry.coordinates.map(getPoint));
            break;
        case 'LineString':
            result = new Shape(uuid, {
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
            result = new Shape(uuid, {
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

    input.onchange = e => {
        const file = e.target.files[0];

        const reader = new FileReader();
        reader.readAsText(file);

        reader.onload = readerEvent => {
            const text = readerEvent.target.result;
            const json = JSON.parse(text);
            importGeoJSONFile(json);
        };
    };

    input.click();
});

let isCurrentlyDrawing = false;

function disableDrawButtons(disabled) {
    const group = document.getElementById('draw-group');
    const buttons = group.getElementsByTagName('button');
    for (const button of buttons) {
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

    isCurrentlyDrawing = true;

    callback
        .bind(tool)({
            signal: abortController.signal,
            ...options,
            ...specificOptions,
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
            isCurrentlyDrawing = false;
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
    options.color = v;
    shapes.forEach(m => {
        m.color = v;
    });
});

function dimLabels(mouseEvent) {
    if (shapes.length === 0) {
        return;
    }

    const pickResults = instance.pickObjectsAt(mouseEvent, { where: shapes });

    for (const shape of shapes) {
        shape.labelOpacity = 1;
    }

    if (pickResults.length > 0) {
        const picked = pickResults[0];
        const shape = picked.entity;

        // Dim labels so the user can properly insert vertices on segments.
        shape.labelOpacity = 0.5;
    }
}

instance.domElement.addEventListener('mousemove', dimLabels);

// We allow editing existing shapes
tool.enterEditMode();

// We want to prevent moving the camera while dragging a point
tool.addEventListener('start-drag', () => {
    controls.enabled = false;
});
tool.addEventListener('end-drag', () => {
    controls.enabled = true;
});

Inspector.attach(document.getElementById('panelDiv'), instance);

StatusBar.bind(instance);
