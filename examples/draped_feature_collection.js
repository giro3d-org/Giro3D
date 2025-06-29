import { AmbientLight, Color, DirectionalLight, DoubleSide, MathUtils, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import GeoJSON from 'ol/format/GeoJSON.js';
import VectorSource from 'ol/source/Vector.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import WmtsSource from '@giro3d/giro3d/sources/WmtsSource.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import DrapedFeatureCollection from '@giro3d/giro3d/entities/DrapedFeatureCollection.js';
import Giro3dMap from '@giro3d/giro3d/entities/Map.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import StaticFeatureSource from '@giro3d/giro3d/sources/StaticFeatureSource.js';
import FileFeatureSource from '@giro3d/giro3d/sources/FileFeatureSource.js';
import StreamableFeatureSource, {
    ogcApiFeaturesBuilder,
} from '@giro3d/giro3d/sources/StreamableFeatureSource.js';

import StatusBar from './widgets/StatusBar.js';
import { Feature } from 'ol';
import { Point } from 'ol/geom.js';

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);
Instance.registerCRS(
    'IGNF:WGS84G',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
);

const SKY_COLOR = new Color(0xf1e9c6);

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.fromEpsg(2154),
    backgroundColor: SKY_COLOR,
});

const extent = new Extent(
    CoordinateSystem.fromEpsg(2154),
    -111629.52,
    1275028.84,
    5976033.79,
    7230161.64,
);

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
                // We don't need the full resolution of terrain
                // because we are not using any shading. This will save a lot of memory
                // and make the terrain faster to load.
                resolutionFactor: 1,
                minmax: { min: 0, max: 5000 },
                noDataOptions: {
                    replaceNoData: false,
                },
                source: elevationWmts,
            }),
        );
    })
    .catch(console.error);

// Let's build the color layer from the WMTS capabilities
WmtsSource.fromCapabilities(url, {
    layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
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

const geojson = new FileFeatureSource({
    format: new GeoJSON(),
    // url: 'http://localhost:14000/vectors/geojson/points.geojson',
    // url: 'http://localhost:14000/vectors/geojson/grenoble_linestring.geojson',
    // url: 'http://localhost:14000/vectors/geojson/grenoble_polygon.geojson',
    // url: 'http://localhost:14000/vectors/geojson/grenoble_batiments.geojson',
    // url: 'http://localhost:14002/collections/public.cadastre/items.json',
    url: 'http://localhost:14002/collections/public.cadastre/items.json?limit=500',
    sourceProjection: CoordinateSystem.epsg4326,
});

const communes = new StreamableFeatureSource({
    queryBuilder: ogcApiFeaturesBuilder('http://localhost:14002/', 'public.cadastre'),
    sourceProjection: CoordinateSystem.epsg4326,
});

const hydrants = new StreamableFeatureSource({
    queryBuilder: ogcApiFeaturesBuilder('http://localhost:14002/', 'public.hydrants_sdis_64'),
    sourceProjection: CoordinateSystem.epsg4326,
});

const bdTopoIgn = new StreamableFeatureSource({
    sourceProjection: CoordinateSystem.fromEpsg(2154),
    queryBuilder: params => {
        const url = new URL('https://data.geopf.fr/wfs/ows');

        url.searchParams.append('SERVICE', 'WFS');
        url.searchParams.append('VERSION', '2.0.0');
        url.searchParams.append('request', 'GetFeature');
        url.searchParams.append('typename', 'BDTOPO_V3:batiment');
        url.searchParams.append('outputFormat', 'application/json');
        url.searchParams.append('SRSNAME', 'EPSG:2154');
        url.searchParams.append('startIndex', '0');

        const extent = params.extent.as(CoordinateSystem.fromEpsg(2154));

        url.searchParams.append(
            'bbox',
            `${extent.west},${extent.south},${extent.east},${extent.north},EPSG:2154`,
        );

        return url;
    },
});

const hoverColor = new Color('yellow');

const bdTopoStyle = feature => {
    const properties = feature.getProperties();
    let fillColor = '#FFFFFF';

    const hovered = properties.hovered ?? false;
    const clicked = properties.clicked ?? false;

    switch (properties.usage1) {
        case 'Industriel':
            fillColor = '#f0bb41';
            break;
        case 'Agricole':
            fillColor = '#96ff0d';
            break;
        case 'Religieux':
            fillColor = '#41b5f0';
            break;
        case 'Sportif':
            fillColor = '#ff0d45';
            break;
        case 'Résidentiel':
            fillColor = '#cec8be';
            break;
        case 'Commercial et services':
            fillColor = '#d8ffd4';
            break;
    }

    const fill = clicked
        ? 'yellow'
        : hovered
          ? new Color(fillColor).lerp(hoverColor, 0.2) // Let's use a slightly brighter color for hover
          : fillColor;

    return {
        fill: {
            color: fill,
            shading: true,
        },
        stroke: {
            color: clicked ? 'yellow' : hovered ? 'white' : 'black',
            lineWidth: clicked ? 5 : undefined,
        },
    };
};

// Let's compute the extrusion offset of building polygons to give them walls.
const extrusionOffsetCallback = feature => {
    const properties = feature.getProperties();
    const buildingHeight = properties['hauteur'];
    const extrusionOffset = buildingHeight;

    if (Number.isNaN(extrusionOffset)) {
        return null;
    }
    return extrusionOffset;
};

const sources = {
    static: new StaticFeatureSource({
        coordinateSystem: CoordinateSystem.fromEpsg(2154),
    }),
    batiment: new StreamableFeatureSource({
        sourceProjection: CoordinateSystem.epsg4326,
        queryBuilder: ogcApiFeaturesBuilder('http://localhost:14002/', 'public.batiment_038_isere'),
    }),
};

const pointStyle = {
    point: {
        pointSize: 48,
        depthTest: false,
        image: 'http://localhost:14000/images/pin.png',
    },
};

const entity = new DrapedFeatureCollection({
    source: sources['static'],
    minLod: 0,
    drapingMode: 'per-feature',
    // extrusionOffset: extrusionOffsetCallback,
    style: pointStyle,
});

instance.add(entity).then(() => {
    entity.attach(map);

    setInterval(() => {
        const x = MathUtils.lerp(map.extent.west, map.extent.east, MathUtils.randFloat(0.3, 0.7));
        const y = MathUtils.lerp(map.extent.south, map.extent.north, MathUtils.randFloat(0.3, 0.7));
        sources['static'].addFeature(new Feature(new Point([x, y])));
    }, 500);
});

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

instance.view.camera.position.set(913349.2364044407, 6456426.459171033, 1706.0108044011636);

const lookAt = new Vector3(913896, 6459191, 200);
instance.view.camera.lookAt(lookAt);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.4;
controls.target.copy(lookAt);
controls.saveState();
instance.view.setControls(controls);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
