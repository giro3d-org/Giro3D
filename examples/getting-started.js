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

import TileWMS from 'ol/source/TileWMS.js';
import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import BilFormat from '@giro3d/giro3d/formats/BilFormat.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

import StatusBar from './widgets/StatusBar.js';

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
// [`TiledImageSource`](../apidoc/classes/sources.TiledImageSource.html) for that.
// This source will wrap an OpenLayers source, in this case a `TileWMS`.
const satelliteSource = new TiledImageSource({
    source: new TileWMS({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:3946',
        params: {
            LAYERS: ['ORTHOIMAGERY.ORTHOPHOTOS'],
            FORMAT: 'image/jpeg',
        },
    }),
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
const demSource = new TiledImageSource({
    source: new TileWMS({
        url: 'https://data.geopf.fr/wms-r',
        projection: 'EPSG:3946',
        crossOrigin: 'anonymous',
        params: {
            LAYERS: ['ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES'],
            FORMAT: 'image/x-bil;bits=32',
        },
    }),
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

// ### Set the camera and navigation controls

// Giro3D uses the THREE.js controls to navigate in the scene. In our example, we are going to use
// the `MapControls`, which are perfectly adapted to our need.

// Let's get the THREE camera of our scene.
const camera = instance.view.camera;

// Let's specify the camera position. We will position it in the southwest corner of the map, at an
// altitude of 2000 meters.
const cameraAltitude = 2000;

const cameraPosition = new Vector3(extent.minX, extent.minY, cameraAltitude);

camera.position.copy(cameraPosition);

// Now we can create the `MapControls` with our camera and the DOM element of our scene.
const controls = new MapControls(camera, instance.domElement);

// Let's set the controls' target to our map center.
controls.target = extent.centerAsVector3();

// And specify some parameters for the navigation.
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.maxPolarAngle = Math.PI / 2.3;

controls.saveState();

// Now let's register those controls with the instance. The instance will automatically register
// the event handlers relevant to the navigation in the scene.
instance.view.setControls(controls);

// ### Optional: Set up the inspector

// This is an optional step, but very useful for diagnostic and debugging issues with Giro3D.
// The `Inspector` is a panel containing lots of useful information about the Giro3D instance.

// This supposes that we have a `div` ready to host our inspector.

Inspector.attach('inspector', instance);

// ### The StatusBar

// This widget is no part of the Giro3D library, but is used in the examples
// to display various informations about the scene, such as the geographic
// coordinates of the mouse cursor.

// Let's initialize the coordinate bar widget on our instance.
StatusBar.bind(instance);

// ### Moving around

// Use the mouse the navigate in the scene and observe the map updating with fresh data.

// [See the final result](../examples/getting-started.html).
