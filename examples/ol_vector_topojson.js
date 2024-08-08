import TopoJSON from 'ol/format/TopoJSON.js';
import OSM from 'ol/source/OSM.js';
import { Fill, Stroke, Style } from 'ol/style.js';

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';

import StatusBar from './widgets/StatusBar.js';

Instance.registerCRS(
    'EPSG:30174',
    '+proj=tmerc +lat_0=26 +lon_0=142 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=-146.414,507.337,680.507,0,0,0,0 +units=m +no_defs +type=crs',
);

// Defines geographic extent: CRS, min/max X, min/max Y
const extent = new Extent(
    'EPSG:30174',
    -201012.900985493,
    -198191.63799031873,
    1066954.2964232096,
    1071890.8856167798,
);

// `viewerDiv` will contain Giro3D' rendering area (the canvas element)
const viewerDiv = document.getElementById('viewerDiv');

// Creates a Giro3D instance
const instance = new Instance(viewerDiv, {
    crs: extent.crs(),
});

// Instanciates camera
const center = extent.centerAsVector2();
instance.view.camera.position.set(center.x, center.y - 1, 2000);

// Instanciates controls
const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;

instance.useTHREEControls(controls);

// target
controls.target.set(center.x, center.y, 0);

// Adds layers in a map

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

const buildingsLayer = new ColorLayer({
    name: 'Buildings',
    extent,
    source: new VectorSource({
        format: new TopoJSON(),
        data: 'https://3d.oslandia.com/giro3d/vectors/tokyo_buildings.topojson',
        dataProjection: 'EPSG:4326',
        style: buildingsStyle,
    }),
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
labelElement.classList = 'badge rounded-pill text-bg-light';
labelElement.style.marginTop = '2rem';
const label = new CSS2DObject(labelElement);

label.visible = false;
instance.add(label);

let previousFeature;

function pickFeatures(mouseEvent) {
    const pickResult = instance.pickObjectsAt(mouseEvent, {
        radius: 0,
    });

    const picked = pickResult.at(0);

    function resetPickedFeatures() {
        if (previousFeature) {
            previousFeature.set('highlight', false);
            buildingsLayer.source.updateFeature(previousFeature);
        }
        if (label.visible) {
            label.visible = false;
        }
        previousFeature = null;
    }

    if (picked) {
        const { x, y } = picked.point;
        const features = buildingsLayer.getVectorFeaturesAtCoordinate(
            new Coordinates(instance.referenceCrs, x, y),
        );

        if (features.length > 0) {
            const firstFeature = features[0];

            previousFeature?.set('highlight', false);
            firstFeature.set('highlight', true);

            if (previousFeature !== firstFeature) {
                buildingsLayer.source.updateFeature(previousFeature, firstFeature);
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
Inspector.attach(document.getElementById('panelDiv'), instance);
instance.domElement.addEventListener('dblclick', e => console.log(instance.pickObjectsAt(e)));

instance.notifyChange(map);
