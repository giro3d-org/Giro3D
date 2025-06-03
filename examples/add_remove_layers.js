import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';

import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);
const extent = new Extent(
    CoordinateSystem.fromEpsg(2154),
    -111629.52,
    1275028.84,
    5976033.79,
    7230161.64,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
    backgroundColor: 'black',
});

const camPos = new Vector3(220295, 6810219, 409065);
instance.view.camera.position.set(camPos.x, camPos.y, camPos.z);

const controls = new MapControls(instance.view.camera, instance.domElement);
instance.view.setControls(controls);

controls.target.set(camPos.x, camPos.y + 1, 0);

const map = new Map({
    extent,
    backgroundColor: 'gray',
    maxSubdivisionLevel: 13,
    lighting: {
        enabled: true,
        zFactor: 8,
    },
    terrain: false,
});
instance.add(map);

const capabilitiesUrl =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

let layers = {};

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        const layer = new ColorLayer({
            name: 'orthophotos',
            extent: map.extent,
            source: orthophotoWmts,
        });
        layers['orthophotos'] = layer;
        layer.userData.zOrder = 0;
        map.addLayer(layer);
    })
    .catch(console.error);

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
})
    .then(planIgn => {
        const layer = new ColorLayer({
            name: 'plan',
            extent: map.extent,
            source: planIgn,
            opacity: 0.2,
        });
        layers['plan'] = layer;
        layer.userData.zOrder = 1;
        map.addLayer(layer);
    })
    .catch(console.error);

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue: -1000,
})
    .then(elevationWmts => {
        const layer = new ElevationLayer({
            name: 'terrain',
            extent: map.extent,
            resolutionFactor: 1 / 4,
            minmax: { min: 0, max: 5000 },
            noDataOptions: {
                replaceNoData: false,
            },
            source: elevationWmts,
        });
        layers['terrain'] = layer;
        map.addLayer(layer);
    })
    .catch(console.error);

function bindLayerToggle(layerName) {
    bindToggle(layerName, state => {
        if (state) {
            map.addLayer(layers[layerName]);
        } else {
            map.removeLayer(layers[layerName]);
        }
        // @ts-expect-error untyped zOrder
        map.sortColorLayers((a, b) => a.userData.zOrder - b.userData.zOrder);
        instance.notifyChange(map);
    });
}

bindLayerToggle('terrain');
bindLayerToggle('plan');
bindLayerToggle('orthophotos');

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
