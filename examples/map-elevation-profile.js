/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import * as ChartJS from 'chart.js';
import { CurvePath, DoubleSide, LineCurve, Vector2, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Shape from '@giro3d/giro3d/entities/Shape.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import DrawTool from '@giro3d/giro3d/interactions/DrawTool.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import { bindButton } from './widgets/bindButton.js';
import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const epsg2154 = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
CoordinateSystem.register(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const extent = Extent.fromCenterAndSize(epsg2154, { x: 674_675, y: 6_442_569 }, 30_000, 30_000);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
});

const map = new Map({
    extent,
    lighting: {
        enabled: true,
        elevationLayersOnly: true,
    },
    side: DoubleSide,
    backgroundColor: 'white',
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
                extent: map.extent,
                minmax: { min: 0, max: 5000 },
                noDataOptions: {
                    replaceNoData: false,
                },
                colorMap: new ColorMap({
                    colors: makeColorRamp('bathymetry'),
                    min: 500,
                    max: 1800,
                }),
                source: elevationWmts,
            }),
        );
    })
    .catch(console.error);

let colorLayer;

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        colorLayer = new ColorLayer({
            extent: map.extent,
            source: orthophotoWmts,
        });

        map.addLayer(colorLayer);
    })
    .catch(console.error);

const center = extent.centerAsVector2();

instance.view.camera.position.set(center.x - 4000, center.y - 4000, 7300);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target.set(center.x, center.y, 300);
instance.view.setControls(controls);

// We use the DrawTool to draw the path on the map.
const measureTool = new DrawTool({ instance });

// The 3D line that will follow the elevation profile
const measure = new Shape({
    name: 'profile',
    showVertices: false,
    showLine: true,
    vertexRadius: 3,
});
measure.renderOrder = 10;

instance.add(measure);

function updateMarkers(points) {
    measure.setPoints(points);
}

let currentChart;

/** @type {HTMLCanvasElement} */
// @ts-expect-error conversion
const canvas = document.getElementById('profileChart');
const chartContainer = document.getElementById('chartContainer');

const canvasHeight = canvas.clientHeight;
const canvasWidth = canvas.clientWidth;

function updateProfileChart(points) {
    ChartJS.Chart.register(
        ChartJS.LinearScale,
        ChartJS.LineController,
        ChartJS.PointElement,
        ChartJS.LineElement,
        ChartJS.Title,
        ChartJS.Legend,
        ChartJS.Filler,
    );

    const data = [];
    let distance = 0;

    // Let's process our datapoints.
    // On the X axis, we will have the horizontal distance along the curve.
    // On the Y axis, we will have the elevations.
    for (let i = 0; i < points.length; i++) {
        const pt = points[i];

        if (i > 0) {
            const prev = new Vector2(points[i - 1].x, points[i - 1].y);
            const curr = new Vector2(points[i].x, points[i].y);

            distance += Math.round(curr.distanceTo(prev));
        }

        data.push({ x: distance, y: pt.z });
    }

    const dataset = {
        label: 'Profile',
        data,
        fill: true,
        borderWidth: 3,
        pointRadius: 0,
        backgroundColor: '#2978b430',
        borderColor: '#2978b480',
        yAxisID: 'y',
    };

    currentChart?.destroy();

    // Let's build our elevation profile chart.
    const chart = new ChartJS.Chart(canvas, {
        type: 'line',
        data: {
            datasets: [dataset],
        },
        options: {
            parsing: false,
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: canvasWidth / canvasHeight,
            plugins: {
                legend: {
                    display: false,
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: 'Elevation profile',
                },
            },
            scales: {
                x: {
                    display: true,
                    bounds: 'data',
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'horizontal distance (meters)',
                    },
                },
                y: {
                    bounds: 'ticks',
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'elevation (meters)',
                    },
                },
            },
        },
    });

    currentChart = chart;

    chartContainer.style.display = 'block';
}

