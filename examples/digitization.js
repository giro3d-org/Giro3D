import { Vector3, Color } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import { Circle, Fill, Stroke, Style } from 'ol/style.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import DrawTool from '@giro3d/giro3d/interactions/DrawTool.js';

import StatusBar from './widgets/StatusBar.js';

import { bindButton } from './widgets/bindButton.js';

// Defines projection that we will use (taken from https://epsg.io/2154, Proj4js section)
Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const viewerDiv = document.getElementById('viewerDiv');
const instance = new Instance(viewerDiv, { crs: 'EPSG:2154', renderer: { clearColor: false } });

// create a map
const extent = Extent.fromCenterAndSize('EPSG:2154', { x: 895_055, y: 6_247_049 }, 20_000, 20_000);

const map = new Map('planar', {
    extent,
    backgroundColor: 'gray',
    hillshading: {
        enabled: true,
        elevationLayersOnly: true,
    },
    doubleSided: false,
});
instance.add(map);

const noDataValue = -1000;

const capabilitiesUrl =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    format: new BilFormat(),
    noDataValue,
})
    .then(elevationWmts => {
        map.addLayer(
            new ElevationLayer({
                name: 'wmts_elevation',
                extent: map.extent,
                resolutionFactor: 0.5,
                minmax: { min: 0, max: 5000 },
                noDataOptions: {
                    replaceNoData: false,
                },
                source: elevationWmts,
            }),
        );
    })
    .catch(console.error);

const color = new Color('#2978b4').convertLinearToSRGB();

const fill = new Fill({
    color: `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, 0.35)`,
});

const stroke = new Stroke({
    color: '#2978b4',
    width: 4,
});

const strokeBorder = new Stroke({
    color: 'white',
    width: 6,
});

const style0 = new Style({
    stroke,
});

const style1 = new Style({
    fill,
    stroke: strokeBorder,
    image: new Circle({
        radius: 8,
        fill: new Fill({
            color: '#2978b4',
        }),
        stroke: new Stroke({
            color: 'white',
            width: 3,
        }),
    }),
});

const vectorSource = new VectorSource({
    dataProjection: 'EPSG:4326',
    style: [style1, style0],
    data: [],
});

const vectorLayer = new ColorLayer({
    source: vectorSource,
    extent: map.extent,
});

WmtsSource.fromCapabilities(capabilitiesUrl, {
    layer: 'HR.ORTHOIMAGERY.ORTHOPHOTOS',
})
    .then(orthophotoWmts => {
        map.addLayer(
            new ColorLayer({
                extent: map.extent,
                source: orthophotoWmts,
            }),
        );

        map.addLayer(vectorLayer);
    })
    .catch(console.error);

instance.view.camera.position.set(892_342, 6_246_816, 3000);
const lookAt = new Vector3(892_342, 6_246_816 + 1, 50);
instance.view.camera.lookAt(lookAt);
// Notify Giro3D we've changed the three.js camera position directly
instance.notifyChange(instance.view.camera);

// Creates controls
const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;

// you need to use these 2 lines each time you change the camera lookAt or position programatically
controls.target.copy(lookAt);
controls.saveState();

instance.useTHREEControls(controls);

Inspector.attach(document.getElementById('panelDiv'), instance);

StatusBar.bind(instance);

const tool = new DrawTool({
    instance,
});

const removeFeatures = bindButton('remove-features', button => {
    vectorSource.clear();
    button.disabled = true;
});

const disableButtons = disable => {
    const buttons = document.getElementById('group').getElementsByTagName('button');
    for (const button of buttons) {
        button.disabled = disable;
    }
};

const createFeature = shape => {
    if (shape) {
        const feature = shape.toOpenLayersFeature();

        vectorSource.addFeature(feature);

        removeFeatures.disabled = false;

        instance.remove(shape);
    }

    controls.enabled = true;

    disableButtons(false);
};

bindButton('point', () => {
    controls.enabled = false;
    disableButtons(true);
    tool.createPoint().then(createFeature);
});

bindButton('multipoint', () => {
    controls.enabled = false;
    disableButtons(true);
    tool.createMultiPoint().then(createFeature);
});

bindButton('linestring', () => {
    controls.enabled = false;
    disableButtons(true);
    tool.createLineString().then(createFeature);
});

bindButton('polygon', () => {
    controls.enabled = false;
    disableButtons(true);
    tool.createPolygon().then(createFeature);
});
