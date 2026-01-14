/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { GeoJSON } from 'ol/format.js';
import XYZ from 'ol/source/XYZ.js';
import { Stroke, Style } from 'ol/style.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import { bindButton } from './widgets/bindButton.js';
import StatusBar from './widgets/StatusBar.js';

/** @type {Instance} */
let instance;
/** @type {Inspector} */
let inspector;
/** @type {MapControls} */
let controls;
/** @type {Map} */
let map;

function addMapboxLayer(extent) {
    const apiKey =
        'pk.eyJ1IjoiZ2lybzNkIiwiYSI6ImNtZ3Q0NDNlNTAwY2oybHI3Ym1kcW03YmoifQ.Zl7_KZiAhqWSPjlkKDKYnQ';

    // Adds a satellite basemap
    const tiledLayer = new ColorLayer({
        name: 'basemap',
        extent,
        showTileBorders: true,
        source: new TiledImageSource({
            source: new XYZ({
                url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token=${apiKey}`,
                projection: 'EPSG:3857',
            }),
        }),
    });
    map.addLayer(tiledLayer).catch(e => console.error(e));
}

function addCogLayer() {
    const cogLayer = new ColorLayer({
        name: 'cog',
        showTileBorders: true,
        source: new GeoTIFFSource({
            url: 'https://3d.oslandia.com/giro3d/rasters/TCI.tif',
            crs: CoordinateSystem.epsg3857,
        }),
    });
    map.addLayer(cogLayer).catch(e => console.error(e));
}

function addVectorLayer() {
    const outlineStyle = new Style({
        stroke: new Stroke({ color: 'red', width: 2 }),
    });

    // Display the countries boundaries.
    const boundaries = new ColorLayer({
        name: 'boundaries',
        source: new VectorSource({
            data: {
                url: 'https://3d.oslandia.com/giro3d/vectors/countries.geojson',
                format: new GeoJSON(),
            },
            style: outlineStyle,
            dataProjection: CoordinateSystem.epsg4326,
        }),
    });

    map.addLayer(boundaries).catch(e => console.error(e));
}

function createScene(/** @type CoordinateSystem */ crs, extent) {
    if (instance) {
        map.getLayers().forEach(l => l.dispose());
        controls.dispose();
        inspector.detach();
        instance.dispose();
    }

    instance = new Instance({
        target: 'view',
        crs,
        backgroundColor: 'grey',
    });

    map = new Map({
        extent,
        terrain: {
            segments: 2,
        },
        backgroundColor: 'black',
        backgroundOpacity: 0.3,
    });

    instance.add(map);

    addMapboxLayer(extent);

    addCogLayer();

    addVectorLayer();

    const center = extent.centerAsVector3();
    instance.view.camera.position.set(center.x, center.y - 1, extent.dimensions().y * 2);

    controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target = center;
    controls.saveState();
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    controls.maxPolarAngle = Math.PI / 2.3;
    instance.view.setControls(controls);

    inspector = Inspector.attach('inspector', instance);

    StatusBar.bind(instance, { disableUrlUpdate: true });
}

async function fetchCrs(code) {
    const res = await fetch(`https://epsg.io/${code}.wkt2`, { mode: 'cors' });
    const wkt2 = await res.text();

    const name = /PROJCRS\["(.*?)"/gm.exec(wkt2)[1];
    const area = /AREA\["(.*?)"/gm.exec(wkt2)[1];
    const bbox = /BBOX\[(.*?)\]/gm.exec(wkt2)[1];

    const [minLat, minLon, maxLat, maxLon] = bbox.split(',').map(s => s.trim());

    const proj = await (await fetch(`https://epsg.io/${code}.proj4`, { mode: 'cors' })).text();

    const id = `EPSG:${code}`;
    const crs = CoordinateSystem.register(id, proj, { throwIfFailedToRegisterWithProj: true });

    const extent = new Extent(CoordinateSystem.epsg4326, {
        west: Number.parseFloat(minLon),
        east: Number.parseFloat(maxLon),
        north: Number.parseFloat(maxLat),
        south: Number.parseFloat(minLat),
    });

    document.getElementById('srid').innerText = id;
    document.getElementById('name').innerText = name;
    document.getElementById('description').innerText = area;
    // @ts-expect-error typing
    document.getElementById('link').href = `https://epsg.io/${code}`;

    return { def: wkt2, crs, extent: extent.as(crs) };
}

async function initialize(epsgCode) {
    const error = document.getElementById('message');

    try {
        const { extent, crs } = await fetchCrs(epsgCode);
        error.style.display = 'none';

        createScene(crs, extent);
    } catch (e) {
        error.style.display = 'block';

        if (e instanceof Error) {
            error.innerText = e.message;
        } else {
            error.innerText = `An error occured while fetching CRS definition on epsg.io`;
        }
    }
}

bindButton('create', () => {
    /** @type {HTMLInputElement} */
    // @ts-expect-error conversion
    const epsgCodeElt = document.getElementById('code');

    const epsgCode = Number.parseInt(epsgCodeElt.value);

    if (epsgCode) {
        initialize(epsgCode);
    }
});

initialize(2154);
