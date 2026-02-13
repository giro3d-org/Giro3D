/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Feature } from 'ol';
import { LineString, Point, Polygon } from 'ol/geom.js';
import { Circle, Fill, Stroke, Style } from 'ol/style.js';
import { Color, MathUtils } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import { bindButton } from './widgets/bindButton.js';
import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const extent = Extent.fromCenterAndSize(
    CoordinateSystem.epsg3857,
    { x: 11393552, y: 44035 },
    1000000,
    500000,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 'white',
});

const center = extent.centerAsVector3();
instance.view.camera.position.set(center.x, center.y - 1, 1000000);

const controls = new MapControls(instance.view.camera, instance.domElement);

controls.target = center;
controls.saveState();

instance.view.setControls(controls);

const map = new Map({ extent });
instance.add(map);

const fillColor = new Color('orange');
const strokeColor = new Color('red');

const image = new Circle({
    radius: 20,
    fill: new Fill({
        color: `#${fillColor.getHexString()}`,
    }),
    stroke: new Stroke({
        color: `#${strokeColor.getHexString()}`,
        width: 5,
    }),
});

const fill = new Fill({
    color: `#${fillColor.getHexString()}`,
});

const stroke = new Stroke({
    color: `#${strokeColor.getHexString()}`,
    width: 5,
});

let style = new Style({
    fill,
    stroke,
    image,
});

const polygon = new Feature(
    new Polygon([
        [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0],
        ],
    ]).transform('EPSG:4326', 'EPSG:3857'),
);

const line = new Feature(
    new LineString([
        [102.0, 0.0],
        [103.0, 1.0],
        [104.0, 0.0],
        [105.0, 1.0],
    ]).transform('EPSG:4326', 'EPSG:3857'),
);

const point = new Feature(new Point([102.0, 0.5]).transform('EPSG:4326', 'EPSG:3857'));

const source = new VectorSource({
    data: [],
    dataProjection: CoordinateSystem.epsg3857,
    style,
});

const layer = new ColorLayer({ source });

map.addLayer(layer);

StatusBar.bind(instance);

Inspector.attach('inspector', instance);

instance.notifyChange(map);

source.addFeatures([point, line, polygon]);

const [setStrokeWidth] = bindSlider('stroke-width', v => {
    style.getStroke().setWidth(v);

    const circle = /** @type {Circle} */ (style.getImage());

    circle.getStroke().setWidth(v);
    circle.setRadius(circle.getRadius());
    source.update();
});
const [setPointRadius] = bindSlider('point-radius', v => {
    const circle = /** @type {Circle} */ (style.getImage());

    circle.setRadius(v);
    style.setImage(style.getImage());
    source.update();
});

const toCssColor = (color, alpha) =>
    `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;

const [setOpacity] = bindSlider('style-opacity', v => {
    const circle = /** @type {Circle} */ (style.getImage());

    circle.getStroke().setColor(toCssColor(strokeColor, v));
    circle.getFill().setColor(toCssColor(fillColor, v));

    style.getStroke().setColor(toCssColor(strokeColor, v));
    style.getFill().setColor(toCssColor(fillColor, v));

    circle.setRadius(circle.getRadius());

    source.update();
});

bindToggle('show-line', v => {
    if (v) {
        source.addFeature(line);
    } else {
        source.removeFeature(line);
    }
    source.update();
});
bindToggle('show-polygon', v => {
    if (v) {
        source.addFeature(polygon);
    } else {
        source.removeFeature(polygon);
    }
    source.update();
});
bindToggle('show-point', v => {
    if (v) {
        source.addFeature(point);
    } else {
        source.removeFeature(point);
    }
    source.update();
});

bindButton('randomize', () => {
    strokeColor.r = MathUtils.randFloat(0, 1);
    strokeColor.g = MathUtils.randFloat(0, 1);
    strokeColor.b = MathUtils.randFloat(0, 1);

    fillColor.r = MathUtils.randFloat(0, 1);
    fillColor.g = MathUtils.randFloat(0, 1);
    fillColor.b = MathUtils.randFloat(0, 1);

    const pointRadius = MathUtils.randFloat(0.1, 20);
    const strokeWidth = MathUtils.randFloat(1, 20);
    const opacity = MathUtils.randFloat(0, 1);

    const newStyle = new Style({
        fill: new Fill({
            color: toCssColor(fillColor, opacity),
        }),
        stroke: new Stroke({
            color: toCssColor(strokeColor, opacity),
            width: strokeWidth,
        }),
        image: new Circle({
            radius: pointRadius,
            fill: new Fill({
                color: toCssColor(fillColor, opacity),
            }),
            stroke: new Stroke({
                color: toCssColor(strokeColor, opacity),
                width: strokeWidth,
            }),
        }),
    });

    setPointRadius(pointRadius);
    setStrokeWidth(strokeWidth);
    setOpacity(opacity);

    style = newStyle;

    // Here we test that setStyle() takes the new style into account
    // and that the layer is repainted.
    source.setStyle(newStyle);
});