function computeElevationProfile() {
    // We first start by drawing a LineString on the map.
    return measureTool.createLineString().then(lineString => {
        if (lineString == null) {
            return;
        }

        const start = performance.now();

        // Then we need to sample this line according to the number of samples
        // selected by the user. We are using a THREE.js CurvePath for that.
        /** @type {CurvePath<Vector2>} */
        const path = new CurvePath();

        const vertices = lineString.points;

        // For each pair of coordinates, we create a linearly interpolated curve
        for (let i = 0; i < vertices.length - 1; i++) {
            const v0 = vertices[i];
            const v1 = vertices[i + 1];

            const line = new LineCurve(new Vector2(v0.x, v0.y), new Vector2(v1.x, v1.y));

            path.add(line);
        }

        // And then we sample this curve to have our evenly spaced points
        // @ts-expect-error conversion
        const sampleCount = document.getElementById('sampleCount').valueAsNumber;
        const points = path.getSpacedPoints(sampleCount - 1);

        const chartPoints = [];

        for (const point of points) {
            const coordinates = new Coordinates(extent.crs, point.x, point.y, 0);

            // Get the elevation for our current coordinate
            const result = map.getElevation({ coordinates });

            // Elevation sampling can return zero or more samples:
            // - Zero sample happens if the coordinate is outside the map's extent
            //   or if no data has been loaded yet.
            // - More than one sample happens because the samples are taken from map tiles, and
            //   they are organized in a hierarchical grid, where parent tiles overlap their children.
            if (result.samples.length > 0) {
                // Let's sort the samples to get the highest resolution sample first
                result.samples.sort((a, b) => a.resolution - b.resolution);

                const elevation = result.samples[0].elevation;

                // Let's populate or list of data points.
                chartPoints.push(new Vector3(point.x, point.y, elevation));
            }
        }

        updateMarkers(chartPoints);
        updateProfileChart(chartPoints);

        // Remove the temporary line
        instance.remove(lineString);

        instance.notifyChange();

        const end = performance.now();
        console.log(`elapsed: ${(end - start).toFixed(1)} ms`);
    });
}

bindButton('start', button => {
    button.disabled = true;

    computeElevationProfile().then(() => {
        button.disabled = false;
    });
});
bindButton('closeChart', () => {
    chartContainer.style.display = 'none';
});

Inspector.attach('inspector', instance);
StatusBar.bind(instance);

const parameters = {
    showLineLabel: false,
};

bindToggle('showLength', v => {
    parameters.showLineLabel = v;
    measure.showLineLabel = v;
});
bindToggle('showColorLayer', v => {
    colorLayer.visible = v;
    instance.notifyChange(map);
});

const hoveredPoint = new Shape({
    name: 'hovered-point',
    vertexRadius: 6,
    showVertexLabels: true,
    vertexLabelFormatter: ({ position }) => {
        return `${position.z.toFixed(0)}m`;
    },
});
hoveredPoint.setPoints([new Vector3()]);
hoveredPoint.renderOrder = measure.renderOrder + 2;
hoveredPoint.color = measure.color;
hoveredPoint.visible = false;

const markerHtmlElement = document.createElement('div');
markerHtmlElement.style.paddingBottom = '4rem';
const span = document.createElement('span');
span.classList.value = 'badge rounded-pill text-bg-primary';
span.innerText = '?';
markerHtmlElement.appendChild(span);

const hoveredLabel = new CSS2DObject(markerHtmlElement);

hoveredPoint.object3d.add(hoveredLabel);

instance.add(hoveredPoint);

function pick(ev) {
    const pickedList = instance.pickObjectsAt(ev);
    hoveredPoint.visible = false;
    hoveredLabel.visible = false;

    measure.showLineLabel = parameters.showLineLabel;

    if (pickedList && pickedList.length > 0) {
        for (const picked of pickedList) {
            if (picked.entity === measure) {
                measure.showLineLabel = false;

                const { point } = measure.getClosestPointOnLine(picked.point);

                hoveredPoint.updatePoint(0, point);

                hoveredPoint.visible = true;
                hoveredLabel.visible = true;

                break;
            }
        }
    }

    instance.notifyChange();
}

instance.domElement.addEventListener('mousemove', pick);
