<div align="center">
  <a href="https://giro3d.org">
    <img alt="Giro3D logo" src="/images/giro3d_logo.svg">
  </a>
</div>

## Introduction

Welcome to the API documentation of Giro3D.

➡️ If you are looking for an interactive tutorial, please look at the [getting started](../tutorials/getting-started.html) page instead.

Here is a brief overview of the main concepts behind Giro3D.

## About this documentation

This documentation is licensed under the [Creative Commons BY SA](https://creativecommons.org/licenses/by-sa/4.0/).

## Instance

The [`Instance`](./classes/core.Instance.html) is the entry point of a Giro3D context. It contains [**entities**](./modules/entities.html) that represent dynamically updated objects and make the most of a Giro3D scene. Each instance is hosted by a DOM element (a `<div>`) that will contain the `<canvas>` used to render the scene.

```js
const instance = new Instance({
    target: 'giro3d-view', // The id of the <div> that will contain the Giro3D instance
});
```

Under the hood, Giro3D uses three.js to render the scene. To directly access the three.js scene, you can use the [`scene`](./classes/core.Instance.html#scene) property.

To add an entity to the instance, use the [`Instance.add()`](./classes/core.Instance.html#add) method. Note that this method should also be used to add a regular three.js [`Object3D`](https://threejs.org/docs/?q=obje#api/en/core/Object3D)s as well.

💡 You can have multiple instances in the same web page, as long as each of them has its own canvas.

### The main loop

Contrary to many video games or other interactive applications, Giro3D updates its state and renders the scene to the canvas **only when notified**, instead of periodically (for example 60 times per second). Many classes in Giro3D notify the instance when something has changed (mainly entities), but not all changes can be detected by Giro3D. The rationale is to save CPU and GPU cycles, as well as power on mobile devices.

💡 To manually trigger an Instance update, you can use the [`Instance.notifyChange()`](./classes/core.Instance.html#notifyChange) method. This is useful when the state of the scene has changed in a way that Giro3D cannot detect:

```js
const instance = new Instance(...);

// Do something that Giro3D cannot detect, such as changing a CSS style.

// Make sure that Giro3D is notified.
instance.notifyChange();
```

## Entities

[Entities](./modules/entities.html) are the first-class citizens in Giro3D. Each entity manages a collection of renderable objects, and is responsible for their life cycle. The root 3D object of the entity can be accessed through the [object3d](./classes/entities.Entity3D.html#object3d) accessor.

For example, the [`Map`](./classes/entities.Map.html) entity represents a 2D or 2.5D surface split into hierarchical tiles.

💡 To implement your own renderable entity, create a subclass of the [`Entity3D`](./classes/entities.Entity3D.html) class:

```js
class MyCustomEntity extends Entity3D {
    constructor() {
        super(new THREE.Group());
    }
}
```

## The `progress` and `loading` properties

Various classes in Giro3D provide the `progress` and `loading` API. This API can be used to determine if the object is currently performing asynchronous operations.

- `loading` is a boolean that indicates whether the object is currently performing an asynchronous task.
- `progress` is a number (between zero and one) that indicates the percentage of progress of the tasks this object is performing.

💡 To implement this interface on your own classes, you can use the [`OperationCounter`](./classes/core.OperationCounter.html) class.

## Memory management

Most objects in Giro3D are automatically managed by the garbage collector, ensuring that no memory leak happens.

However, some objects, such as three.js [textures](https://threejs.org/docs/?q=texture#api/en/textures/Texture), must be manually disposed. In this case, refer to the relevant documentation to determine if the object is manually managed.

💡 three.js's [`WebGLRenderer`](https://threejs.org/docs/index.html?q=webglrenderer#api/en/renderers/WebGLRenderer.info) has an `info` property that returns the number of unmanaged resources in GPU memory. You can access this renderer from the `Instance` using the [`renderer`](./classes/core.Instance.html#renderer) property.

## Coordinate systems

Giro3D can combine many different coordinate systems (CRS):

- The `Instance` has its own coordinate system, accessible from the [`coordinateSystem`](./classes/core.Instance.html#coordinateSystem) property. Once specified in the `Instance` constructor, this cannot be changed.

- Some entities supports various CRS transformations, while others only supports a single CRS (of their data source). In the latter case, this CRS must be compatible with referenceCRS to be displayed correctly.

### Register a custom CRS

To display a Giro3D scene in a specific coordinate system, you must first register its definition with the [`CoordinateSystem.register()`](./classes/core.geographic.CoordinateSystem.html#register) static method.

For example, to display the scene in the [`TM65 / Irish Grid -- Ireland`](https://epsg.io/29902) CRS (EPSG:29902), we must register it with the following parameters:

```ts
const crs = CoordinateSystem.register(
    'EPSG:29902',
    '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +a=6377340.189 +rf=299.3249646 +towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 +units=m +no_defs +type=crs',
);
```

💡 Some CRS definitions do not need to be registered as they are already built-in: `EPSG:4326`, `EPSG:3857`, `EPSG:4978` and `EPSG:4979`.

💡 CRS registration must be performed before any entity is added to the instance.

❗ In some (rare) cases, the CRS in the proj format is incomplete. In this case, you can try using the WKT format instead:

```ts
CoordinateSystem.register(
    'EPSG:29902',
    `PROJCS["TM65 / Irish Grid",
        GEOGCS["TM65",
            DATUM["TM65",
                SPHEROID["Airy Modified 1849",6377340.189,299.3249646],
                TOWGS84[482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15]],
            PRIMEM["Greenwich",0,
                AUTHORITY["EPSG","8901"]],
            UNIT["degree",0.0174532925199433,
                AUTHORITY["EPSG","9122"]],
            AUTHORITY["EPSG","4299"]],
        PROJECTION["Transverse_Mercator"],
        PARAMETER["latitude_of_origin",53.5],
        PARAMETER["central_meridian",-8],
        PARAMETER["scale_factor",1.000035],
        PARAMETER["false_easting",200000],
        PARAMETER["false_northing",250000],
        UNIT["metre",1,
            AUTHORITY["EPSG","9001"]],
        AXIS["Easting",EAST],
        AXIS["Northing",NORTH],
        AUTHORITY["EPSG","29902"]]`,
);
```

### Maps and layers

The [`Layer`](./classes/core.layer.Layer.html) class supports transformation of data from their source CRS (the one in the [`ImageSource`](./classes/sources.ImageSource.html)) to the Instance CRS.

💡 All CRSes used by layers must be registered with [`CoordinateSystem.register()`](./classes/core.geographic.CoordinateSystem.html#register) as well.

### Other entities

Except otherwise specified, entities do not support transformation of data from their source into the Instance CRS. This means that it is not possible to display a point cloud that is in a different CRS than the instance's.
