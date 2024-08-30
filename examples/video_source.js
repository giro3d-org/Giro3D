/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import { Stroke, Style } from 'ol/style.js';
import { Vector3 } from 'three';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Globe from '@giro3d/giro3d/entities/Globe.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import VideoSource from '@giro3d/giro3d/sources/VideoSource.js';

import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg4978,
    backgroundColor: 0x0a3b59,
});

const globe = new Globe({});

instance.add(globe);

const source = new VideoSource({
    extent: new Extent(CoordinateSystem.epsg4326, {
        west: -180,
        east: +180,
        south: -90,
        north: +90,
    }),
    source: 'https://3d.oslandia.com/giro3d/videos/humidity.webm',
});

const video = new ColorLayer({
    name: 'video',
    source,
    colorMap: new ColorMap({
        colors: makeColorRamp('jet'),
        min: 0,
        max: 1,
    }),
});

source.addEventListener('loaded', () => {
    source.video.loop = true;
    source.video.play();
});

globe.addLayer(video).catch(console.error);

const outlineStyle = new Style({
    stroke: new Stroke({ color: 'black', width: 2 }),
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

globe.addLayer(boundaries).catch(console.error);

const position = globe.ellipsoid.toCartesian(0, 0, 25_000_000);
instance.view.camera.position.copy(position);
instance.view.camera.lookAt(new Vector3(0, 0, 0));

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
