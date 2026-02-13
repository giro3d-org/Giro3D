/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Feature } from 'ol';
import { fromExtent } from 'ol/geom/Polygon.js';
import { Stroke, Style } from 'ol/style.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import AggregateImageSource from '@giro3d/giro3d/sources/AggregateImageSource.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';
import OpenLayersUtils from '@giro3d/giro3d/utils/OpenLayersUtils.js';

import { bindToggle } from './widgets/bindToggle.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

const CRS = CoordinateSystem.epsg3857;

const instance = new Instance({
    target: 'view',
    crs: CRS,
});

async function loadData() {
    const baseUrl = 'https://3d.oslandia.com/giro3d/rasters/';
    const tiles = ['N41E008.hgt.tif', 'N41E009.hgt.tif', 'N42E008.hgt.tif', 'N42E009.hgt.tif'];

    // Create one GeoTIFFSource per SRTM tile
    // Note that SRTM tiles are in EPSG:4326, so they will be reprojected
    // to EPSG:3857 which is the CRS of the instance.
    const sources = tiles.map(
        tile => new GeoTIFFSource({ url: baseUrl + tile, crs: CoordinateSystem.epsg4326 }),
    );

    // Then combine them in an aggregate source.
    // Note: all sub-sources must have the same CRS.
    const aggregateSource = new AggregateImageSource({ sources });

    // Let's initialize the source to be able to retrieve its extent
    await aggregateSource.initialize({ targetProjection: CRS });

    const extent = aggregateSource.getExtent().as(CRS);

    const map = new Map({
        extent,
        backgroundColor: 'gray',
        lighting: true,
    });

    instance.add(map).catch(console.error);

    const min = 0;
    const max = 2700;

    const layer = new ElevationLayer({
        minmax: { min, max },
        colorMap: new ColorMap({ colors: makeColorRamp('earth'), min, max }),
        source: aggregateSource,
    });

    await map.addLayer(layer);

    // Let's now create a vector layer to visualize the extents of the SRTM tiles.
    const tileOutlines = sources.map(source => {
        const olExtent = OpenLayersUtils.toOLExtent(source.getExtent());
        const olPolygon = fromExtent(olExtent);
        const feature = new Feature(olPolygon);
        return feature;
    });

    const vectorLayer = new ColorLayer({
        source: new VectorSource({
            data: tileOutlines,
            dataProjection: CoordinateSystem.epsg4326,
            style: new Style({
                stroke: new Stroke({
                    width: 4,
                    color: 'red',
                }),
            }),
        }),
    });

    await map.addLayer(vectorLayer);

    const center = extent.centerAsVector2();
    instance.view.camera.position.set(center.x, center.y, 500_000);

    const controls = new MapControls(instance.view.camera, instance.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    controls.target.set(center.x, center.y + 1, 0);
    instance.view.setControls(controls);

    // Attach the inspector
    Inspector.attach('inspector', instance);

    StatusBar.bind(instance);

    bindToggle('show-tile-extents', show => {
        vectorLayer.visible = show;
        instance.notifyChange(vectorLayer);
    });
}

loadData().catch(console.error);
