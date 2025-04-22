import { LinearFilter, NearestFilter, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';

import StatusBar from './widgets/StatusBar.js';
import { bindDropDown } from './widgets/bindDropDown.js';

const extent = new Extent('EPSG:3857', 1818329.448, 1987320.77, 6062229.082, 6231700.791);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 'black',
});

const center = new Vector3(1911960, 6130719, 2156);

instance.view.camera.position.set(center.x, center.y, center.z);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(center.x, center.y + 1, 0);
instance.view.setControls(controls);

const map = new Map({ extent, backgroundOpacity: 0 });

instance.add(map);

const source = new GeoTIFFSource({
    url: 'https://3d.oslandia.com/giro3d/rasters/TCI-YCbCr-mask.tif',
    crs: extent.crs,
});

/** @type {NearestFilter | LinearFilter} */
let filter = LinearFilter;

function run() {
    map.forEachLayer(layer => map.removeLayer(layer, { disposeLayer: true }));

    map.addLayer(
        new ColorLayer({
            source,
            minFilter: filter,
            magFilter: filter,
        }),
    );
}

Inspector.attach('inspector', instance);
StatusBar.bind(instance);

bindDropDown('filter', v => {
    switch (v) {
        case 'nearest':
            filter = NearestFilter;
            break;
        case 'linear':
            filter = LinearFilter;
            break;
    }

    run();
});

run();
