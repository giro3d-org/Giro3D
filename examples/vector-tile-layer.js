/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import VectorTileSource from '@giro3d/giro3d/sources/VectorTileSource.js';

import { stylefunction } from 'ol-mapbox-style';

import MVT from 'ol/format/MVT.js';
import OlVectorTileLayer from 'ol/layer/VectorTile';
import OlVectorTileSource from 'ol/source/VectorTile';

import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(CoordinateSystem.epsg3857, -551152, 876637, 5178404, 6631315);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 'white',
});

const map = new Map({ extent, maxSubdivisionLevel: 15 });
instance.add(map);

instance.view.camera.position.set(0, 0, 10000000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;

instance.view.setControls(controls);

fetch('https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PCI/pci.json').then(res => {
    res.json().then(glStyle => {
        const temporaryOlLayer = new OlVectorTileLayer({
            source: new OlVectorTileSource({
                format: new MVT(),
                url: `${'https://data.geopf.fr/tms/1.0.0/PCI/{z}/{x}/{y}.pbf'}`,
            }),
        });

        const style = stylefunction(temporaryOlLayer, glStyle, 'pci');

        const vectorTileSource = new VectorTileSource({
            url: `${'https://data.geopf.fr/tms/1.0.0/PCI/{z}/{x}/{y}.pbf'}`,
            style,
            backgroundColor: 'white',
        });

        const vectorTileLayer = new ColorLayer({
            name: 'osm',
            resolutionFactor: 2,
            extent,
            source: vectorTileSource,
        });

        map.addLayer(vectorTileLayer);
    });
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
