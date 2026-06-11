/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

// # Giro3D - Getting started

// ### Welcome to Giro3D !

// In this tutorial, we will cover the base features of Giro3D : the creation of the
// [instance](../apidoc/classes/core.Instance.html), the creation of a
// [map](../apidoc/classes/entities.Map.html), and setting up the navigation controls.

// ##### Note
// This walkthrough is based on the [2.5D Map example](../examples/getting-started.html).
// Feel free to visit this example to see the final result of this tutorial.

import GeoJSON from 'ol/format/GeoJSON.js';
import { tile } from 'ol/loadingstrategy.js';
import VectorSource from 'ol/source/Vector.js';
import { createXYZ } from 'ol/tilegrid.js';
import { Vector3 } from 'three';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import WmsSource from '@giro3d/giro3d/sources/WmsSource.js';

// Setup our json loader so we can read the geodata and animate the camera
const loadJson = (path, doThen) => {
    fetch(path)
        .then(response => response.json()) // Parse JSON
        .then(doThen);
};

// ### Initialization of the Giro3D instance

// Before creating our map, we must setup Giro3D in our page, by creating an instance.

// The instance is the entry point of a Giro3D context. It needs a DOM element to render its scene.

// #### Register the custom CRS

// Our map uses the [EPSG:3946](https://epsg.io/3946) French coordinate reference system (CRS) that
// is not built-in into Giro3D's CRS registry.

