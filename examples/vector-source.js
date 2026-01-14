/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import GML32 from 'ol/format/GML32.js';
import GPX from 'ol/format/GPX.js';
import KML from 'ol/format/KML.js';
import { XYZ } from 'ol/source.js';
import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import StatusBar from './widgets/StatusBar.js';

const epsg3946 = CoordinateSystem.register(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);
const epsg4171 = CoordinateSystem.register(
    'EPSG:4171',
    '+proj=longlat +ellps=GRS80 +no_defs +type=crs',
);

const extent = new Extent(epsg3946, 1837816.94334, 1847692.32501, 5170036.4587, 5178412.82698);

const instance = new Instance({
    target: 'view',
    crs: epsg3946,
});

const map = new Map({ extent });

instance.add(map);

const key =
    'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ';

// Adds a XYZ elevation layer with MapBox terrain RGB tileset
const elevationLayer = new ElevationLayer({
    extent,
    resolutionFactor: 1 / 8,
    source: new TiledImageSource({
        format: new MapboxTerrainFormat(),
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${key}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});
map.addLayer(elevationLayer);

// Adds a XYZ color layer with MapBox satellite tileset
const satelliteLayer = new ColorLayer({
    extent,
    source: new TiledImageSource({
        source: new XYZ({
            url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${key}`,
            projection: 'EPSG:3857',
            crossOrigin: 'anonymous',
        }),
    }),
});
map.addLayer(satelliteLayer);

// Adds our first layer from a GeoJSON file
// Initial source: https://data.grandlyon.com/jeux-de-donnees/parcs-places-jardins-indice-canopee-metropole-lyon/info
const geoJsonLayer = new ColorLayer({
    name: 'geojson',
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/lyon/evg_esp_veg.evgparcindiccanope_latest.geojson',
            format: new GeoJSON(),
        },
        // Defines the dataProjection to reproject the data,
        // GeoJSON specifications say that the crs should be EPSG:4326 but
        // here we are using a different one.
        dataProjection: epsg4171,
        style: feature =>
            new Style({
                fill: new Fill({
                    color: `rgba(0, 128, 0, ${feature.get('indiccanop')})`,
                }),
                stroke: new Stroke({
                    color: 'white',
                }),
            }),
    }),
});
map.addLayer(geoJsonLayer);

// Adds a second vector layer from a GPX file
const gpxLayer = new ColorLayer({
    name: 'gpx',
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/lyon/track.gpx',
            format: new GPX(),
        },
        // Defines the dataProjection to reproject the data,
        // KML and GPX specifications say that the crs is EPSG:4326.
        dataProjection: CoordinateSystem.epsg4326,
        style: new Style({
            stroke: new Stroke({
                color: '#FA8C22',
                width: 2,
            }),
        }),
    }),
});
map.addLayer(gpxLayer);

// Adds a third source from a KML file
// Initial source: https://data.grandlyon.com/jeux-de-donnees/lignes-metro-funiculaire-reseau-transports-commun-lyonnais-v2/info
// Edited for convering to KML+adding proper colors
const kmlLayer = new ColorLayer({
    name: 'kml',
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/lyon/tcl_sytral.tcllignemf_2_0_0.kml',
            format: new KML(),
        },
        dataProjection: epsg3946,
        // With KML format, there is not necessary to specify style rules,
        // there are already present in the file.
    }),
});
map.addLayer(kmlLayer);

// Adds our fourth layer from a GML file
// Initial source: https://data.grandlyon.com/jeux-de-donnees/bornes-fontaine-metropole-lyon/info
// Edited for having a simple GML FeatureCollection
const gmlLayer = new ColorLayer({
    name: 'gml',
    source: new VectorSource({
        data: {
            url: 'https://3d.oslandia.com/lyon/adr_voie_lieu.adrbornefontaine_latest.gml',
            format: new GML32(),
        },
        dataProjection: epsg4171,
        style: (feature, resolution) => {
            const meters = 1 / resolution; // Assuming pixel ratio is 1
            // We want to display a 5*5m square, except
            // for when we're too far away, use a 2*2px square
            const size = Math.max(5 * meters, 2);
            return new Style({
                image: new RegularShape({
                    radius: size,
                    points: 4,
                    stroke: new Stroke({
                        width: 1,
                        color: [255, 255, 255, 1],
                    }),
                    fill: new Fill({
                        color: [0, 0, 128, 1],
                    }),
                }),
            });
        },
    }),
});
map.addLayer(gmlLayer);

instance.view.camera.position.set(extent.minX, extent.minY, 2000);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.target = extent.centerAsVector3();
controls.saveState();
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;
instance.view.setControls(controls);

const resultTable = document.getElementById('results');
instance.domElement.addEventListener('mousemove', e => {
    const pickResults = instance.pickObjectsAt(e, {
        radius: 5,
        limit: 1,
        pickFeatures: true,
        sortByDistance: true,
    });

    const pickedObject = pickResults[0];

    resultTable.innerHTML = '';

    if (pickedObject?.features && pickedObject.features.length > 0) {
        // @ts-expect-error untyped
        for (const { layer, feature } of pickedObject.features) {
            const layerName = layer.name;
            const featureName = feature.get('nom') ?? feature.get('name') ?? feature.get('gid');
            resultTable.innerHTML += `${layerName}: ${featureName}<br>`;
        }
    }
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
