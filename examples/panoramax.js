/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap';
import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import Instance from '@giro3d/giro3d/core/Instance';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import PointCloud from '@giro3d/giro3d/entities/PointCloud';
import Shape from '@giro3d/giro3d/entities/Shape';
import SphericalPanorama from '@giro3d/giro3d/entities/SphericalPanorama';
import Inspector from '@giro3d/giro3d/gui/Inspector';
import AggregatePointCloudSource from '@giro3d/giro3d/sources/AggregatePointCloudSource';
import COPCSource from '@giro3d/giro3d/sources/COPCSource';
import StaticImageSource from '@giro3d/giro3d/sources/StaticImageSource';

import { makeColorRamp } from './widgets/makeColorRamp';
import StatusBar from './widgets/StatusBar';

async function main() {
    const crs = CoordinateSystem.register(
        'EPSG:2154',
        '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
    );

    const instance = new Instance({
        backgroundColor: null,
        target: 'view',
        crs,
    });

    instance.renderingOptions.enableEDL = true;

    const datasets = [
        'LHD_FXX_0651_6862_PTS_O_LAMB93_IGN69.copc.laz',
        'LHD_FXX_0652_6863_PTS_O_LAMB93_IGN69.copc.laz',
        'LHD_FXX_0652_6862_PTS_O_LAMB93_IGN69.copc.laz',
        'LHD_FXX_0651_6863_PTS_O_LAMB93_IGN69.copc.laz',
    ];

    const server = 'https://3d.oslandia.com/giro3d/pointclouds/lidarhd/paris/';

    const source = new AggregatePointCloudSource({
        sources: datasets.map(dataset => new COPCSource({ url: server + dataset })),
    });

    const pointCloud = new PointCloud({
        source,
    });

    await instance.add(pointCloud);

    const colorMap = new ColorMap({
        colors: makeColorRamp('portland'),
        min: 10,
        max: 150,
    });

    pointCloud.setActiveAttribute('Z');
    pointCloud.setAttributeColorMap('Z', colorMap);

    instance.view.goTo(pointCloud);

    const controls = new MapControls(instance.view.camera, instance.domElement);

    instance.view.setControls(controls);

    Inspector.attach('inspector', instance);

    StatusBar.bind(instance);

    const centerLat = 48.85471;
    const centerLon = 2.34725;
    const aoi = Extent.fromCenterAndSize(
        CoordinateSystem.epsg4326,
        { x: centerLon, y: centerLat },
        0.3,
        0.3,
    );

    const items = await fetch(
        `https://api.panoramax.xyz/api/search?bbox=${aoi.minX},${aoi.minY},${aoi.maxX},${aoi.maxY}&limit=500`,
    );
    const json = await items.json();

    const locations = new Shape({
        color: '#8ff0a4',
        vertexRadius: 5,
        showLine: false,
        borderWidth: 1,
    });

    const points = [];

    for (let i = 0; i < json.features.length; i++) {
        const feature = json.features[i];
        const [lon, lat] = feature.geometry.coordinates;
        const ALTITUDE = 40;
        const position = Coordinates.WGS84(lat, lon, ALTITUDE).as(crs).toVector3();
        points.push(position);
    }

    locations.setPoints(points);

    await instance.add(locations);

    const selectedPoint = new Shape({
        color: '#efca81',
        vertexRadius: 7,
        showLine: false,
        borderWidth: 1,
    });

    selectedPoint.renderOrder = 999;

    await instance.add(selectedPoint);

    selectedPoint.visible = false;

    const tmpVec2 = new Vector2();

    const panoramaxImages = new Array(json.features.length);

    async function loadImage(url, position, hfov, vfov, heading, pitch, roll) {
        const minX = -hfov / 2;
        const maxX = +hfov / 2;
        const minY = -vfov / 2;
        const maxY = +vfov / 2;

        const extent = new Extent(CoordinateSystem.equirectangular, {
            minX,
            maxX,
            minY,
            maxY,
        });

        const imageSource = new StaticImageSource({
            source: url,
            extent,
        });

        const entity = new SphericalPanorama({
            radius: 50000,
            backgroundColor: null,
        });

        await instance.add(entity);

        await entity.addLayer(
            new ColorLayer({
                source: imageSource,
            }),
        );

        entity.object3d.position.copy(position);
        entity.object3d.updateMatrixWorld(true);
        entity.setOrientation({ heading, pitch, roll });
    }

    const loadPanoramaxImage = (index, position) => {
        if (panoramaxImages[index] != null) {
            return;
        }

        const feature = json.features[index];
        const [w, h] = feature.properties['pers:interior_orientation'].sensor_array_dimensions;
        const hfov = feature.properties['pers:interior_orientation'].field_of_view ?? 360;
        const vfov = hfov * (h / w);
        console.log(feature);
        const url = feature.assets.hd.href;
        const heading = feature.properties['view:azimuth'] ?? 0;
        const pitch = feature.properties['pers:pitch'] ?? 0;
        const roll = feature.properties['pers:roll'] ?? 0;

        loadImage(url, position, hfov, vfov, heading, pitch, roll);
    };

    const getPointIndexFromMouseEvent = e => {
        const canvasCoordinate = instance.eventToCanvasCoords(e, tmpVec2);
        const picked = locations.pick(canvasCoordinate);

        if (picked != null && picked.length > 0) {
            const index = picked[0].pickedVertexIndex;
            if (index) {
                return index;
            }
        }

        return null;
    };

    instance.viewport.addEventListener('mousedown', e => {
        const index = getPointIndexFromMouseEvent(e);

        if (index) {
            const location = locations.points[index];
            loadPanoramaxImage(index, location);
        }
    });

    instance.viewport.addEventListener('mousemove', e => {
        const index = getPointIndexFromMouseEvent(e);

        if (index) {
            const location = locations.points[index];
            selectedPoint.setPoints([location]);
        }

        selectedPoint.visible = index != null;
    });
}

main().catch(console.error);
