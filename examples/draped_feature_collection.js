/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { AmbientLight, DirectionalLight, DoubleSide, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import DrapedFeatureCollection from '@giro3d/giro3d/entities/DrapedFeatureCollection.js';
import Giro3dMap from '@giro3d/giro3d/entities/Map.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import FileFeatureSource from '@giro3d/giro3d/sources/FileFeatureSource.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import { bindDropDown } from './widgets/bindDropDown.js';
import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const coordinateSystem = CoordinateSystem.fromEpsg(2154);

const instance = new Instance({
    target: 'view',
    crs: coordinateSystem,
    backgroundColor: null,
});

const mapCenter = new Coordinates(coordinateSystem, 870_623, 6_396_742);

const extent = Extent.fromCenterAndSize(coordinateSystem, mapCenter, 20_000, 10_000);

// create a map
const map = new Giro3dMap({
    extent,
    backgroundColor: '#304f66',
    lighting: {
        enabled: true,
        elevationLayersOnly: true,
    },
    side: DoubleSide,
});

instance.add(map);

const noDataValue = -1000;

const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

const featureSource = new FileFeatureSource({
    url: 'https://3d.oslandia.com/giro3d/vectors/Saou-syncline.geojson',
});

const style = {
    stroke: {
        color: 'yellow',
        depthTest: false,
        renderOrder: 999,
        lineWidth: 3,
    },
};

const entities = {
    'per-vertex': new DrapedFeatureCollection({
        source: featureSource,
        minLod: 0,
        drapingMode: 'per-vertex',
        style,
    }),
    'per-feature': new DrapedFeatureCollection({
        source: featureSource,
        minLod: 0,
        drapingMode: 'per-feature',
        style,
    }),
    none: new DrapedFeatureCollection({
        source: featureSource,
        minLod: 0,
        drapingMode: 'none',
        style,
    }),
};

function updateEntities(newMode) {
    for (const key of Object.keys(entities)) {
        entities[key].visible = newMode === key;
    }

    instance.notifyChange();
}

const [_, currentMode] = bindDropDown('mode', updateEntities);

function loadDrapedFeatures() {
    entities['per-feature'].visible = false;
    entities['per-vertex'].visible = false;
    entities['none'].visible = false;

    instance.add(entities['per-vertex']).then(() => {
        entities['per-vertex'].attach(map);
    });
    instance.add(entities['none']).then(() => {
        entities['none'].attach(map);
    });
    instance.add(entities['per-feature']).then(() => {
        entities['per-feature'].attach(map);
    });

    updateEntities(currentMode);
}

loadDrapedFeatures();

/** @type {ElevationLayer | null} */
let elevationLayer = null;

// Let's build the elevation layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue,
})
    .then(elevationWmts => {
        elevationLayer = new ElevationLayer({
            name: 'elevation',
            extent: map.extent,
            // We don't need the full resolution of terrain
            // because we are not using any shading. This will save a lot of memory
            // and make the terrain faster to load.
            resolutionFactor: 1 / 2,
            minmax: { min: 0, max: 5000 },
            noDataOptions: {
                replaceNoData: false,
            },
            source: elevationWmts,
        });

        map.addLayer(elevationLayer);
    })
    .catch(console.error);

// Let's build the color layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        map.addLayer(
            new ColorLayer({
                name: 'color',
                resolutionFactor: 1,
                extent: map.extent,
                source: orthophotoWmts,
            }),
        );
    })
    .catch(console.error);

// Add a sunlight
const sun = new DirectionalLight('#ffffff', 2);
sun.position.set(1, 0, 1).normalize();
sun.updateMatrixWorld(true);
instance.scene.add(sun);

// We can look below the floor, so let's light also a bit there
const sun2 = new DirectionalLight('#ffffff', 0.5);
sun2.position.set(0, 1, 1);
sun2.updateMatrixWorld();
instance.scene.add(sun2);

// Add an ambient light
const ambientLight = new AmbientLight(0xffffff, 0.2);
instance.scene.add(ambientLight);

instance.view.camera.position.set(mapCenter.x - 10000, mapCenter.y - 4000, 2000);

const lookAt = new Vector3(mapCenter.x, mapCenter.y, 100);
instance.view.camera.lookAt(lookAt);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.4;
controls.target.copy(lookAt);
controls.saveState();
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

bindDropDown('elevationMode', newMode => {
    if (elevationLayer == null) {
        return;
    }

    const currentLayers = map.getElevationLayers();

    switch (newMode) {
        case 'enabled':
            if (!currentLayers.includes(elevationLayer)) {
                map.addLayer(elevationLayer);
            }
            elevationLayer.visible = true;
            break;
        case 'hidden':
            if (!currentLayers.includes(elevationLayer)) {
                map.addLayer(elevationLayer);
            }
            elevationLayer.visible = false;
            break;
        case 'disabled':
            if (currentLayers.includes(elevationLayer)) {
                map.removeLayer(elevationLayer);
            }
            break;
    }

    instance.notifyChange(map);
});

StatusBar.bind(instance);
