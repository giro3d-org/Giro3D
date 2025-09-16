/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import { MapLightingMode } from '@giro3d/giro3d/entities/MapLightingOptions.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import { bindSlider } from './widgets/bindSlider.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const extent = new Extent(
    CoordinateSystem.fromEpsg(3946),
    1837816.94334,
    1847692.32501,
    5170036.4587,
    5178412.82698,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

const map = new Map({
    extent,
    // Enables hillshading on this map
    lighting: {
        enabled: true,
        mode: MapLightingMode.Hillshade,
    },
    backgroundColor: 'white',
});
instance.add(map);

const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

const noDataValue = -1000;

/** @type {ColorLayer} */
let colorLayer;

// Let's build the elevation layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue,
})
    .then(elevationWmts => {
        map.addLayer(
            new ElevationLayer({
                name: 'elevation',
                extent: map.extent,
                minmax: { min: 100, max: 300 },
                source: elevationWmts,
            }),
        );
    })
    .catch(console.error);

// Let's build the color layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        colorLayer = new ColorLayer({
            name: 'color',
            extent: map.extent.split(2, 1)[0],
            source: orthophotoWmts,
        });
        map.addLayer(colorLayer);
    })
    .catch(console.error);

const mapCenter = extent.centerAsVector3();

instance.view.camera.position.set(mapCenter.x, mapCenter.y - 1, 10000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = mapCenter;
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

// Example GUI

const [, , colorLayersToggle] = bindToggle('colorLayers', state => {
    map.lighting.elevationLayersOnly = !state;
    instance.notifyChange(map);
});

const [, , azimuthSlider] = bindSlider('azimuth', azimuth => {
    map.lighting.hillshadeAzimuth = azimuth;
    instance.notifyChange(map);
});

const [, , zenithSlider] = bindSlider('zenith', zenith => {
    map.lighting.hillshadeZenith = zenith;
    instance.notifyChange(map);
});

bindToggle('enabled', state => {
    map.lighting.enabled = state;
    instance.notifyChange(map);

    colorLayersToggle.disabled = !state;
    azimuthSlider.disabled = !state;
    zenithSlider.disabled = !state;
});

const [, , opacitySlider] = bindSlider('opacity', percentage => {
    const opacity = percentage / 100.0;
    colorLayer.opacity = opacity;
    instance.notifyChange(map);
    opacitySlider.innerHTML = `${percentage}%`;
});

bindSlider('intensity', intensity => {
    map.lighting.hillshadeIntensity = intensity;
    instance.notifyChange(map);
});

bindSlider('zFactor', zFactor => {
    map.lighting.zFactor = zFactor;
    instance.notifyChange(map);
});

const [, , stitchingToggle] = bindToggle('stitching', enabled => {
    map.terrain.stitching = enabled;
    instance.notifyChange(map);
});

bindToggle('terrainDeformation', enabled => {
    map.terrain.enabled = enabled;
    instance.notifyChange(map);
    stitchingToggle.disabled = !enabled;
});
