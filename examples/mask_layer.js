import XYZ from 'ol/source/XYZ.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import { GeoJSON } from 'ol/format.js';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import MaskLayer, { MaskMode } from '@giro3d/giro3d/core/layer/MaskLayer.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import StatusBar from './widgets/StatusBar.js';
import { bindNumericalDropDown } from './widgets/bindNumericalDropDown.js';

const extent = Extent.fromCenterAndSize('EPSG:3857', { x: 260000, y: 6251379 }, 32000, 32000);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: null,
});

const apiKey =
    'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ';

const map = new Map({ extent });

instance.add(map);

// Adds a satellite basemap
const basemap = new ColorLayer({
    name: 'basemap',
    extent,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${apiKey}`,
            projection: extent.crs,
            crossOrigin: 'anonymous',
        }),
    }),
});

map.addLayer(basemap);

const outlineStyle = new Style({
    stroke: new Stroke({ color: 'red', width: 2 }),
});

// Display the footprint using a red outline. This layer is not necessary for the mask to work,
// and is only present for illustration purposes.
const outline = new ColorLayer({
    name: 'outline',
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/giro3d/vectors/paris.geojson',
            format: new GeoJSON(),
        },
        style: outlineStyle,
    }),
});

map.addLayer(outline);

// The mask layer uses an opaque fill style.
const maskStyle = new Style({
    fill: new Fill({ color: 'white' }),
});

// Create the actual mask layer with the same source as the outline.
const mask = new MaskLayer({
    name: 'mask',
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/giro3d/vectors/paris.geojson',
            format: new GeoJSON(),
        },
        style: maskStyle,
    }),
});

map.addLayer(mask);

const center = extent.centerAsVector3();
instance.view.camera.position.set(center.x, center.y - 1, 40000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = center;
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

bindNumericalDropDown('layerState', newMode => {
    switch (newMode) {
        case 1:
            mask.visible = true;
            mask.maskMode = MaskMode.Normal;
            break;
        case 2:
            mask.visible = true;
            mask.maskMode = MaskMode.Inverted;
            break;
        default:
            mask.visible = false;
            break;
    }

    instance.notifyChange(map);
});
