import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import StadiaMaps from 'ol/source/StadiaMaps.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

const extent = new Extent(
    'EPSG:3857',
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 0x0a3b59,
});

// Adds an TMS imagery layer
const layer = new ColorLayer({
    name: 'osm',
    source: new TiledImageSource({
        source: new StadiaMaps({ layer: 'stamen_watercolor', wrapX: false }),
    }),
});

let index = 0;
const promises = [];
for (const ex of extent.split(8, 8)) {
    const mapExtent = ex.withRelativeMargin(-0.05);
    // Creates a map that will contain the layer
    const map = new Map({ extent: mapExtent });
    map.name = `${index++}`;

    instance.add(map);

    const promise = map.addLayer(layer).catch(e => console.error(e));
    promises.push(promise);
}

Promise.allSettled(promises).then(() => {
    instance.view.camera.position.set(0, 0, 25000000);

    const controls = new MapControls(instance.view.camera, instance.domElement);
    instance.view.setControls(controls);

    Inspector.attach('inspector', instance);

    StatusBar.bind(instance);
});
