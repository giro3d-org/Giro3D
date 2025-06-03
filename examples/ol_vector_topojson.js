import TopoJSON from 'ol/format/TopoJSON.js';
import OSM from 'ol/source/OSM.js';
import { Fill, Stroke, Style } from 'ol/style.js';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:30174',
    '+proj=tmerc +lat_0=26 +lon_0=142 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=-146.414,507.337,680.507,0,0,0,0 +units=m +no_defs +type=crs',
);

const extent = new Extent(
    CoordinateSystem.fromEpsg(30174),
    -201012.900985493,
    -198191.63799031873,
    1066954.2964232096,
    1071890.8856167798,
);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

const center = extent.centerAsVector2();

instance.view.camera.position.set(center.x, center.y - 1, 2000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.target.set(center.x, center.y, 0);
instance.view.setControls(controls);

const map = new Map({ extent, backgroundColor: '#135D66' });
instance.add(map);

const buildingsStyle = feature => {
    const highlight = feature.get('highlight');
    const stroke = highlight
        ? new Stroke({
              color: 'white',
              width: 2,
          })
        : undefined;

    return new Style({
        zIndex: highlight ? 1 : 0,
        fill: new Fill({
            color: highlight ? 'green' : 'red',
        }),
        stroke,
    });
};

const topoJsonSource = new VectorSource({
    data: {
        url: 'https://3d.oslandia.com/giro3d/vectors/tokyo_buildings.topojson',
        format: new TopoJSON(),
    },
    dataProjection: CoordinateSystem.epsg4326,
    style: buildingsStyle,
});

const buildingsLayer = new ColorLayer({
    name: 'Buildings',
    extent,
    source: topoJsonSource,
});

// Create the OpenStreetMap color layer using an OpenLayers source.
// See https://openlayers.org/en/latest/apidoc/module-ol_source_OSM-OSM.html
// for more informations.
const osm = new ColorLayer({
    name: 'osm',
    source: new TiledImageSource({ source: new OSM() }),
    extent,
});

map.addLayer(osm);
map.addLayer(buildingsLayer);

StatusBar.bind(instance);

const labelElement = document.createElement('span');
labelElement.classList.value = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';
const label = new CSS2DObject(labelElement);

label.visible = false;
instance.add(label);

let previousFeature;

function pickFeatures(mouseEvent) {
    const pickResult = instance.pickObjectsAt(mouseEvent, {
        radius: 0,
    });

    const picked = pickResult[0];

    function resetPickedFeatures() {
        if (previousFeature) {
            previousFeature.set('highlight', false);
            topoJsonSource.updateFeature(previousFeature);
        }
        if (label.visible) {
            label.visible = false;
        }
        previousFeature = null;
    }

    if (picked) {
        const { x, y } = picked.point;
        const features = buildingsLayer.getVectorFeaturesAtCoordinate(
            new Coordinates(instance.coordinateSystem, x, y),
        );

        if (features.length > 0) {
            const firstFeature = features[0];

            previousFeature?.set('highlight', false);
            firstFeature.set('highlight', true);

            if (previousFeature !== firstFeature) {
                topoJsonSource.updateFeature(previousFeature, firstFeature);
                previousFeature = firstFeature;
            }

            instance.notifyChange(map);
            label.position.set(x, y, 100);
            label.visible = true;
            label.element.innerText = firstFeature.get('osm_id');
            label.updateMatrixWorld(true);
        } else {
            resetPickedFeatures();
        }
    } else {
        resetPickedFeatures();
    }
}

instance.domElement.addEventListener('mousemove', pickFeatures);
instance.domElement.addEventListener('dblclick', e => console.log(instance.pickObjectsAt(e)));

Inspector.attach('inspector', instance);

instance.notifyChange(map);
