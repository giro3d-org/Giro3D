/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import UrlImageSource from '@giro3d/giro3d/sources/UrlImageSource.js';

import StatusBar from './widgets/StatusBar.js';

const crs = CoordinateSystem.register(
    'EPSG:2154',
    `
PROJCRS["RGF93 v1 / Lambert-93",
    BASEGEOGCRS["RGF93 v1",
        DATUM["Reseau Geodesique Francais 1993 v1",
            ELLIPSOID["GRS 1980",6378137,298.257222101,
                LENGTHUNIT["metre",1]]],
        PRIMEM["Greenwich",0,
            ANGLEUNIT["degree",0.0174532925199433]],
        ID["EPSG",4171]],
    CONVERSION["Lambert-93",
        METHOD["Lambert Conic Conformal (2SP)",
            ID["EPSG",9802]],
        PARAMETER["Latitude of false origin",46.5,
            ANGLEUNIT["degree",0.0174532925199433],
            ID["EPSG",8821]],
        PARAMETER["Longitude of false origin",3,
            ANGLEUNIT["degree",0.0174532925199433],
            ID["EPSG",8822]],
        PARAMETER["Latitude of 1st standard parallel",49,
            ANGLEUNIT["degree",0.0174532925199433],
            ID["EPSG",8823]],
        PARAMETER["Latitude of 2nd standard parallel",44,
            ANGLEUNIT["degree",0.0174532925199433],
            ID["EPSG",8824]],
        PARAMETER["Easting at false origin",700000,
            LENGTHUNIT["metre",1],
            ID["EPSG",8826]],
        PARAMETER["Northing at false origin",6600000,
            LENGTHUNIT["metre",1],
            ID["EPSG",8827]]],
    CS[Cartesian,2],
        AXIS["easting (X)",east,
            ORDER[1],
            LENGTHUNIT["metre",1]],
        AXIS["northing (Y)",north,
            ORDER[2],
            LENGTHUNIT["metre",1]],
    USAGE[
        SCOPE["Engineering survey, topographic mapping."],
        AREA["France - onshore and offshore, mainland and Corsica (France métropolitaine including Corsica)."],
        BBOX[41.15,-9.86,51.56,10.38]],
    ID["EPSG",2154]]`,
);

const extent = Extent.fromCenterAndSize(
    CoordinateSystem.epsg3857,
    { x: 260000, y: 6251379 },
    32000,
    32000,
).as(crs);

const instance = new Instance({
    target: 'view',
    crs: crs,
});

const map = new Map({ extent });

instance.add(map);

// Create the image source by passing the URL template
const wmsSource = new UrlImageSource({
    urlTemplate:
        'https://data.geopf.fr/wms-r/wms' +
        '?SERVICE=WMS' +
        '&VERSION=1.3.0' +
        '&REQUEST=GetMap' +
        '&BBOX={minx},{miny},{maxx},{maxy}' +
        '&CRS=EPSG:{epsgCode}' +
        '&WIDTH={width}' +
        '&HEIGHT={height}' +
        '&LAYERS=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' +
        '&STYLES=' +
        '&FORMAT=image/png',
});

const wmsLayer = new ColorLayer({
    source: wmsSource,
});

map.addLayer(wmsLayer).then(() => {
    const pov = instance.view.goTo(map);
    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.target.copy(pov.target);
    instance.view.setControls(controls);
});

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