// ####
// Let's register a definition for this CRS. The definition is taken from https://epsg.io/3946.proj4.
const crs = CoordinateSystem.register(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

// Now we are ready to create our instance. Note that the `crs` parameter is necessary to determine
// the interpretation of coordinates from the 3D scene.
// We will use the `view` element from our HTML page to initialize the instance.
const instance = new Instance({
    target: 'view',
    crs,
});

// ### Create the Map

// Let's create a map of the city of [Lyon](https://en.wikipedia.org/wiki/Lyon), with satellite
// imagery and a digital elevation model (DEM).

// #### Specify the map extent

// A map is a rectangular region of the world that will contain geographic data.

// Let's define a geographic extent (or bounding box) of our map.
// We initialize the [`Extent`](../apidoc/classes/core.geographic.Extent.html) class,
// specifying the CRS name (that we just defined above), with the minimum and maximum X (longitude,
// or easting) and Y (latitude, or northing) values.
const xmin = 1837816.94334;
const xmax = 1847692.32501;
const ymin = 5170036.4587;
const ymax = 5178412.82698;

const extent = new Extent(crs, xmin, xmax, ymin, ymax);

// #### Create the Map object

// Now we can create the Map. The only mandatory parameter is the extent
// but you can experiment with the other options if you'd like.
const map = new Map({ extent });

// Let's add the map to the instance.
instance.add(map);

// #### Create the color layer

// If we looked at the page now, the map would be rendered as a colored rectangle.
// This is the aspect of the map without any data in it (only the background color).
// Nothing very exciting.

// Let's add a color layer.

// In Giro3D, layers are the basic components of the Map. They can be either a color layer,
// or an elevation layer. In both cases, the data comes from a source.

// ##### Specify the data source

// Let's create a source that will pull data from a WMS service.
// We are using the
// [`WmsSource`](../apidoc/classes/sources.WmsSource.html) for that.
const satelliteSource = new WmsSource({
    url: 'https://data.geopf.fr/wms-r',
    projection: 'EPSG:3946',
    layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
    imageFormat: 'image/jpeg',
});

// ##### Create the layer

// Now we can create the layer. Note that we specify an extent for the layer. This is not
// strictly required, but since our map is much smaller than the WMS source, we want to avoid
// processing data that is outside our layer.
const colorLayer = new ColorLayer({
    name: 'satellite',
    source: satelliteSource,
    extent: map.extent,
});

// And add it to the map.
map.addLayer(colorLayer);

// Note: `addLayer()` is an asynchronous method, because the layer must be prepared before being
// ready for rendering. We could use the returned promise to wait for the end of the preprocessing
// step, but we don't need that in our example.

// #### Creation of the elevation layer

// Creating an elevation layer is a very similar process to the color layer : we initialize the
// source, then create the layer and add it to the map.

// The only difference is that we are going to use an
// [`ElevationLayer`](../apidoc/classes/core.layer.ElevationLayer.html).

// Contrary to the color layer, the elevation layer does not produce any color information on the
// map, but it rather deforms the map to display the terrain (hence the name 2.5D map).

// Let's create a WMS source for this layer.
const demSource = new WmsSource({
    layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
    imageFormat: 'image/x-bil;bits=32',
    url: 'https://data.geopf.fr/wms-r',
    projection: 'EPSG:3946',
    format: new BilFormat(),
    noDataValue: -1000,
});

// Then create the elevation layer.
// We have set the resolution factor to 1/8th of the resolution
// of each map tile, because we are not going to display the pixels
// of the layer, but rather use the elevation data to deform the
// terrain mesh. Since the terrain mesh has a much lower resolution
// than the terrain textures, we don't want to waste resources.
const elevationLayer = new ElevationLayer({
    name: 'dem',
    resolutionFactor: 1 / 8,
    extent: map.extent,
    source: demSource,
});

// ##### Add the layer

// Now we are ready to add our layer to the map.
map.addLayer(elevationLayer);

// ### Optional: Set up the inspector

// This is an optional step, but very useful for diagnostic and debugging issues with Giro3D.
// The `Inspector` is a panel containing lots of useful information about the Giro3D instance.

// This supposes that we have a `div` ready to host our inspector.

Inspector.attach('inspector', instance);

// Lets make the path show up in the scene, we can easily display a Geo LineString using a FeatureCollection,
// which takes in an OpenLayers VectorSource. That is easily done by passing the URL of our Geojson to it.
// It even supports a Z component as altitude!
const pathSource = new VectorSource({
    format: new GeoJSON(),
    url: 'data/flight_path.geojson',
    strategy: tile(createXYZ({ tileSize: 512 })),
});

// Pass the VectorSource into the FeatureCollection.
const featureCollection = new FeatureCollection({
    source: pathSource,
    dataProjection: instance.coordinateSystem,
    extent,
    minLevel: 0,
    maxLevel: 0,
    style: feature => {
        return {
            stroke: { color: 'yellow', lineWidth: 2 },
        };
    },
});

instance.add(featureCollection);

// Finally start loading our path data.
loadJson('data/path.geojson', json => {
    const POINTS = json.geometry.coordinates;
    // To make movements smoother, let's make use of Cubic-Hermite splines.
    const samplePath = t => {
        if (typeof t !== 'number' || isNaN(t)) {
            t = 0;
        }

        const p0 = Math.floor(t);
        const p1 = (p0 + 1) % POINTS.length;
        const p2 = (p0 + 2) % POINTS.length;
        const p3 = (p0 + 3) % POINTS.length;

        t = t - Math.floor(t);
        const t2 = t * t;
        const t3 = t2 * t;

        const q0 = -t3 + 2.0 * t2 - t;
        const q1 = 3.0 * t3 - 5.0 * t2 + 2.0;
        const q2 = -3.0 * t3 + 4.0 * t2 + t;
        const q3 = t3 - t2;

        const pq0x = POINTS[p0][0] * q0 * 0.5;
        const pq1x = POINTS[p1][0] * q1 * 0.5;
        const pq2x = POINTS[p2][0] * q2 * 0.5;
        const pq3x = POINTS[p3][0] * q3 * 0.5;
        const pq0y = POINTS[p0][1] * q0 * 0.5;
        const pq1y = POINTS[p1][1] * q1 * 0.5;
        const pq2y = POINTS[p2][1] * q2 * 0.5;
        const pq3y = POINTS[p3][1] * q3 * 0.5;
        const pq0z = POINTS[p0][2] * q0 * 0.5;
        const pq1z = POINTS[p1][2] * q1 * 0.5;
        const pq2z = POINTS[p2][2] * q2 * 0.5;
        const pq3z = POINTS[p3][2] * q3 * 0.5;

        return [pq0x + pq1x + pq2x + pq3x, pq0y + pq1y + pq2y + pq3y, pq0z + pq1z + pq2z + pq3z];
    };

    // Since cubic splines are not constant rate, we need to evenly space
    // the steps, unfortunately there is no way to do this analytically so
    // we take a fixed amount of samples.
    const SAMPLE_SIZE = 0.005;
    const STEP = 0.0002;
    const buildSegments = () => {
        let segments = [];
        let remainingLength = 0.0;
        for (let i = 0.0; i < POINTS.length - SAMPLE_SIZE; i += SAMPLE_SIZE) {
            const xyz1 = samplePath(i);
            const xyz2 = samplePath(i + SAMPLE_SIZE);
            const dx = xyz2[0] - xyz1[0];
            const dy = xyz2[1] - xyz1[1];
            const dz = xyz2[2] - xyz1[2];
            const seglen = Math.sqrt(dx * dx + dy * dy + dz * dz);
            remainingLength += seglen;
            if (remainingLength >= STEP) {
                segments.push(i);
                remainingLength -= STEP;
            }
        }
        return segments;
    };
    let segments = buildSegments();
    const sampleSegment = alpha => {
        const x = alpha * (segments.length - 1);
        const bottom = Math.floor(x) % segments.length;
        const top = (bottom + 1) % segments.length;

        const bx = segments[bottom];
        const tx = segments[top];

        const frac = x - Math.floor(x);
        const simfrac = 1.0 - frac;

        const xyzb = samplePath(bx);
        const xyzt = samplePath(tx);

        // Calculate final coordinates, so these can be used as world-space
        // coordinates for THREE (index 0).
        const finalX = xyzb[0] * simfrac + xyzt[0] * frac;
        const finalY = xyzb[1] * simfrac + xyzt[1] * frac;
        const finalZ = xyzb[2] * simfrac + xyzt[2] * frac;

        return {
            coordinates: new Coordinates(CoordinateSystem.epsg4326, finalX, finalY).as(
                instance.coordinateSystem,
            ),
            z: finalZ, // Z is just altitude, no special coordinate
        };
    };

    // Set up the game loop, so we can animate the camera
    // We can use `requestAnimationFrame` to trigger an infinite update loop
    // and use the `time` parameter to get the current time in milliseconds,
    // which we will use to compute the frame time.

    const ANIMATION_DURATION_S = 120.0;
    let oldTime = 0.0;
    let animationAlpha = 0.0;
    const loop = time => {
        const frameTime = (time - oldTime) / 1000.0;
        oldTime = time;

        // Sample the position
        const cameraPoint = sampleSegment(animationAlpha);

        // To make things interesting, lets make it always look at the centre of the world.
        let centre = extent.centerAsVector3();
        centre.z = -200.0;

        // Let's get the THREE camera of our scene.
        const camera = instance.view.camera;
        camera.position.set(cameraPoint.coordinates.x, cameraPoint.coordinates.y, cameraPoint.z);
        camera.lookAt(centre);
        camera.updateMatrixWorld();

        // We must manually trigger the instance update, and pass the camera
        // to let it know that the visible parts of the map may have changed.
        // If we don't pass the camera as a parameter, parts of the map will
        // not load properly once the camera moves.
        instance.notifyChange(camera);

        // advance the animation
        animationAlpha += frameTime / ANIMATION_DURATION_S;

        // Continue requesting the next frame.
        requestAnimationFrame(loop);
    };

    // Finally, begin the update loop.
    requestAnimationFrame(loop);
});