# Changelog

## v0.43.0 (2025-04-08)

This release brings two major new feature: globes and panoramic images.

### Globes

It is now possible to create globe maps with the `Globe` entity. Each globe can be initialized with a custom `Ellipsoid` (or use the default WGS 84 ellipsoid). It is possible to have multiple globes in the same scene, and move/rotate them freely (for example to create a simulation of the solar system). The APIs of Globes is exactly the same as the one for `Map`, with the exception that it is not possible to set the extent of the globe (it will use the entire globe surface).

The coordinate system to use for a globe scene is `EPSG:4978`:

```js
const instance = new Instance({
    target: 'view',
    crs: 'EPSG:4978',
});
```

### Atmosphere, sky dome, glow

To enhance rendering of globes, you can use the `Atmosphere` entity to add an atmosphere effect. Note that this entity does not require a `Globe` to work, and it can be used for example on the Google Photorealistic 3D Tiles tileset.

The `Glow` entity creates a glow effect around the ellipsoid. Useful for light-emitting globes, such as the sun.

The `SkyDome` entity represents the atmospheric dome as seen from the surface of the earth (or any other planet).

## Spherical panoramas

Another major feature is the support for spherical panoramic images with the `SphericalPanorama` entity. This entity shares the same API as `Map` (with the exception of elevation layers), meaning we can add as many color layers (for example, stacking panoramic images for comparison).

Here is an example on how to load a simple panoramic image:

```js
const panorama = new SphericalPanorama();

const layer = new ColorLayer({
    source: new StaticImageSource({
        source: 'https://3d.oslandia.com/giro3d/images/panorama.jpg',
        // Since the image is covering the entire sphere, we must express the extent as such
        extent: Extent.fullEquirectangularProjection,
    }),
});

panorama.addLayer(layer);

instance.add(panorama);
```

### BREAKING CHANGE

- The crs name for `COPCSource` and `LASSource` can now be something else than an authority code,
  if there is not authority in the WKT string
  (i.e it can now be be "RGF93 v1 / Lambert-93 -- France" rather than "EPSG:2154").
- `Instance.focusObject()` is removed. Use `View.goTo()` instead.
    ```js
    instance.view.goTo(myEntity);
    ```
- the `View` constant `DEFAULT_MAX_NEAR_PLANE` is renamed `DEFAULT_MAX_FAR_PLANE`
- The default attribute mapping for point cloud `Tiles3D` has changed. Before, the attribute name for the point classification was "Classification" (upper case "C"), and point intensity was "Intensity" (upper case "I"). They are now "classification" and "intensity" (all lowercase). Use the `pointCloudAttributeMapping` constructor option to specify how to map batch table attributes with well-known attributes expected by Giro3D.
    ```js
    const pointcloud = new Tiles3D({
        url,
        pointCloudAttributeMapping: {
            classification: 'Classification',
            intensity: 'MyCustomAttribute',
        },
    });
    ```
- `Map.terrain.enableCPUTerrain` is removed as CPU
  terrain mesh computation is now mandatory.
- The `segments` parameter of the map constructor is moved to the `terrain`
  parameter:
    ```js
    const map = new Map({
        extent,
        terrain: {
            segments: 16,
        },
    });
    ```

### Feat

- add `Globe` entity (#424)
- add `SphericalPanorama` entity (#504)
- add `Atmosphere`, `SkyDome` and `Glow` entities
- **Extent**: add `contains()` method
- **Extent**: add `sampleUV()` method
- **Extent**: add equirectangular projection and photo-sphere utility methods
- **View**: add support for point of views (#125)
- **FeatureCollection**: add `.castShadow` and `.receiveShadow` properties
- **Tiles3D**: allow providing a custom mapping for attribute names (#576)
- **Map**: add support for side skirts (#551)
- **controls**: add `GlobeControls`
- **Ellipsoid**: add `Ellipsoid` class

### Fix

- **COPCSource|LASSource**: retrieve CRS name instead of authority code (#582)
- **Layer**: apply default texture to node every time it is processed
- **LayerComposer**: don't render empty textures
- **LayerComposer**: improve computeRenderOrder()
- **Layer**: use the source extent as fallback when constructing the LayerComposer
- **ComposerTileMaterial**: improve readability of tile outlines
- **VectorTileSource**: avoid getting stuck while loading tiles (#584)
- **StaticImageSource**: implement adjustExtentAndPixelSize() that does nothing
- **Map**: fix incorrect root tile positioning when transform is not identity
- **FirstPersonControls**: move along the camera up vector rather than the scene's Z axis
- **View**: rename `DEFAULT_MAX_NEAR_PLANE` -> `DEFAULT_MAX_FAR_PLANE`
- **FeatureCollection**: rebuild mesh if extrusion offset / elevation changes (#348)
- **FeatureCollection**: handle sources without loaders
- **DrawTool**: fix `onAbort` never called when abort controller is aborted

## v0.42.3 (2025-03-18)

### Feat

- **Instance**: raise an event when it is disposed

### Fix

- **Layer**: immediately update the material after the default texture is applied (#578)
- **Shape**: handle tessellation of vertical polygons (#574)
- **Tiles3D**: limit sharing resources in the same Instance (#575)

## v0.42.2 (2025-03-07)

### Fix

- **PickObjectsAt**: add option to provide custom raycaster (#572)

## v0.42.1 (2025-02-19)

This hotfix release updates [`copc`](https://www.npmjs.com/package/copc) to 0.0.8 to avoid the Content Security Policy violation described in #561.

## v0.42.0 (2025-02-10)

### Improved 3D Tiles support

This release integrates the `3d-tiles-renderer` package into Giro3D. This enables a much better support for the 3D Tiles format, including the 3D Tiles 1.1 specification. This makes it very easy to load [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles) into Giro3D !

### Cast shadows and dynamic lighting in Maps

Maps now support light-based shadows and lighting provided by [three.js lights](https://threejs.org/docs/index.html?q=light#api/en/lights/Light), in addition to the hillshade mode (which is still the default mode). When using this mode, the terrain is shaded by all directional and point lights in the scene. This allows for light-based simulations such as sun shadows for a given time of day for example.

### BREAKING CHANGE

- Map lighting and shading options have changed:

    - Map lighting options are now under `entities/` rather than `core/`
    - Map lighing options are renamed `MapLightingOptions`
    - Hillshade specific lighting options are prefixed `hillshade` (e.g
      `hillshadeAzimuth`, `hillshadeIntensity`...)

- The `Tiles3D` entity's API has changed and the
  `Tiles3DSource` class is removed. Please refer to the API documentation
  for more information.
- The `ColorMap` constructor now uses named parameters
  rather than positional parameters, i.e `new ColorMap({ colors, min, max })`
- `ColorMap` and `ColorMapMode` are moved from `/core/layer/` into `/core` since they don't apply only to layers.

### Feat

- **Map**: support light-based lighting and shadows (#502, #443)
- **Sun**: add functions to compute the position of sun
- **AxisGrid**: support adaptive labels (#555)
- **AxisGrid**: add `"label-created"` event to customize the DOM label after creation
- **ColorMap**: add `.clone()` method
- **Tiles3D**: replace underlying implementation with 3d-tiles-renderer (#191)
- **StatusBar**: add function to dynamically update attributions
- **FeatureCollection**: support shading through the style API
- **WmsSource**: add support for the .requestPriority constructor option (#305)
- **VectorTileSource**: add support for the .requestPriority constructor option (#305)
- **VectorSource**: add support for the .requestPriority constructor option (#305)
- **TiledImageSource**: add support for the .requestPriority constructor option (#305)
- **StaticImageSource**: add support for the .requestPriority constructor option (#305)
- **GeoTIFFSource**: add support for the .requestPriority constructor option (#305)
- **ImageSource**: support HTTP priorities (#305)
- **Fetcher**: support request priority (#305)
- **PointCloud**: add the `.brightness`, `.constrast` and `.saturation` properties

### Fix

- **GeoTIFFSource**: fix incorrect count of images (#568)
- **PointCloud**: clone the default ColorMap
- **PointCloudMaterial**: enable transparent flag if colormap has an opacity array (#559)
- **PointCloud**: compute the world matrix of the node before the bounding box (#556)
- **GeometryConverter**: support triangulation of vertical polygons (#544)

## v0.41.0 (2024-12-19)

This release brings support for LAS-based point clouds, such as LAS/LAZ files, COPC files and Potree 1 tilesets with LAZ tiles (not Potree 2.x tilesets however). Those data sources are now consumed by the new `PointCloud` entity. The new `AggregatePointCloudSource` allows users to display many point cloud datasets under a single entity.

The `DrawTool` is also improved with performance optimizations as well as better configurability.

### BREAKING CHANGE

- `PotreePointCloud` is removed. Use the `PointCloud`
  entity with a `PotreeSource` instead.
- `PotreeSource` constructor options have changed to match other
  point cloud sources.

### Feat

- **entities**: add `PointCloud` entity
- **sources**: add `PointCloudSource`
- **sources**: add `COPCSource` and `LASSource` (#292)
- **sources**: add `AggregatePointCloudSource`
- **DrawTool**: end drawing polygons when clicking on first point (#542)
- **DrawTool**: allow specifying end condition (#541)
- **Cache**: add `configure()` method (#545)

### Fix

- **PointCloudMaterial**: stop applying the offset scale from the layer
- **PointCloudMaterial**: don't dispose the colormap in the setter
- **ConstantSizeSphere**: honor camera zoom for size computation (#549)
- **DrawTool**: ensure that the new shape is immediately displayed (#547)
- **Inspector**: disable autocomplete on `<input>` elements (#526)
- **WorkerPool**: use a better metric to select the least busy worker
- **PickPointsAt**: remove limits on point count per mesh (#537)

### Refactor

- **PointCloudMaterial**: don't automatically update colormap uniforms
- **ColorMap**: dispose the cached texture as late as possible
- **PotreeSource**: migrate to new `PointCloud` entity
- **PickPointsAt**: improve readability of point picking logic

### Perf

- **DrawTool**: optimize edition by picking only shapes when possible (#548)
- **PointsVS.glsl**: add support for decimation
- **PointsFS.glsl**: avoid useless computations if point should be discarded
- **PointsFS.glsl**: use a square length computation instead of a length
- **View**: optimize performance of `isBox3Visible()` and `isSphereVisible()`

## v0.40.0 (2024-11-18)

This release mostly brings bugfixes and performance improvements, notably by using Web Workers for texture processing.

### BREAKING CHANGE

- The `GetElevationOptions`, `GetElevationResult` and
  `ElevationSample` types are moved from `entities` to `core` namespace.
  `ElevationSample.map` is renamed `ElevationSample.source` and its type
  is now `ElevationProvider`:
- The minimum supported OpenLayers version is 9.0.0.

### Feat

- add `ElevationProvider` interface (#519)
- **DrawTool**: add callbacks when a shape has been updated (#538)
- **Outliner**: add toggle to collapse an object's own hierarchy
- **Entity**: raise event when initialization is complete
- **OperationCounter**: increment() now takes optional count argument
- **OperationCounter**: add the wrap() method to wrap a promise in an increment/decrement pair
- **Inspector**: assign default names to entry by parsing the pascal case property names
- **Cache**: `set()` is now generic over the type of cached object
- **AxisGrid**: accept partial style definition

### Fix

- **DrawTool**: improve readability of edition marker for any background color
- **Shape**: ensure that `Vector3`s passed to the Shape are `clone()`d
- **DrawTool**: stop calling callbacks when edition is aborted (#539)
- **ColorLayer**: fix flickering when the source is synchronous (#525)
- **Tiles3D**: implement `getBoundingBox()` with the root tile's volume (#527)
- **ConstantSizeSphere**: fix incorrect size computation (#503)
- **TiledImageSource**: typo in projection not found error msg
- **Fetcher**: use exact same API as `fetch()` for all fetch functions
- **TileVS.glsl**: put neighbour textures in own array (#533)
- **Outliner**: use a step of 0.01 for `Vector3` controllers
- **ConstantSizeSphere**: ignore world scale (#532)
- **PointCloudMaterial**: fix incorrect support for logarithmic depth buffer
- **Instance**: honor entity parent when adding/removing (#531)
- **PickPointAt.ts**: use an explicit error message
- **PointCloud**: honor extent passed in constructor options
- **ColorMapInspector**: remove dependency to layer
- fix eslint issues raised by @typescript-eslint/strict-boolean-expressions
- **Map**: getElevation() automatically converts the coordinates to the correct CRS
- **HeightMap**: fix faulty boolean evaluation in `getMinMax()`

### Perf

- **Shape**: don't compute uncessary values in `computeArea()`
- **TiledImageSource**: use worker-accelerated image decoding
- **GeoTIFFSource**: use worker-accelerated texture processing
- **GeoTIFFFormat**: use worker-accelerated texture processing
- **TextureGenerator**: accelerate pixel buffer creation using workers
- **TextureGenerator**: perform blob decoding in worker by default
- **MapboxTerrainFormat**: perform image decoding in worker
- **FeatureCollection**: avoid using `Feature.setId()` (#543)
- **BilFormat**: perform processing in web worker
- **MapboxTerrainFormat**: perform decoding in web worker

## v0.39.0 (2024-09-03)

This release brings **color layer blending modes** as well as many fixes and API improvements.

### BREAKING CHANGE

#### Inspector

- `Panel.addController()` and `Panel.addColorController()` are now typechecked. The type parameter is no longer required and no longer points to the type of the bound parameter, but the type of the source object:

    ```js
    // Before
    this.addController < number > (source, 'propname');

    // Now
    this.addController(source, 'propname');
    ```

    If `source['propname']` does not exist, it will throw a compile-time error (if using TypeScript).

#### ImageSources

- `CogSource` is renamed to `GeoTIFFSource` for clarity.
  Other changes include types related to this source:

    - `CogCacheOptions` -> `GeoTIFFCacheOptions`
    - `CogSourceOptions` -> `GeoTIFFSourceOptions`

- `GeoTIFFSource.channels` setter now throws an exception if
  the input does not have a valid number of elements (1, 3 or 4 elements).

- `VectorSource`: The `data` parameter of `VectorSource` has changed to
  remove ambiguities between URLs and text data, and allow relative URLs.
  Please refer to the documentation for more details.

    For URL based sources:

    ```js
    // Before
    const source = new VectorSource({
        data: 'http://example.com/data.geojson',
        format: new GeoJSON(),
    });

    // Now
    const source = new VectorSource({
        data: {
            url: 'http://example.com/data.geojson',
            format: new GeoJSON(),
        },
    });
    ```

    For content based sources (e.g a GeoJSON document):

    ```js
    const geojson = JSON.parse(...);

    // Before
    const source = new VectorSource({
        data: geojson,
        format: new GeoJSON(),
    });

    // Now
    const source = new VectorSource({
        data: {
            content: geojson,
            format: new GeoJSON(),
        },
    });
    ```

#### `Map`

- The `doubleSided` parameter of the `Map` constructor is
  replaced by the `side` parameter, which is a value of type
  [`Side`](https://threejs.org/docs/index.html?q=material#api/en/constants/Materials)
  that can take 3 values: `FrontSide`, `BackSide` and `DoubleSide`.

#### `Instance`

- `Instance.useTHREEControls()` and `Instance.removeTHREEControls`
  are removed. To register controls, use `View.setControls()`:

    ```js
    // Before
    instance.useTHREEControls(myCustomControls);
    instance.removeTHREEControls();

    // Now
    instance.view.setControls(myCustomControls);
    instance.view.setControls(null);
    ```

- `Entity3D._instance` is now longer accessible from
  subclasses. Instead, use the getter `Entity.instance`. This property
  will throw an error if the entity is not initialized (yet). To check
  if the entity is initialized, use `Entity.ready`.

- The constructor of `Instance` now handles rendering
  options differently:

    - to specify the background color, use the `backgroundColor` property
      (previously named `clearColor`):

    ```js
    // Before
    new Instance({
        renderer: {
            clearColor: '#FF3020',
        },
    });

    // Now. Notice that `backgroundColor` is now at the root of the options
    new Instance({
        backgroundColor: '#FF3020',
    });
    ```

    - the `renderer` parameter of the constructor options is now either
      a `WebGLRenderer` or an object with renderer creation options. Providing
      a renderer is useful to integrate Giro3D in an existing application that
      creates its own THREE.js renderer:

    ```js
    // Before. Notice the awkward double `renderer` parameter.
    new Instance({
        renderer: {
            renderer: new WebGLRenderer(...),
        }
    })

    // Now. Notice that `renderer` is now at the root of the options.
    new Instance({
        renderer: new WebGLRenderer(...),
    })

    // Alternatively, let Giro3D create the renderer with the provided options
    new Instance({
        renderer: {
            logarithmicDepthBuffer: true,
        },
    })
    ```

- The constructor signature in `Instance` has changed.
  The first parameter `viewerDiv` is removed. Instead, use the `target`
  parameter in the `options` parameter:

    Before:

    ```js
    const div = document.getElementById('viewer');
    const instance = new Instance(div, { ... });
    ```

    After:

    ```js
    // Provide the element id
    const instance = new Instance({ target: 'viewer', ... });

    // Provide the element directly
    const div = document.getElementById('viewer');
    const instance = new Instance({ target: div, ... });
    ```

#### `Extent`

- `Extent.crs` is now a readonly accessor (previously a method):

    ```js
    const extent = new Extent('EPSG:3857', 0, 10, 10, 20);

    // Before
    const crs = extent.crs();

    // Now
    const crs = extent.crs;
    ```

- `Extent.west()`, `Extent.east()`, `Extent.south()` and
  `Extent.north()` are now accessors instead of methods:

    ```js
    // Before
    const west = extent.west();

    // Now
    const west = extent.west;
    ```

#### `Context`

- `Context` is now an interface
- `Context.instance` is removed.

#### `Cache`

- The values of `Cache` must be objects, they cannot be primitives or functions.

### Feat

- **DrawTool**: enable constraining edition to specified shapes (#511)
- **ColorLayer**: support various blending modes (#483)
- **Extent**: add shorthands for Web Mercator and EPSG:4326 bounds
- **ViewInspector**: add FOV slider
- **Map**: add the `.depthTest` property
- **Map**: support `Front`, `Back` and `DoubleSide` (#501)
- **Instance**: accept the `id` of the parent element (#497)
- **Inspector**: add a panel to draw shapes
- **FetcherPanel**: display total number of completed requests

### Fix

- **Map**: avoid dangerous recursion of tiles in some cases (#515)
- **DrawTool**: hide markers on exiting edit mode (#512)
- **Inspector**: typecheck bindings (#510)
- **RenderPipeline**: fix loss of antialiasing on enabling point cloud post-processing (#509)
- **StaticImageSource**: add missing `type` and `isStaticImageSource` properties
- **LayerComposer**: fix reprojection issues in some cases (#507)
- **FeatureCollection**: correctly honor render order specified by styles (#508)
- **VectorSource**: remove ambiguities in `data` parameter
- **StatusBar**: fix incorrect conversion to WGS84 coordinates
- **Layer**: use tighter epsilon for extent comparison when looking for a suitable ancestor
- **Outliner**: display lights in yellow
- **StatusBar**: fix incorrect access to view controls
- **MapInspector**: remove redundant renderOrder entry
- **Layer**: don't update non-visible layers
- **DrawTool**: fix missing `onTemporaryPointMoved` from API
- **ContourLineOptions**: color is now of type `ColorRepresentation`
- **Entity3D**: fix typing of setter for clipping planes
- **Shape**: mitigate jittering of surface mesh by having relative coordinates
- **DrawTool**: fix incorrect argument type for `createSegment()` and `createLineString()`
- **TiledImageSource**: stop logging HTTP errors
- **Tiles3dInspector**: update layer inspectors
- **Coordinates**: remove geocentric constraint when converting to `Vector2` or `Vector3` (#224)

### Refactor

- **View**: simplify frustum culling
- **View**: `isSphereVisible()` now takes an optional `matrixWorld` parameter
- **CogSource**: rename to `GeoTIFFSource` (#500)
- **Instance**: remove `useTHREEControls()` and `removeTHREEControls()`
- **entities**: initialize the `.instance` field with `initialize()`
- **Instance**: refactor `renderer` constructor option (#499)
- **Extent**: `crs()` is now an accessor (#498)
- **DebugSource**: make most parameters optional
- **Inspector**: accept the `id` of the parent element
- **Instance**: `add()` is now generic over the type of the added object
- **WmtsSource**: `matrixSet` is now optional
- **Inspector**: constructor now accepts an `HTMLElement`
- **VectorSource**: fix type of `style` parameter
- **Extent**: make `west()`, `east()`, `north()` and `south()` accessors
- **MainLoop**: remove `.gfxEngine` property
- **Context**: is now an interface
- **Cache**: fix invalid entry type
- **Fetcher**: use concrete `HttpError` class instead of interface
- **AxisGrid**: use `Coordinates.toVector2()` rather than `toVector3()` when not necessary

### Perf

- **TiledImageSource**: don't process transient requests

## v0.38.4 (2024-08-20)

### BREAKING CHANGE

- `Entity3D.getObjectToUpdateForAttachedLayers()` is
  removed. Entities are now responsible for updating their layers.
  This is typically done in the `postUpdate()` method.
- ImageFormat.decode() now takes two mandatory parameters
- the `MemoryUsage` has changed to avoid counting the
  same object twice.
- Coordinates.altitude is now a getter
- Entities now generate their ID.
- `Instance.camera` is renamed to `Instance.view`
- The `Camera` class is renamed to `View`
- The `.camera3D` property is renamed `.camera`
- `Map.materialOptions` is no longer exposed. Use
  individual accessors instead (`.hillshading`, `.terrain`, etc).

### Feat

- **MainLoop**: count frames
- **ViewInspector**: add button create frustum snapshots
- **Map**: expose subdivisionThreshold option in constructor

### Fix

- **Entity**: isEntity() accepts a nullish object
- **VectorSource**: getExtent() now longer throws
- **examples**: don't import from index.js files
- **VectorSource**: don't throw in getCrs()
- **Map**: the wireframe property now updates all existing tiles
- **Coordinates**: make altitude a getter
- **PointCloudMaterial**: create classification uniform on copy if necessary
- **bindColorPicker**: accept values of type ColorRepresentation
- **bindNumericalDropdown**: fix incorrect parsing of numerical values
- **Entity**: accept returning null in update()
- **giro3d_graticule_pars_fragment.glsl**: add smooth edges/antialiasing for graticule lines

### Refactor

- **Entity3D**: improve typing of traverseMaterials()
- **PointCloud**: add type parameter for material type
- reduce occurences of 'any'
- **View**: move isPerspectiveCamera and isOrthographicCamera to predicates.ts
- **TextureGenerator**: remove circular dependency to WebGLComposer
- **ImageFormat**: use true as const in isImageFormat flag
- don't import from index.ts files
- **predicates**: add more predicates
- **ImageFormat**: the options parameters is now mandatory
- **TextureGenerator**: remove NumberArray and use TypedArray instead
- **sources**: enable strict mode
- **MemoryUsage**: don't count the same object twice
- **c3DEngine**: getWindowSize() now takes an optional target
- **Map**: accept graticule color in ColorRepresentation rather than only Color
- **StatusBar**: don't throw error if target does not exist
- **Coordinates**: add EPSG:4979 to crsToUnit()
- **Entity**: automatically generate the ID (#492)
- **Instance**: rename `.camera` to `.view` (#491)
- **Map**: don't expose materialOptions and use accessors (#487)
- **EntityInspector**: make entity type a generic parameter

### Perf

- **MainLoop**: stop updating layers (#495)

## v0.38.5 (2024-08-20)

### Feat

- **Inspector**: display number of allocated WebGLPrograms in memory usage panel

### Fix

- **PointCloudMaterial**: create classification uniforms if not existing

### Perf

- **Capabilities**: cache max anisotropy value
- **TextureGenerator**: remove expensive and unused scaling option
- **Extent**: optimize .as() for speed and memory allocation
- **Layer**: don't apply a temporary default texture if source is synchronous

## v0.38.3 (2024-08-19)

This release fixes an issue related to colormap computation in layers that would happen in some rare cases.

### Fix

- **LayeredMaterial**: add missing `updateColorMap()` in `onBeforeRender()`
- **Layer**: remove immediate notification when target is painted

## v0.38.2 (2024-08-12)

This release brings performance improvements,and many fixes to layers.

### Feat

- **Layer**: `dispose()` can be called idempotently to free memory
- **SourceInspector**: add info for `VectorSource`
- **VectorSource**: add `featureCount` getter
- **MapInspector**: add emoji in front of layer name to see if layer is visible

### Fix

- **LayeredMaterial**: ignore non-visible layers for colormap atlas computation
- **VectorTileSource**: use `willReadFrequently: true` on canvas
- **LayeredMaterial**: reorder color layers on visibility change
- **LayeredMaterial**: remove useless `reorderLayers()` calls
- **LayeredMaterial**: ensure that the number of visible layers is properly updated
- **TiledImageSource**: remove warning-generating `needsUpdate` on texture
- **LayeredMaterial**: fix invalid layer ordering when a layer is added mid-lifetime
- **DebugSource**: assign consistent image IDs
- **RenderTargetPool**: fix memory leak
- **ComposerTileMaterial**: use `willReadFrequently: true` on grid canvas
- **DebugSource**: use `willReadFrequently: true` on canvas context
- **Layer**: fix possible null exception when looking for ancestor

### Perf

- **WebGLComposer**: simplify removing objects from the scene
- **Layer**: add support for synchronous image sources (#493)

## v0.38.1 (2024-08-08)

A minor release that brings performance improvements on layers and some fixes.

### Feat

- **VectorSource**: add `clear()` method to remove all features in the source
- **VectorSource**: add `removeFeature()` to remove a feature from the source
- **VectorSource**: add `addFeature()` and `addFeatures()` methods to add features
- **VectorSource**: add `updateFeature()` to repaint a subset of feature(s)
- **Map**: make outline color configurable
- **Outliner**: add option to hide non-visible objects
- **Outliner**: clearly identify the root objects of entities
- **Entity3D**: add a `'object-created'` event
- **Layer**: count number of paints of a given target

### Fix

- **GeometryConverter**: add missing handling of `renderOrder`
- **Outliner**: update existing objects without recreating the tree view
- **DrawTool**: ensure that rings remain closed after edition (#489)
- **Tiles3D**: fix bounding box display when we have a mesh transform
- **Tiles3D**: fix wireframe handling
- **entities**: don't swallow errors
- **FeatureCollection**: really call `onObjectCreated` on all created objects
- **Tiles3D**: take into account each mesh opacity
- **Tiles3D**: correctly handle errors
- **Tiles3dInspector**: support other materials than `PointCloudMaterial`

### Perf

- **Layer**: reduce latency of repaints by using an immediate notification
- **MainLoop**: allow immediate updates
- **Layer**: allow partial repaints (#488)

## v0.38.0 (2024-07-31)

This release brings many new features and improvements.

### Major changes

#### New `DrawTool` and the `Shape` entity

The [`DrawTool`](https://giro3d.org/latest/apidoc/classes/interactions.DrawTool.html) is completely rewritten. It now generates [`Shape`](https://giro3d.org/latest/apidoc/classes/entities.Shape-1.html) entities. Shapes are fully configurable entities that can display lines, points and surfaces, as well as various labels.

Shapes can display lengths, perimeters, areas, angles and heights with configurable formatters, and can be exported to GeoJSON.

👉 See the [`drawtool`](https://giro3d.org/latest/examples/drawtool.html) and [`digitizing`](https://giro3d.org/latest/examples/digitizing.html) examples for an illustration of the many capabilities of `DrawTool` and `Shape`.

💡 The `Shape` entity does not depend on the `DrawTool` to work and can be used completely independently.

#### Style API for `FeatureCollection`

`FeatureCollection` now supports a rich set of styles for points, surfaces and lines. Styles can be dynamically updated (for example to highlight a feature on hover).

The three supported styles are:

- [`PointStyle`](https://giro3d.org/latest/apidoc/types/core.features.PointStyle.html) to style symbols for Points and MultiPoints.
- [`FillStyle`](https://giro3d.org/latest/apidoc/types/core.features.FillStyle.html) to style surfaces of Polygons and MultiPolygons.
- [`StrokeStyle`](https://giro3d.org/latest/apidoc/types/core.features.StrokeStyle.html) to style lines of LineStrings, MultiLineStrings, Polygons and MultiPolygons.

👉 See

- the [`ign_data`](https://giro3d.org/latest/examples/ign_data.html) example for an illustration on how to create 3D buildings from 2D polygons,
- the [`undraped_vectors`](https://giro3d.org/latest/examples/undraped_vectors.html) example on how to apply dynamic styles on features depending on their attributes.

#### New layer source: `StaticImageSource`

This simple source draws a single image on an arbitrary extent. Useful to display static, non-georeferenced images.

👉 See the [`static_image_source`](https://giro3d.org/latest/examples/static_image_source.html) example to see it in action.

#### Handle WebGL context loss

The [WebGL2RenderingContext](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext) is used by Giro3D to draw the scene in to a `<canvas>`.

This context can be lost due to transient issues (GPU driver crash) or when the context runs out of memory.

Giro3D now correctly recovers and recreates the scene when the context is restored, thanks to the new [`RenderingContextHandler`](https://giro3d.org/latest/apidoc/interfaces/renderer.RenderingContextHandler.html) interface.

If you implement your own entity, be sure to implement this interface as well if your entity is sensitive to context losses (e.g an entity thats holds non-recoverable textures such as [`RenderTarget`](https://threejs.org/docs/index.html?q=renderta#api/en/renderers/WebGLRenderTarget)s.).

💡 If you want to be notified when the context is lost or restored, you can use the appropriate events on the DOM element:

```js
instance.domElement.addEventListener('webglcontextlost', ...);
instance.domElement.addEventListener('webglcontextrestored', ...);
```

### BREAKING CHANGE

- the styling API for the `FeatureCollection` entity has
  changed. See the documentation of `FeatureStyles` for more information.
- the `DrawTool` API has changed. It now produces `Shape`
  instances. The `Drawing` class is removed in favor of the `Shape` entity.

### Feat

- **FeatureCollection**: add style API (#370)
- **Instance**: `notifyChange()` now supports multiple sources
- **DrawTool**: rewrite `DrawTool` and introduce the `Shape` entity (!628)
- **sources**: add the `StaticImageSource` class (#481)
- **Instance** handle rendering context losses (#423)
- **LayerInspector**: display the layer's `.resolutionFactor`
- **MainLoop**: make clipping plane computation optional (#456)

### Fix

- **PointCloudMaterial**: fix missing texture coordinates in `MODE.TEXTURE` (#473)
- **LayerInspector**: make it compatible with the `Tiles3D` entity
- **Tiles3D**: fix invalid predicate handling in `getLayers()`
- **Map**: fix neighbour selection predicate (#475)

### Perf

- **Inspector**: use a recursive approach to determine if a given GUI is closed
- **Outliner**: use a hashing mechanism to avoid recreating the treeview every frame

## v0.37.3 (2024-07-01)

### Fix

- **TileMesh**: use sub-metric precision for heightmap sampling (#469)
- **Map**: fix ray/volume intersection test when scene transform is not default (#466)
- **Map**: ensure that newly created materials have the correct segments count (#470)

## v0.37.2 (2024-06-10)

Hotfix for the 0.37 release.

### Fix

- **VectorSource**: don't use a desynchronized canvas (#464)

## v0.37.1 (2024-06-10)

Hotfix for the 0.37 release.

### Fix

- **MaskLayer**: fix missing layer error in LayeredMaterial (#463)

## v0.37.0 (2024-06-05)

This release brings many improvements to point clouds: support for classification, intensity, and transparent colormaps.

### BREAKING CHANGE

- The `MapboxTerrainRGB` Interpretation is removed. To decode Mapbox Terrain RGB files, use the `MapboxTerrainFormat` image decoder instead. See this [example](https://giro3d.org/latest/examples/planar_mapbox.html).

    ```js
    // Before
    import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';

    const oldVersion = new ElevationLayer({
        // Using the interpretation in the layer
        interpretation: Interpretation.MapboxTerrainRGB,
        source: new TiledImageSource({
            source: new XYZ({ ... }),
        }),
    });
    ```

    ```js
    // After
    import MapboxTerrainFormat from '@giro3d/giro3d/formats/MapboxTerrainFormat.js';

    const newVersion = new ElevationLayer({
        source: new TiledImageSource({
            // Using the decoder in the source
            format: new MapboxTerrainFormat(),
            source: new XYZ({ ...}),
        }),
    });
    ```

### Feat

- **ColorMap**: support an optional opacity array (#454)
- **ColorMap**: add the `sample()` and `sampleOpacity()` methods.
- **PointCloudMaterial**: support intensity (#451)
- **PointCloudMaterial**: add support for colormaps (#449)
- add `MapboxTerrainFormat` to decode Mapbox Terrain images
- **PointCloud**: support classifications (#222)
- **PntsParser**: support batch table attributes

### Fix

- **WmsSource**: fix options precedence in constructor
- **TiledImageSource**: fix options precedence in constructor
- **CogSource**: fix options precedence in constructor
- **ElevationLayer**: fix options precedence in constructor
- **CogSource**: avoid huge texture sizes (#453)
- **Layer**: prevent assigning textures to a disposed node (#452)
- **TileVS.glsl**: set elevation to zero when no elevation layer is present
- **TextureGenerator**: fix incorrect memory usage computation for textures
- **MapTerrainPanel**: ensure that the displayed segment value is a power of two
- **ElevationLayer**: fix missing update of min/max when the layer is initialized
- **TileMesh**: ensure that min/max coming from heightmap is consistent
- **TileMesh**: fix incorrect reset of heightmap when no elevation texture has been loaded yet
- **LayerInspector**: use correct colorimetry object (layer instead of map)
- **Map**: enable display of elevation textures on iOS (#445)
- **Layer**: ensure that layers are always registered in the material (#462)
- **LayerComposer**: make `getMinMax()` ignore images that do not have a valid min/max (!638)

### Perf

- **TileMesh**: update heightmap only when actually necessary
- **Layer**: unload data for invisible ancestor nodes (#435)

## v0.36.0 (2024-05-21)

## Raycasting on maps

This release brings raycasting for the `Map` entity.

Previously, picking the map used GPU picking, which suffers from significant drawbacks, such
as blocking the main thread until the GPU has finished rendering the intermediate textures used for picking. If the GPU was already busy performing
other tasks, the main thread had to wait until those tasks were finished, which could cause long stalls. Raycasting happens 100% in the CPU, and is in general faster than GPU picking.

Note that it is still possible to perform GPU picking on map, by using the `gpuPicking` option on the picking parameters:

```js
// Force compatible entities to use GPU picking instead of CPU raycasting.
instance.pickObjectsAt(coordinates, { gpuPicking: true });
```

See the [picking example](https://giro3d.org/examples/picking.html) for more information.

## Elevation queries on maps

It is now possible to query the elevation at any point on a `Map` with `Map.getElevation()`. Possible use cases include elevation profile computations, positioning objects on top of the terrain, etc.

Note that this methods returns a series of _samples_, one for each map tile that contains the requested coordinate. You can sort the sample by resolution to get the best sample:

```js
const map = new Map(...);

// Create the coordinate of the elevation query
const coordinates = new Coordinates(instance.referenceCrs, x, y);
// Then request the elevation at this point
const result = map.getElevation({ coordinates });

// Are there are any values at this point ?
if (result.samples.length > 0) {
    // Let's take the sample with the best resolution
    result.samples.sort((a, b) => a.resolution - b.resolution);

    const sample = result.samples[0];

    console.log(`Elevation at this point is: ${sample.elevation} meters`);
}
```

## Memory usage improvements

This release also brings multiple reduction in memory usage for the `Map` entity. To measure the memory usage of the Giro3D `Instance`, use the `MemoryUsage` interface. This interface is implemented for many components of the Giro3D library, such as `Instance`, entities, layers, geometries...

```js
const instance = new Instance(...);

const memUsage = instance.getMemoryUsage();

console.log(`CPU memory usage (approx): ${memUsage.cpuMemory} bytes`);
console.log(`GPU memory usage (approx): ${memUsage.gpuMemory} bytes`);
```

`getMemoryUsage()` provides both GPU (WebGL objects) as well as CPU memory usage.

### BREAKING CHANGE

- no-data replacement is disabled by default on `ElevationLayer`s, as it is quite expensive to compute. To enable it, use the `noDataOptions` constructor parameter:

```js
const layer = new ElevationLayer({
    ...
    noDataOptions: {
        replaceNoData: true,
    },
});
```

### Feat

- **Map**: support raycasting (#421) and elevation queries (#171)
- **examples**: add buttons to copy source code
- **Layer**: add the `showEmptyTextures` option to display empty textures as colored rectangles
- **StatusBar**: add button to switch between local CRS coordinates and lat/long.

### Fix

- **PointCloudMaterial**: restore missing opacity updates (#446)
- **TileGeometry**: fix incorrect condition to select between Uint16/Uint32Array for index buffer
- **CogSource**: fix regression in `adjustExtentAndPixelSize()`
- **Layer**: ensure that we don't update a disposed node (#442)
- **StatusBar**: fix incorrect URL update
- **LayeredMaterial**: don't prevent loading color layers if elevation layer is not visible
- **TiledImageSource**: implement `adjustExtentAndPixelSize()` (#436)
- **Map**: prevent subdivision if elevation layer is not ready (#438)
- **PickObjectsAt**: set default radius to zero (#439)
- **CogSource**: ensure that `adjustExtentAndPixelSize()` returns integer width/height
- **Layer**: use bound callback to avoid leaking the listener
- **published_package_json.tmpl**: add dependencies
- **GeoTIFFFormat.ts**: use `window` instead of `global` (#425)
- **StatusBar**: use number formatting for coordinates
- **LayeredMaterial**: fix WebGL warnings (#409)
- **core**: introduce `MemoryUsage` interface (#432) to provide approximated memory usage of various components (entities, layers, etc.).

### Refactor

- **OutlinerPropertyView**: order properties alphabetically
- **MapInspector**: move terrain related properties to sub-panel
- **Instance**: measure picking duration

### Perf

- **examples**: use default picking radius
- **CogSource**: deduplicate outgoing requests (#433)
- **RenderTargetPool**: limit the size of the pool to 16 textures by default
- **TextureGenerator**: use a desynchronized canvas in `getPixels()`
- **Layer**: don't use depth buffers for render targets. This reduces the memory usage of layers.
- **ElevationLayer**: set `noDataOptions.replaceNoData` to `false` by default (#431)
- **LayerComposer**: reduce the use of the pre-processing stage
- **Layer**: don't allocate textures when all pixels are transparent (#430)
- **TileGeometry**: use a 16-bit index buffer if the number of points is small enough

## v0.35.0 (2024-04-05)

### BREAKING CHANGE

- (Typescript users only) The picking API now defaults to `unknown` instead of `any` for picked object types. For example, here are the changes for the `PickResult` type:

    ```ts
    // Before
    interface PickResult<TFeature extends any = any> extends Intersection { ... }

    // After
    interface PickResult<TFeature = unknown> extends Intersection { ... }
    ```

- The `MainLoop` no longer handles the camera near/far plane limits.
  This is now the responsibility of the `Camera` class. Camera planes are automatically updated
  by the entities to ensure that the camera's field of view contains all the displayed objects.

    However, in some cases, it might be useful to limit the plane distances, for example to reduce the
    number of objects to display, and to improve performance. Those values can be changed at runtime and
    the scene will adjust accordingly:

    ```ts
    const instance new Instance(...);
    const camera = instance.camera;

    // Limit near/far planes in the 100-10000 meters range.
    const minDistance = 100;
    const maxDistance = 10000;

    camera.minNearPlane = minDistance;
    camera.maxFarPlane = maxDistance;

    // Combined with fog:
    instance.scene.fog = new THREE.Fog('blue', minDistance, maxFarPlane);
    ```

- `ImageSource`: the return type of `decode()` has changed.
  It initially returned a `Texture`, but it now returns an object of the
  following type: `{ texture: Texture; min?: number; max?: number; }`. Subclasses
  of `ImageSource` can now compute the min/max values of the image to avoid this computation
  layer in the processing chain.
- `Map.showOutline` is now `Map.materialOptions.showTileOutlines`
- `PointsMaterial` is renamed `PointCloudMaterial` to avoid confusion with THREE.js built-in `PointsMaterial`.

### Feat

- **Camera**: enable limits to near and far planes
- **Camera**: support perspective and orthographic modes (#389)
- **CogSource**: support other colorspaces than RGB (#416)
- **CogSource**: support transparency masks (#420)
- **Entity**: provide type parameter for `userData` property
- **Fetcher**: support retrying failed requests (#419)
- **Inspector**: add number of currently active RenderTargets in the Memory panel
- **Instance**: provide the camera in events after-camera-update and before-camera-update
- **Layer**: provide type parameter for `userData` property
- **LayerInspector**: add toggle for `frozen` property
- **LayerInspector**: show the number of loaded images in the `LayerComposer`
- **Map**: add graticule
- **Map**: support THREE.js fog
- **MapInspector**: expose `Map.sseScale` property
- **MapInspector**: show number of active (visible) tile meshes
- **MapInspector**: show number of reachable/visible/loaded tiles
- **MemoryTracker**: track texture lifetime
- **PointCloudMaterial**: support THREE.js fog
- introduce `WmsSource` to reduce boilerplate when using WMS layers
- introduce `WmtsSource` to reduce boilerplate when using WMTS layers

### Fix

- **c3DEngine**: remove `setPixelRatio()` call that produces wrong results
- **CogSource**: in case of errors, log the error and return an empty texture
- **Inspector**: allow hillshading intensity to go beyond 1
- **Layer**: log uncaught errors
- **LayerComposer**: fix incorrect condition to determine if image is visible
- **LayerInspector**: don't crash if layer has no name
- **Map**: dispose tiles and their descendants (#414)
- **Map**: distinguish between hillshading Z-factor and intensity
- **Map**: don't compute neighbouring tiles if stitching is disabled
- **Map**: make `showTileOutlines` dynamic
- **Map**: make removeLayer() not remove all layers (#418)
- **Map**: use better subdivision algorithm (#62)
- **Map**: use correct model for hillshading intensity (#406)
- **MapInspector**: handle missing material in `toggleBoundingBoxes()`
- **PointsMaterial**: rename to `PointCloudMaterial`
- **ScreenSpaceError**: don't use distance computation in orthographic mode
- **TileVS**: fix missing world position transformation
- **VectorSource|VectorTileSource**: use empty textures instead of null (#410)

### Refactor

- **CogSource**: move the readRaster() call in its own method
- **ComposerTileMaterial**: make tile outlines more readable
- **ElevationLayer**: remove unnecessary material check in `registerNode()`
- **Layer**: be more generic with abort error handling
- **Layer**: use a global RenderTarget pool
- **LayeredMaterial**: make atlas optional
- **LayeredMaterial**: remove pixelWidth and pixelHeight accessors
- **LayeredMaterial**: remove unused parentAtlasTexture
- **LayeredMaterial**: rename uniform colorTexture to atlasTexture
- **LayeredMaterial**: strongly type defines
- **LayeredMaterial**: strongly type uniforms
- **Map**: remove `fastUpdateHint` dead code
- **Map**: rename `_forEachTile()` to `traverseTiles()` and make it public
- **MaterialUtils**: add setNumericDefine()
- **registerChunks**: add typing for Giro3D chunks
- **RequestQueueChart**: remove spurious `console.log()` call
- **TileFS.glsl**: rename atlas parameter to texture in computeColorLayer()
- **TileMesh**: add traverseTiles() method
- remove useless JSDoc `@type` tags

### Perf

- **ImageFormat**: optionally return min/max of texture
- **Layer**: cancel request as soon as a node becomes invisible
- **LayeredMaterial**: avoid using the atlas if possible (#417)
- **Map**: increase base size of tiles from 256px to 512px
- **Map**: load color layers after elevation layers
- **TiledImageSource**: flip the texture directly when decoding the blob
- **TiledImageSource**: select the zoom level the closest to the desired resolution
- **TiledImageSource**: support cancellation and HTTP timeouts

## v0.34.1 (2024-03-12)

Hotfix release for 0.34, that fixes #408.

### Feat

- **InstanceInspector**: expose renderer clear alpha

### Fix

- **Map**: use correct model for hillshading intensity (#406)
- **RenderPipeline**: honor clear alpha (#408)

### Refactor

- **giro3d_commong.glsl**: rename `computeDerivatives()` -> `computeElevationDerivatives()`

## v0.34.0 (2024-03-06)

Full color space mangement and performance improvements.

Plus a new website featuring our sister project [Piero](https://piero.giro3d.org), the official web application based on Giro3D!

### BREAKING CHANGE

- The `colorManagement` option in the `Instance` constructor
  is removed. [THREE.js color management](https://threejs.org/docs/#manual/en/introduction/Color-management) is now always enabled.
- The event `layer-initialized` is removed from the `Instance`,
  as it was never triggered.
- TileMesh.OBB is now an accessor:

    ```ts
    // before
    const obb = tileMesh.OBB();

    // after
    const obb = tileMesh.OBB;
    ```

### Feat

- **ci**: enable building website on CI
- **doc**: add Piero in the readme and on the website
- **Extent**: add `toGrid()` to subdivide an `Extent` into a regular grid (!530)
- **FeatureCollection**: add resulting meshes to cache (#329, !521)
- **Inspector**: support TileMesh objects (!518)
- **Inspector**: use a different color for non-visible materials (!518)
- **InstanceInspector**: add color picker for clear color (!525)
- **Map**: make stitching and terrain deformation optional (#392, #391, !514)
- **Map**: support colorimetry (#393, !515)

### Fix

- **c3DEngine**: default to enabled `ColorManagement` (#373, !525)
- **Coordinates**: recognize variants of well-known units (deg, degree, degress...) (!530)
- **Entity3D**: call onObjectCreated on root object (#395, !517)
- **giro3d_common.glsl**: adjust color space for `Interpretation.CompressTo8Bit` (#373, !525)
- **Layer**: adjust color space of input textures (#373, !525)
- **LayerComposer**: use 64-bit floating point instead of 32-bit for warping tiles (!530)
- **Map**: use correct color space for default background color (#373, !525)
- **Map**: use screen-space thickness for contour lines (#396, !516)
- **MapInspector**: use correct color space for background color (#373, !525)
- **PointFS.glsl**: convert point colors to linear (#373, !525)
- **RenderPipeline**: add missing final OutputPass (#373, !525)
- **RenderPipeline**: adjust the clear color in linear-sRGB color space (#373, !525)
- **shaders**: add missing chunk `<colorspace_fragment>` (#373, !525)
- **TileFS.glsl**: apply hillshading on sRGB color (#373, !525)

### Refactor

- **c3DEngine**: remove ColorManagement option (#373, !525)
- **entities**: remove spurious layer properties (#47, !518)
- **Extent**: add typing (#403, !530)
- **Instance**: add `getEntities()` (!520)
- **Instance**: cleanup `remove()` (!520)
- **Instance**: remove `layers-initialized` (!518)
- **ObjectRemovalHelper.ts**: removed class (!520)
- **PotreePointCloud**: add types to `getObjectToUpdateForAttachedLayers()` (!518)
- **TiledImageSource**: add correct type for projection property (#403, !530)
- **TileMesh**: override the type property (!518)
- **TileMesh**: property OBB becomes an accessor (!514)
- **TileMesh**: reduce dependency to Map (#47, !518)
- **Tiles3D**: add types to `getObjectToUpdateForAttachedLayers()` (!518)

## v0.33.1 (2024-02-20)

Hotfix release for 0.33.

### Fix

- **TextureGenerator**: honors RGFormat in computeMinMax() (#399)
- **LayerComposer**: handle empty textures (#388)
- **LayeredMaterial**: use the Map's texture data type (#398)

### Refactor

- **TiledImageSource**: encapsulate private methods

## 0.33.0 (2024-01-30)

Quality of Life improvements, with most of the codebase migrated to TypeScript.

### BREAKING CHANGE

- The `GeoJsonParser`, `GpxParser` and `VectorTileParser` modules are deleted as they are not
  being used by Giro3D. Please use dedicated libraries such as OpenLayers or loaders.gl instead
  (!479)
- `Extent.center()` now only returns an object of type `Coordinates`. To compute the extent as a
  `Vector2`, use the new method `Extent.centerAsVector2()` instead. Similarly, to compute the
  extent as a `Vector3`, use `Extent.centerAsVector3()` (!451)
- `Coordinates.xyz()` is renamed to `Coordinates.toVector3()`. The signature is the same. (!486)
- The `latitude()` and `longitude()` methods of the `Coordinates` class become accessors. To use
  them, remove the parentheses, e.g: `Coordinates.latitude()` becomes `Coordinates.latitude`, and so
  on. (!451)
- the `x()`, `y()`, `z()` methods of the `Coordinates` class become accessors. To use them, remove
  the parentheses, e.g: `Coordinates.x()` becomes `Coordinates.x`, and so on. (!451)
- The `id` parameter of Layer constructor is removed. (!476)
- `Layer.whenReady` is removed. If you want to await the initialization of the layer, just do
  `await Layer.initialize()`. Note that this should not be necessary, as the layer is initialized
  when added to the map. (#387)
- The methods `addFrameRequester` and `removeFrameRequester` are removed from `Instance`. Instead,
  use the methods of the `EventDispatcher` (#379):

    ```ts
    // before
    instance.addFrameRequester('before_update', callback);
    instance.removeFrameRequester('before_update', callback);

    // after
    instance.addEventListener('before-update', callback);
    instance.removeEventListener('before-update', callback);
    ```

- Event names for the `Instance` are `kebab-case`:

    - `before_update` -> `before-update`
    - `after_update` -> `after-update`
    - `before_camera_update` -> `before-camera-update`
    - `after_camera_update` -> `after-camera-update`
    - `before_render` -> `before-render`
    - `after_render` -> `after-render`
    - `update_end` -> `update-end`
    - `update_start` -> `update-start`

    The events mentioning layers are renamed to mention entities

    - `before_layer_update` -> `before-entity-update`
    - `after_layer_update` -> `after-entity-update`

- removed broken `DEMUtils` (`getElevationValueAt`, `placeObjectOnGround`) (!490)
- removed broken support for `OrthographicCamera` (!490)
- `Drawing` doesn't take a reference to `Instance` anymore (!493):
    - its constructor doesn't take the reference to `Instance` anymore
    - calls to update the shape (`update`, `setGeojson`, `setCoordinates`, `setMaterials`)
      require a call to `instance.notifyChange` afterwards
- `point2DFactory` option of `Drawing` now uses the same prototype as `DrawTool` (text as a
  string) (!493)
- picking results use the property `entity` instead of `layer` for more consistency (!489)
- entities that were defining `pickObjectsAt` method now define `pick` instead for clarity (!489)
- Build scripts are renamed (!500):
    - script `prepare-package` renamed to `build-package`/`build` (alias),
    - script `build-package` replaced by `make-package`,
    - script `apidoc` renamed to `build-apidoc`

### Feat

- **Instance**: enable picking vector features (#168)
- **Extent**: add methods to compute center as vectors (!451)
- **DrawTool**: add entity for handling multiple `Drawing`s and help picking (#384)
- **Coordinates**: add `toVector2`() (!508)
- **ColorLayer**: allow setting the elevation range (!509)
- **Entity**: add the `userData` property (!512)
- **Layer**: add the `userData` property (!512)
- **examples**: add example for `FirstPersonControls` (!490)
- **examples**: `wfs_mesh`: enable status bar and fixed label not disappearing (!489)
- **examples**: more sources in `planar_vector` and display metadata on hover (!489)

### Fix

- **DrawTool**: prevent splicing meshes to be picked up by raycasting (#384)
- **Map**: guarantee that `addLayer()` always resolve (#387)
- **Map**: add `imageSize` accessor (!482)
- **Inspector**: use integers for relevant charts (!495)
- **Picking**: `pickObjectsAt` does not work with radius=0 (#168)
- **RequestQueue**: improve typing of `enqueue()` to infer return type (!492)
- **examples**: fix examples with view parameter (!484)
- **examples**: fix IGN WFS, WMS and WMTS endpoints (!491)
- **examples**: fix `layer_ordering` (!476)

### Refactor

- **Instance**: remove frame requester API (#379)
- **DEMUtils**: remove `DEMUtils` (!490)
- **FirstPersonControls**: migrate `FirstPersonControls` to TypeScript (!490)
- **version**: migrate version to TypeScript (!490)
- **registerChunks**: migrate registerChunks to TypeScript (!490)
- **Inspector**: migrate Inspectors to TypeScript (!490)
- **B3dmParser**: migrate `B3dmParser` to TypeScript (!490)
- **BatchTableParser**: migrate `BatchTableParser` to TypeScript (!490)
- **PntsParser**: migrate `PntsParser` to TypeScript (!490)
- **ShaderUtils**: migrate `ShaderUtils` to TypeScript (!490)
- **Utf8Decoder**: migrate `Utf8Decoder` to TypeScript (!490)
- **PromiseUtils**: migrate `PromiseUtils` to TypeScript (!490)
- **ObjectRemovalHelper**: migrate `ObjectRemovalHelper` to TypeScript (!490)
- **RenderPipeline**: migrate `RenderPipeline` to TypeScript (!490)
- **RenderingOptions**: migrate `RenderingOptions` to TypeScript (!490)
- **PointsMaterial**: migrate `PointsMaterial` to TypeScript (!490)
- **PointCloudRenderer**: migrate `PointCloudRenderer` to TypeScript (!490)
- **MemoryTracker**: migrate MemoryTracker to TypeScript (!490)
- **MaterialUtils**: migrate `MaterialUtils` to TypeScript (!490)
- **Camera**: migrate `Camera` to TypeScript (!490)
- **c3DEngine**: migrate c3DEngine to TypeScript (!490)
- **TileGeometry**: migrate TileGeometry to TypeScript (!490)
- **Capabilities**: migrate Capabilities to TypeScript (!490)
- **LayerUpdateState**: migrate LayerUpdateState to TypeScript (!490)
- **Rect**: migrate Rect to TypeScript (!490)
- **OBB**: migrate OBB to TypeScript (!484)
- **PotreePointCloud**: migrate to TypeScript (!484)
- **Helpers**: migrate helpers to TypeScript (!484)
- **Tiles3D**: migrate `Tiles3D` to TypeScript (!484)
- **MainLoop**: migrate `MainLoop` to TypeScript (!484)
- **Coordinates**: rename `xyz()` -> `toVector3()` (!486)
- **RequestQueue**: explicitly implement interface `Progress` (!487)
- **Instance**: migrate `Instance` to TypeScript (!480)
- **Picking**: migrate `Picking` to TypeScript (!480)
- **DrawTool**: migrate to TypeScript and fix its typing definitions (#372)
- **Layer**: remove `id` constructor parameter and introduce `name` (!476)
- **Layer**: expose `source` property as readonly (!476)
- **Coordinates**: `longitude()` and `latitude()` becomes accessors (!451)
- **Coordinates**: `x`, `y`, and `z` become accessors (!451)
- **Parsers**: delete unused parsers (!479)

### Perf

- **CogSource**: reuse the same worker pool to avoid creating many workers (!485)
- **Map**: use 2 channels instead of 4 for elevation textures (#376)

## v0.32.2 (2023-12-06)

Hotfix release for #375.

### Fix

- **giro3d_common.glsl**: don't use `texelFetch()` in derivative computation (#375)

## v0.32.1 (2023-12-05)

Hotfix release for #374

### Fix

- **TileVS.glsl**: remove dynamic indexing of sampler arrays (#374)

## v0.32.0 (2023-12-01)

### Feat

- **Layer**: enable changing the resolution of the layer (#301)
- **FeatureCollection**: support reprojection of features (#328)

### Fix

- **LayerComposer**: apply no-data filling as post-process (!456)
- **Layer**: avoid loading data for non visible tiles (!465)
- **Map**: allow maxSubdivisionLevel to be zero (!459)

### Refactor

- **Entity3D**: deal with renderOrder at the entity level (!463)
- upgrade shaders to GLSL 3 (!462)

### Perf

- **TextureGenerator**: decode images using `createImageBitmap()` (!458)

## v0.31.0 (2023-11-24)

Mainly bugfixes, including memory leaks.

### Fix

- **LayeredMaterial**: enable transparency only if opacity is < 1 (!455)
- **LayerComposer**: ensure that images with no owner are always removed (!453)
- **Layer**: fix memory leak where composer images were never freed (!453)
- **MapInspector**: restore the `discardNoData` checkbox (!454)
- **Inspector**: display memory usage numbers as integers rather than real numbers (!454)

### Refactor

- **LayerComposer**: remove dead code related to progressive rendering of tiles (!453)

## v0.30.0 (2023-11-16)

Mostly performance/memory improvements and bugfixes, as well as a better integration of sources with the `Fetcher` module.

### Feat

- **CogSource**: use the Fetcher for automatic HTTP configuration (#312)
- **VectorTileSource**: use the Fetcher for automatic HTTP configuration (!449)
- **CogSource**: add options for the underlying `BlockedSource` cache (#364)

### Fix

- **TileVS.glsl**: ignore no-data for stitching (#366)
- **Map**: don't apply contour lines on transparent pixels (#365)

### Refactor

- **Map**: migrate to TypeScript
- **ScreenSpaceError**: export `SSE` type
- **Entity3D**: migrate to TypeScript
- **Entity**: migrate to TypeScript
- **AtlasBuilder**: migrate to TypeScript
- **Context**: migrate to TypeScript
- **RenderingState**: migrate to TypeScript
- **TileIndex**: migrate to TypeScript
- **TileMesh**: migrate to TypeScript
- **ColorMapAtlas**: migrate to TypeScript
- **http**: migrate to TypeScript
- **CogSource**: improve static typing

### Perf

- **AxisGrid**: rebuild objects at most once per frame, and only if the grid is visible (!448)
- **CogSource**: use the global cache (#364)

## v0.29.0 (2023-10-26)

### BREAKING CHANGE

- The API for no-data filling has changed. The options
  related to no-data manipulation are now in the [`NoDataOptions`](https://giro3d.org/apidoc/interfaces/core.layer.NoDataOptions.html) interface passed to
  the [`Layer`](https://giro3d.org/apidoc/classes/core.layer.Layer.html) constructor.
  See this [example](https://giro3d.org/examples/cog_nodata.html) for more information.

### Feat

- **Layer**: expose parameters for no-data filling (#361)
- **Layer**: add `clear()` method to reset the state of the layer
- **Layers**: add parameters to set brightness/contrast/saturation (#358)
- **FeatureCollectionInspector**: add a button to pick a feature and display only this one
- **FeatureCollection**: support extrusion (#326)
- **MapInspector**: display layer info in floating labels
- **TiledImageSource**: add option to specify extent

### Fix

- **Map**: don't prevent subdivision if elevation layer is not visible
- **CogSource**: initialize() once (!438)
- **Layer**: fix texture inheritance (#359)
- **FeatureCollection**: be consistent on the use of null vs undefined
- **FeatureCollection**: really clean objects when removing a 'tile'
- **Outliner**: give names to FeatureCollection meshes
- **examples**: put example.css after bootstrap for an easier customisation
- **FeatureCollectionInspector**: remove duplicate button with EntityInspector
- **OLFeature2Mesh**: fix the color handling
- **TiledImageSource**: handle 404 errors with empty textures
- **Layer**: fix invalid state transitions (#356)

### Refactor

- **Layer**: move constructor options in interface
- **ComposerTileMaterial**: cleanup
- **LayerComposer**: migrate to TypeScript
- remove support for older GLTF 1 files
- **LayeredMaterial**: migrate to TypeScript
- **ImageSource**: migrate to TypeScript
- **Cache**: migrate to TypeScript
- **ColorMap**: migrate to TypeScript
- **ImageFormat**: migrate to TypeScript
- **WebGLComposer**: migrate to TypeScript
- **API**: remove `TextureGenerator` from exposed API
- **AxisGrid**: migrate to TypeScript
- **ImageSource**: migrate to TypeScript
- **CanvasComposer**: delete unused class
- **ComposerTileMaterial**: migrate to TypeScript
- **OpenLayersUtils**: migrate to TypeScript
- **ProjUtils**: migrate to TypeScript
- **TextureGenerator**: migrate to TypeScript
- **FeatureCollection**: rename `extrude` to `extrusionOffset`, and `altitude` to `elevation` in options (#326)
- **OlFeature2Mesh**: cleanup dead code
- **LayerComposer**: remove unused resolution parameter of images

### Perf

- **LayeredMaterial**: update uniforms at most once per frame (!435)
- **TextureGenerator**: optimize `NaN` checks (!433)
- **TiledImageSource**: ignore tiles that do not belong to a given zoom level

## v0.28.0 (2023-09-04)

This release offers numerous bugfixes and performance improvements, as well as some new features.

### BREAKING CHANGE

- The `Scheduler` is removed. Please use the `RequestQueue`
  class instead to enqueue asynchronous operations.
- the method `offsetInExtent()` has been moved from the `Coordinates` to the `Extent` class
- `Entity3D.type` now returns `"Entity3D"` rather than `"geometry"`

### Feat

- **Map**: add contour lines (#239)
- **Interpretation**: support elevation with inversed signs (#344)
- **CogSource**: support channel mapping (#335)
- **TextureGenerator**: supports no-data for 3 and 4 channel images
- **Inspector**: add inspector for RequestQueue
- **EntityInspector**: add controls to set the entity clipping plane
- **c3DEngine**: add support for per-object clipping planes
- **Entity3D**: add the renderOrder property
- **Entity3D**: add utility methods to traverse hierarchy
- **Entity3D**: expose clipping planes API (#293)
- **LayeredMaterial**: add support for clipping planes (#293)
- **PointsMaterial**: add support for clipping planes (#293)
- add `isType*` properties on layers, sources, and formats
- add three.js like `isType*` on entities (isEntity3D, isMap, isPotreePointCloud...)
- **Tiles3D**: honor the frozen property (#339)
- **Inspector**: expose the 'frozen' property of entities
- **Inspector**: add buttons to dispose entities and layers
- **InstanceInspector**: add a button to trigger an update
- **Interpretation**: add CompressTo8Bit (#333)
- **Inspector**: add option to set a custom title of the inspector pane (#334)

### Fix

- **Instance**: fix incorrect splice() call in remove() (#353)
- **ElevationLayer**: set default min/max to 0 instead of null
- **TileMesh**: remove dead code
- **Map**: update the tiles' min/max when an elevation layer is added (#352)
- **Map**: ensure that the extent matches the instance CRS (#350)
- **Layer**: use the CRS of the instance in prepare() (#350)
- **Entity3D**: set transparent to true on new objects when opacity is < 1
- correctly set `.needsUpdate` when changing opacity on Entities
- **Layer**: ensure that fallback images are properly loaded when the source is reset
- **ImageSource**: `createReadableTextures` is now a parameter of getImages()
- **Drawing**: fix incorrect return type of clear()
- **AxisGrid**: fix typing issues
- **Coordinates**: fix typing consistency issue
- **Map**: `dispose()` should not dispose layers automatically (#323)
- **Inspector**: improve readability of frame duration chart
- **c3DEngine**: don't render into a zero-sized framebuffer (#341)
- **CogSource**: pass containsFn to parent constructor (#337)
- **CogSource**: select correct data type from sample format and bits per sample
- **CogSource**: make initialize() idempotent

### Refactor

- **Layer**: migrate to TypeScript
- **core**: add the Progress interface
- **CogSource**: migrate to TypeScript
- **various**: fix typing issues
- **OperationCounter**: fires the 'complete' event when the task count reaches zero
- **Scheduler**: remove Scheduler
- **PotreePointCloud**: remove Scheduler in favor of RequestQueue
- **Tiles3D**: remove Scheduler in favor of RequestQueue
- **TileFS.glsl**: minor refactor
- **shaders**: create the giro3d_common chunk
- **TileFS.glsl**: chunkify layer composition
- **TileFS.glsl**: chunkify outlines
- **c3DEngine**: register custom chunks
- **TileFS.glsl**: use gl_FragColor everywhere
- **InstanceInspector**: extract WebGLRenderer specific controls to dedicated inspector
- **Tiles3D**: expose boundingVolumeToExtent()
- **Entity3D**: simplify opacity handling
- **Instance**: fix jsdoc
- **RequestQueue**: migrate to TypeScript
- **Extent**: migrate to TypeScript
- **Coordinates**: move to TypeScript
- **OperationCounter**: migrate to TypeScript
- **Instance**: remove `addVector()`
- **Entity**: improve consistency of return types of preprocess()
- **TiledImageSource**: pass all options to parent constructor
- **Interpretation**: add toString() implementation for CompressTo8Bit
- **Inspector**: add color to chart axes (#285)
- **Inspector**: improve readability of memory chart (#285)
- **Inspector**: improve readability of frame chart (#285)
- **Interpretation.glsl**: simplify condition

### Perf

- **Layer**: preloading of base images is now optional (#347)
- avoid creating DataTextures when possible (#336)

## v0.27.0 (2023-07-31)

This releases introduces three major features to Giro3D:

- reprojection capabilities for layers
- the ability to draw vector data as 3D meshes
- shading for point clouds

### BREAKING CHANGE

- the `Points` class is renamed to `PointCloud`
- `Map.materialOptions.hillshading` is now an object of type
  [`HillshadingOptions`](https://giro3d.org/apidoc/module-entities_Map.html#~HillshadingOptions) rather than a boolean. `Map.lightDirection` is removed
  and the `zenith` and `azimuth` parameters are now part of the `HillshadingOptions`
  object. See the [example](https://giro3d.org/examples/hillshade.html) for more info.
- Implementations of [`ImageSource`](https://giro3d.org/apidoc/module-sources_ImageSource-ImageSource.html) must now implement
  the `getCrs()` method.
- The `CustomTiledImageSource` class is removed.

### Feat

- Add the [`FeatureCollection`](https://giro3d.org/examples/wfs_mesh.html) entity to draw features (points, polylines and polygons) as standalone (non-draped) 3D meshes (#252).
- Add [post-processing](https://giro3d.org/examples/colorized_pointcloud.html) effects for point clouds (#68):
    - [Eye Dome Lighting (EDL)](https://www.researchgate.net/publication/320616607_Eye-Dome_Lighting_a_non-photorealistic_shading_technique) to have pseudo-shading on point clouds
    - Occlusion and inpainting to reconstruct missing surfaces between points.
- The `Layer` now supports reprojecting images from the source CRS to the instance CRS. (#294). See [this example](https://giro3d.org/examples/layer_reprojection.html) for more information.
- **Map**: allows limiting hillshading to elevation layers only (#321).
- **Inspector**: add CRS information for instance and layers
- **ImageSource**: support a user-provided intersection test (#310)
- **MapInspector**: display labels and update bbox color (#311)
- **LayeredMaterial**: implement the progress() and loading() API

### Fix

- **PointCloud**: handle disposal of unmanaged resources
- **ScreenSpaceError**: make findBox3Distance support 2D mode
- **Map**: `getElevationMinMax()` handles the case where elevation layers have no minmax (#324)
- **Layer**: fix zero-sized render targets
- **RequestQueue**: really call `abortError`
- **CogSource**: clear the cache on `dispose()`
- **LayerInspector**: use `layer.getExtent()` to have the actual extent

### Refactor

- **VectorSource**: `getExtent()` now returns the current extent
- **Entity3D**: call postUpdate() on attached layers
- **PointCloudRenderer**: cleanup shader code
- **MainLoop**: convert to class
- **c3DEngine**: remove WebGL1 specific code
- **c3DEngine**: remove renderLayerToBuffer()
- **WebGLComposer**: remove origin offset
- Remove the `CustomTiledImageSource` class
- **CogSource**: check for Worker availability before creating the pool
- **Layer**: handle empty tiles without creating unecessary textures

## v0.26.0 (2023-06-21)

### BREAKING CHANGE

- The API for sources and layers has changed. See the documentation for more information. Main takeaway:
    - The sources for [`Layer`](https://giro3d.org/apidoc/module-core_layer_Layer-Layer.html)s must now be subclasses of the [`ImageSource`](https://giro3d.org/apidoc/module-sources_ImageSource-ImageSource.html) class.
    - For vector features, the style is now passed directly to the relevant sources ([`VectorSource`](https://giro3d.org/apidoc/module-sources_VectorSource-VectorSource.html) and [`VectorTileSource`](https://giro3d.org/apidoc/module-sources_VectorTileSource-VectorTileSource.html)), instead of being attached to the layer. See this [example](https://giro3d.org/examples/ol_vector.html) for more information.
    - For custom image decoders, the [`ImageFormat`](https://giro3d.org/apidoc/module-formats_ImageFormat-ImageFormat.html) must be passed to the [`TiledImageSource`](https://giro3d.org/apidoc/module-sources_TiledImageSource-TiledImageSource.html) instead of being attached to the layer. See this [example](https://giro3d.org/examples/tifftiles.html?) for more information.

### Feat

- **Fetcher**: fire events on network errors (#290)
- **Inspector**: add a panel for the Fetcher
- **Map**: fires an event when layers are reordered (#284)

### Fix

- **c3DEngine**: fix invalid handling of `checkShaderErrors`
- **example**: fix drawtool with latest dataset update
- **MapInspector**: honor layer order (#284)
- **TileFS**: ignore mask position in layer order (#289)
- Improve compatibility with TypeScript clients, by removing dynamically defined properties. (#270)

### Refactor

- **Layer**: complete layer and source rewrite. Fixes #287, #228, #201, #37, #33.

### Perf

- **Fetcher**: limit to N concurrent requests per host (!366)

## v0.25.0 (2023-05-17)

Mainly bugfixes and performance optimizations. No breaking change.

### Fix

- **LayeredMaterial**: fix memory leak by resetting the composer before rendering (#288)

### Perf

- **LayeredMaterial**: repaint the atlas at most once per frame
- **WebGLComposer**: share a single plane geometry among all instances

## v0.24.1 (2023-05-05)

Hotfix for the #286 issue.

### Fix

- **ComposerTileMaterial**: fix memory leak (#286)

## v0.24.0 (2023-05-04)

Mainly bugfixes and performance optimizations.

### Feat

- **MemoryTracker**: make it usable in published packages (#278)
- **Map**: document and make dynamic the renderOrder property (#269)
- **MapInspector**: expose the discardNoData property

### Fix

- **ColorMapAtlas**: use a nearest neighbour filter (#275)
- **LayeredMaterial**: ensure ENABLE_ELEVATION_RANGE is dynamic (!349)
- **COGProvider**: don't override layer minmax (#273)
- **examples**: bind controls to canvas instead of viewport
- **Picking**: ignore invisible objects (#268)
- **LayerInspector**: fix missing updates

### Refactor

- **Map**: move tile traversal in dedicated method

### Perf

- **WebGLComposer**: reuse the same quad geometry (#277)
- **Map**: process picking in a single pass (#274)

## v0.23.1 (2023-04-13)

Hotfix release for #263.

### Fix

- **Map**: fix inconsistent ordering (#263)

## v0.23.0 (2023-04-11)

### BREAKING CHANGE

- `OBB.js` is moved to `/core` subfolder
- `FirstPersonControls.js` and `OrthoCameraControls.js` are
  moved to the `/controls` subfolder

### Feat

- **LayeredMaterial**: make `discardNoData` dynamic. See the [example](https://giro3d.org/examples/cog_nodata.html).
- **Map**: add API to reorder layers (#81)
- add mask layers (#247).
- add elevationRange on `Map` and `ColorLayer` (#246)
- **Extent**: add `fromCenterAndSize()` method
- **WebGLComposer**: enable anisotropy and mipmaps
- **Provider**: providers can decide extents and texture size (#243)
- **Extent**: add the `equals()` function
- **Extent**: add the `fitToGrid()` function

### Fix

- Fix incorrect imports (#262)
- **composer**: fix no-data filling algorithm (#151). See the [example](https://giro3d.org/examples/cog_nodata.html).
- **Picking**: render with a black clear color to avoid decoding issues (#249)
- **PointsMaterial**: fix warning due to missing uniform (#250)
- **TileFS**: honor opacity when no color layer is present (#259)
- **Map**: don't assign `imageSize` to layers (#257)
- **point clouds**: honor opacity changes when a custom material is used (#255)
- **OLVectorTileProvider**: fix invalid texture sizes (#254)
- **Tiles3D**: make progress reporting more fluid (#253)
- **COGProvider**: use `LinearFilter` for tile textures (#243)
- **LayeredMaterial**: honor actual texture sizes in atlas manipulation (#243)
- **GeoTIFFFormat**: use linear filtering instead of the default nearest neighbour (#243)
- **Map.js**: don't artificially stop division when tile size is < 5
- **Map.js**: don't create unnecessary promises

### Refactor

- **Map**: handle the atlas
- **Inspector**: display id of elements
- move OBB into /core subfolder (#185)
- **controls**: move in /controls subfolder (#185)
- **OpenLayerUtils**: introduce `OpenLayerUtils` for `{from,to}OLExtent`
- **Scheduler**: use simple callbacks instead of referencing providers

## v0.22.0 (2023-03-16)

### Feat

- Expose API to track progress of data processing (#237). See [the example](https://giro3d.org/examples/tracking_progress.html).
- **LayeredMaterial**: support transparent backgrounds (#245). See [the example](https://giro3d.org/examples/transparent_map_bg.html).
- **examples**: add [custom controls](https://giro3d.org/examples/camera_controls.html) example (#235).

### Fix

- **Map**: combine all colormaps into an atlas (#244). This helps reduce the number of texture units consumed by a map tile.
- **OLTileProvider**: filter out requests that returned null (#242)
- **Layer**: handle null textures (#242)
- **TileFS**: avoid warning when `gl_FragColor` is not set before discarding the fragment (#241)

## v0.21.0 (2023-03-06)

This release contains many bugfixes and performance improvements, as well as two features: the `DrawTools` and the `HttpConfiguration` modules.

### BREAKING CHANGE

- `Fetcher` has been moved to `utils/`.
- `Cache` has been moved to `core/`.
- `Cache` is now an instantiable class. To use the global singleton cache, use `GlobalCache`:

    ```js
    import { GlobalCache } from '../core/Cache.js';

    const foo = GlobalCache.get('foo');

    GlobalCache.purge();
    GlobalCache.clear();
    ```

### Feat

- **Drawtools**: add the `DrawTools` class to draw geometries on various objects. (#5). [See it in action](https://giro3d.org/examples/drawtool.html).
- add the `HttpConfiguration` module (#86). This module stores configuration (such as headers) based on URL paths. [See the documentation](https://giro3d.org/apidoc/module-utils_HttpConfiguration.html) for a detailed explanation.
- **Inspector**: display min/max of elevation layers
- **Inspector**: add Instance inspector

### Fix

- **Map**: properly dispose pooled geometries (#230)
- **TextureGenerator**: fix forever pending `create8bitImage()` (#232)
- **Inspector**: add counters for pending/cancelled/failed/running/complete commands
- **Scheduler**: don't log cancelled commands
- **MemoryTracker**: fix non-weakrefs

### Refactor

- **Fetcher**: improve message in `checkResponse()`
- **Fetcher**: move to `utils/` folder

### Perf

- **Cache**: prevent unbounded growth (#225). This uses the `lru-cache` package to ensure that the cache capacity is controlled.
- **OLTileProvider**: handle command cancellation (#238)
- **COGProvider**: handle command cancellation (#234)
- **Map**: don't keep data copy of elevation textures (#215). This considerably reduces the memory usage of scenes that contain elevation data.
- **Picking**: don't sample the elevation texture (#231)
- **3DEngine**: option to toggle shader validation (#229). Shader validation is a costly operation that should be avoided in production.
- **Map**: avoid allocating too many `TileGeometry` objects (#230)

## v0.20.1 (2023-02-17)

Hotfix for the #228 issue.

### Fix

- **c3DEngine**: clear canvas to avoid flickering
- **WebGLComposer**: restore clear alpha (#228)

## v0.20.0 (2023-02-16)

Lots of bugfixes and performance improvements around texture handling.

### BREAKING CHANGE

- The method `instance.getLayers()` is removed, please call `getLayers()`
  on relevant entities instead.
- `instance.getOwner(layer)` is removed, just use `layer.owner` instead.

### Feat

- **formats**: enable shader Y-flipping of DataTextures (#202)

### Fix

- **COGProvider**: stop compressing data to 8-bit (#216)
- **PointsMaterial**: add a missing needsUpdate = true (#200)
- **PointsMaterial**: fix memory leak of color textures
- **Helpers**: fix remove3DTileBoundingVolume() (#150)
- **PointsMaterial**: fix black tiles in overlay mode (#219)
- **WebGLComposer**: don't `clear()` the renderer
- **Map**: throw error if the extent is invalid (#218)
- **OLTileProvider**: use tile ratio for zoom level (#144)
- **Map**: set a limit on the aspect ratio (#144)
- **OLTileProvider**: handle 204 No Content responses (#206)
- **COGProvider**: fix memory leak of cached textures

### Refactor

- **Layer**: move `frozen` property up to Layer
- move and rename `Layer.defineLayerProperty` to `EventUtils.definePropertyWithChangeEvent`
- **Instance**: remove `instance.getLayers()` and `instance.getOwner()`
- remove or fix some dependencies links between our modules
- remove `threejslayer` support for Entities

### Perf

- **Tiles3D**: use lower resolution texture overlays
- **COGProvider**: flip the textures using the `WebGLComposer` (#202)

## v0.19.1 (2023-02-06)

### Feat

- **ElevationLayer**: expose `minmax` in constructor (#190)
- **Entity**: add `dispose()` method. This method was previously undocumented.

### Fix

- **AxisGrid**: honors visibility in `refresh()` (#214)
- **TileFS**: honor layer alpha with color maps (#212)

## v0.19.0 (2023-02-02)

### Feat

- **AxisGrid**: add the AxisGrid entity (#165). See the [example](https://giro3d.org/examples/axisgrid.html).
- **Extent**: add `topLeft()`, `topRight()`, `bottomLeft()`, `bottomRight()`
- **Helpers**: add a function to create an `ArrowHelper`
- **geojsonparser**: make `crsOut` parameter default to `crsIn`

### Fix

- **LayeredMaterial**: fix memory leak where color textures were not properly disposed.
- **Instance**: properly propagate preprocessing error

### Refactor

- **Entity3d**: make the `visible` property overiddable
- **Entity3D**: make the `opacity` property overridable

## v0.18.0 (2023-01-20)

### BREAKING CHANGE

- All source folders are now in lowercase (#130). For example:

    ```js
    import Instance from '@giro3d/giro3d/Core/Instance.js';
    import Extent from '@giro3d/giro3d/Core/Geographic/Extent.js';
    ```

    Becomes

    ```js
    import Instance from '@giro3d/giro3d/core/Instance.js';
    import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
    ```

- Upgrade THREE to v0.148. If you are using THREE in your application along Giro3D, you will need
  the [THREE migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide) (#153).

- We no longer transpile Giro3D to support older browsers. Instead, we support the browsers list in `package.json` directly from the source code (#89)

### Feat

- **Inspector**: make width an option and increase default width to 450px
- **Inspector**: add inspector for the sources
- **Extent**: add `withMargin()` and `withRelativeMargin()` methods to add margins to extents.

### Fix

- **LayeredMaterial**: support changing the type of the atlas texture (#192)
- **Interpretation.glsl**: honor texture alpha in scaling mode
- **TileFS.glsl**: don't process the color layer if its opacity is zero
- **Extent**: fix weird construct in `center()` that trigger errors
- **Instance**: only use `ResizeObserver` if it is available
- fix import to `THREE.MathUtils`
- **CachePanel**: fix `dump()` to output an array instead of an iterator
- **Map**: create texture slightly biggers than tile to artifacts in atlas and hillshading (#27, #156)

### Refactor

- set all folders to lowercase

## v0.17.0 (2023-01-09)

A small bugfix release.

### Feat

- **examples**: add mouse coordinates

### Fix

- **COGProvider**: guarantee that the generated texture is at least one pixel wide
- **TileFS.glsl**: fix Mac-specific implementation issues around atan()
- **DEMUtils**: fix reading elevation texture with COGs
- **TileVS**: fix corner stitching when neighbours are bigger than the current tile

## v0.16.0 (2023-01-05)

This release generalizes color maps for all layers (and not only the elevation layer), support for
the BIL elevation format, and lots of bugfixes.

### BREAKING CHANGE

- ColorMaps are now a property of layers, instead of map. See the [example](https://giro3d.org/examples/colormaps.html) for more information :

    ```js
    import * as THREE from 'three';
    import ColorMap from '@giro3d/giro3d/Core/layer/ColorMap.js';
    import ColorMapMode from '@giro3d/giro3d/Core/layer/ColorMapMode.js';

    const min = 100;
    const max = 1500;
    const colors = [new THREE.Color('red'), new THREE.Color('blue'), new THREE.Color('green')];

    const colorLayer = new ColorLayer('color', {
        colorMap: new ColorMap(colors, min, max, ColorMapMode.Elevation),
    });
    ```

- The property `noTextureColor` is removed. To set the background color
  of the map, use the `backgroundColor` constructor option :
    ```js
    const map = new Map('myMap', { backgroundColor: 'red' });
    ```
- The property `elevationFormat` of the `ElevationLayer` is replaced by the `interpretation` option
  in the `Layer` class:

    ```js
    import Interpretation from '@giro3d/giro3d/Core/layer/Interpretation.js';

    const layer = new ElevationLayer('myLayer', {
        interpretation: Interpretation.ScaleToMinMax(elevationMin, elevationMax),
    });
    ```

    This property can be used for any layer that needs special processing, such as [Mapbox Terrain RGB](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/) format.

### Feat

- **ColorMap**: Introduce class `ColorMap` and make it available for all layers.
- **Inspector**: add section for color maps
- **Map**: remove ColorMap from Map and put it in Layer
- **MapInspector**: add toggle for hillshading
- **Inspector**: show the map and layer extents as 3D bounding boxes
- **Map**: add the `getMinMax()` method
- **Extent**: add the `toBox3()` method to convert to a `THREE.Box3`
- **Map**: the `segments` property is now dynamic
- **example**: add example for WMTS layers and MapBox elevation layer
- Add support for BIL elevation format

### Fix

- **FirstPersonControls.js**: add a target in `eventToCanvasCoords()`
- **Picking**: fix incorrect result of `pickTilesAt()`
- **CustomTiledImageProvider**: draw all images that intersect with the query extent
- **LayeredMaterial**: only dispose color textures that we own
- **Inspector**: fix missing update when changing an object's properties
- **LayeredMaterial**: fix broken `update()` that would ignore shader recompilation
- **TextureGenerator**: set `needsUpdate = true` to texture generated by `decodeBlob()`
- **Inspector**: fix scrolling artifact on chrome/edge
- **examples**: fix inspector layout

### Refactor

- **Map**: add the `setRenderState()` method
- decode elevation formats in the provider
- **ElevationLayer**: simplify min/max calculation

## v0.15.0 (2022-12-15)

### BREAKING CHANGE

- The function `Extent.offsetScale()` is removed. Please use `Extent.offsetToParent()` instead.
- Map: the `segments` option passed in the constructor options MUST be a power of two.
- Map: the property `noTextureOpacity` is removed. Please use `opacity` instead :

    ```js
    map.opacity = 0.5;
    ```

### Feat

- **MapInspector**: add drop-down list to change the render state of the tiles
- **MapInspector**: enable opacity slider

### Fix

- **Map**: fix opacity issues
- **Map**: support stitching including the 4 diagonal neighbours
- **WebGLComposer**: disable mip-maps for generated textures
- **Coordinates**: fix Y-axis inversion in `offsetToExtent()`

### Refactor

- **Extent**: delete unused and buggy `offsetScale()` function

## v0.14.0 (2022-12-08)

### BREAKING CHANGE

- `OGCWebServiceHelper` has been removed. If you need to get textures directly, use `Fetcher` to
  download images and `TextureGenerator` to process them into textures.
- `Instance.getObjects()` returned array now contains the Object3D directly added with
  `Instance.add()`. This makes the API more consistent, but could break applications not expecting this.
- The `TMSProvider` class has been removed. Use the `OLTileProvider` in combination with OpenLayers
  tiled sources to process tiled layers. See this [example](https://giro3d.org/examples/orthographic.html)
  for more information.

### Feat

- **OLTileProvider**: support tiles in the `image/tiff` format. See this [example](https://giro3d.org/examples/tifftiles.html)
  on how to configure it
- **ElevationLayer**: add the `noDataValue` option. Useful when the no-data value cannot be inferred from the downloaded tiles.
- **Inspector**: add a Cache panel to track cached entries and manipulate the cache.

### Fix

- **Composer**: always use WebGL implementation if `createDataCopy` is true
- **ElevationLayer**: handle `DATA_UNAVAILABLE` in preprocessing step
- **Instance**: make `getObjects()` returns THREE.js objects
- **Inspector**: fix visibility toggle for Tiles3D
- **LayeredMaterial**: only dispose the elevation texture if it is not inherited

### Refactor

- **CustomTileProvider**: use `Fetcher` and `TextureGenerator` instead of `OGCWebServiceHelper`
- **TMSProvider**: remove obsolete `TMSProvider` to use ol sources

## v0.13.0 (2022-12-01)

This version adds support for HTML labels, by leveraging THREE's `CSS2DRenderer`, as well as various
bugfixes and performance improvements.

### BREAKING CHANGE

`Map` is now a default export. Update your imports from :

```js
import { Map } from '@giro3d/giro3d/entities/Map';
```

to

```js
import Map from '@giro3d/giro3d/entities/Map';
```

### Feat

- **Renderer**: add CSS2DRenderer support (see `htmllabels` example)
- **Inspector**: display the versions of Giro3D, OpenLayers and THREE
- **Cache**: call an optional callback when an entry is deleted
- **ColorLayer**: add option to display the image borders

### Fix

- **Instance.js**: make sure we use valid Entity reference when adding object
- **OLTileProvider**: fix incorrect tile placement due to rounding errors
- **OLTileProvider**: return DATA_UNAVAILABLE when below the min zoom level

### Refactor

- merge `TileProvider` into `Map`

### Perf

- **Map**: improve performance of neighbour fetching by using a tile index
- **OLTileProvider**: temporarily cache source tiles

## v0.12.0 (2022-11-24)

Notable features :

- support for high dynamic range textures in maps. This enables native support
  for 32-bit floating point elevation data for example, without compressing the pixels to 8-bit.
- Maps can now be displayed in double sided with the option `doubleSided` in the constructor. The
  backside is displayed in a desaturated, darker tone.
- The Giro3D context can be unloaded with the `Instance.dispose()` method.

### BREAKING CHANGE

- In `Instance`, `normalizedToCanvasCoords()`, `canvasToNormalizedCoords()`,
  `eventToNormalizedCoords()` and `eventToCanvasCoords()` now require a `target` vector passed as
  parameter to reduce memory allocations.

### Feat

- Add support for high dynamic range textues
- `OLTileProvider` : add support for extended tile formats (each new format must be implemented)
- **Inspector**: add position of camera target, if any
- **TileFS**: display backside fragments in a desaturated, darker tone
- **Map**: add the doubleSided option
- **examples**: add instance disposal example
- **Instance**: add the dispose() method to unload the Giro3D context

### Fix

- **Layer**: don't resolve whenReady before processing is done
- **CanvasComposer**: support textures in addition to images
- **Composer**: improve robustness of implementation selector
- **WebGLComposer**: fix memory leaks
- **TileFS**: fix faulty alpha blending
- make sure Helpers and OBBHelper correctly clean memory
- make sure panels and inspectors don't leak memory

### Refactor

- **OLTileProvider**: delegate the tile image decoding to TextureGenerator
- **TextureGenerator**: the default export is now an object
- **providers**: remove unused tileTextureCount()
- **TileMesh**: implement dispose()
- **MemoryTracker**: group tracked objects by type in getTrackedObjects()
- **TileFS**: display outlines with different colors for each border
- **Instance**: use target vectors for coordinate related API

## v0.11.0 (2022-11-17)

### Feat

- **Map**: adjust the number of subdivisions to fit the tile width/height ratio

### Fix

- **TileMesh**: assign a default bbox thickness of 1 meter
- **TileVS**: use 2 neighbours instead of 1 for corner vertices while stitching
- **examples**: support dynamic GLSL recompilation in webpack config

## v0.10.0 (2022-11-10)

### Feat

- **TextureGenerator**: replace nodata values by valid values to remove interpolation effect
- **TileGeometry**: remove nodata triangulation
- **Stiching**: use geometry dimension instead of segments to allow rectangular stiching

### Fix

- **Extent**: proper center to target
- **Inspector**: fix missing layer opacity slider when opacity is zero

### Refactor

- **Extent**: remove quadTreeSplit, replace by split(2, 2)

## v0.9.0 (2022-11-03)

### Fix

- **OLTileProvider**: skip source tiles outside the layer's extent
- **OLVector\*Provider**: render the image in own canvas instead of tile atlas
- **LayerInspector**: truncate the layer names when they are too long

## v0.8.0 (2022-10-27)

This release contain mainly bugfixes related to maps and elevation layers, as well as features
regarding no-data handling in elevation layers.

### Feat

- **TextureGenerator**: consider NaN values as no-data when relevant
- **Map**: add an option to discard no-data elevation pixels in the fragment shader

### Fix

- **Map**: tile outlines are now available even in non-DEBUG builds
- **LayeredMaterial**: fix memory leak of colormap textures
- **LayeredMaterial**: fix issues where semi-transparent tile images would be drawn on top of each other
- **LayeredMaterial**: use the exact size of the elevation texture for hillshading
- **ElevationLayer**: fix missing redraw after updating the elevation texture of a tile

### Perf

- **Inspector**: update panels only if they are open
- **TileGeometry**: recycle object for dimensions computation

## v0.7.0 (2022-10-20)

This release contains a lot of features and bugfixes related to map and terrain rendering, most notably colormapping and hillshading. No breaking changes.

### Feat

- **LayeredMaterial**: hillshading and colormaps can now be toggled
- handle raw elevation values in shaders
- **Picking**: add filter options to filter results
- **Picking**: add support of filter option for all picking methods
- **Picking**: add limit options to limit the number of items to pick
- **Colormapping**: colorize elevation, slope and aspect by an color array LUT
- **Hillshading**: parametrize light directions for hillshade calculation

### Fix

- **LayeredMaterial**: fix incorrect manipulation of elevation defines
- **OLTileProvider**: handle missing tiles in the source
- **DEMUtils**: handle non-byte elevation textures
- **COGProvider**: handle 32-bit float data
- **DEMUtils**: fix reading value from textures image data
- **DEMUtils**: normalize pixel value coming from image.data and fix flipY=false
- **DEMUtils**: correct elevation from textures image data
- **Picking**: fix where filter to ensure object is supported
- **Picking**: fix mouse position when picking on multiple sources
- **LayeredMaterial.js**: remove delayed repaint of the atlas
- **examples**: fix elevation values

### Refactor

- **Picking**: started cleaning-up pickObjectsAt redefinitions
- **Picking**: passing radius&filter as options
- **lightDirection**: expose lightDirection to the Map entity
- **Hillshading**: change where the hillshade options are set and applied (better API)

### Perf

- **Picking**: avoid creating unnecessary arrays when picking

## v0.6.0 (2022-10-13)

This release contains mainly bugfixes around HTML layout and map display. No breaking changes.

### Feat

- **Instance**: warn if the supplied host div is not an Element or has children
- **Inspector**: add button to dump map tiles in the console
- **ElevationLayer**: inherit from root texture when none available
- **Inspector**: expose the .visible property of layers

### Fix

- **styling**: make sure canvas resizing works well for any layout
- **Layer**: ensure that all preprocessings are finished before setting ready = true
- **ElevationLayer**: find ancestor with a reusable texture instead of only the direct parent
- **ColorLayer,ElevationLayer**: don't update anything until the layer is ready
- **Map**: don't preprocess the layer twice
- **OLTileProvider**: don't override layer.extent
- **Map**: enforce layer ordering in an async context
- **TileFS/HillShading**: correct UV for hillshading
- **Cache**: fix clear() that was not a valid function

### Refactor

- **styling**: always create viewport in instance
- **styling**: simplify size computation
- **Instance**: better resize observer
- **ColorLayerOrdering**: remove unused class
- **CustomTiledImage**: fix dead/deprecated code

## v0.5.0 (2022-10-10)

This releases contain many bugfixes and improvements related to maps and layers, as well as the Inspector class to inspect and help debug the Giro3D instance.

### BREAKING CHANGE

- PlanarTileBuilder, PanoramaTileBuilder and PanoramaView are removed. All tiles are
  now considered planar (including terrain deformation). Note: PanoramaView may be restored in a future release.
- PotreePointCloud: computeScreenSpaceError() uses point radius instead of diameter. Some adjustment may be needed in existing code to take into account the change in the resulting SSE.

### Feat

- **COGProvider/ElevationLayer**: add elevation cog processing to demonstrate nodata triangulation
- **TileGeometry**: update tile geometry with elevation data, triangulate according to nodata
- **Map**: let the map select the best tile size
- **Map**: subdivide extent into level 0 tiles to minimize distortion
- **Extent**: add the split() method
- **Instance.js**: support adding and removing threejs objects
- **Map**: expose the backgroundColor option
- **Map**: expose the segments property in the options
- **Map**: supports hillshading through options
- **GeographicCanvas**: add the getImageData() method
- **Inspector**: add custom inspector for PotreePointCloud
- add PotreePointCloud entity
- **Instance**: improve focusObject() to be more generic
- **Inspector**: add the Inspector
- **Helpers**: add Helpers class
- **Instance**: add events when an entity is added/removed
- **Map**: fire events layer-added and layer-removed

### Fix

- **Instance**: handle resizing the containing DOM element
- **TileGeometry.test**: adapt the tests to the latest changes
- **TileGeometry/ElevationLayer**: create a new geometry instead of updating buffers
- **hillshade**: fix camera orientation issue in example
- **Packer**: stop forcing the image sizes in power of two
- **examples**: fix broken URL after release of OL7
- **TileFS.glsl**: fix absence of hillshading when no color layer is present
- **TileFS.glsl**: fix reversed sampling of elevation texture
- enable wireframe and tile outlines in `__DEBUG__`
- **Map**: allow arbitrary EPSG:3857 extents
- **LayeredMaterial**: ensure the atlas is correctly initialized before drawing into it
- **ColorLayer**: fix undefined error if parent has no color texture
- **PotreePointCloud**: computeScreenSpaceError() uses point radius instead of diameter
- **Layer.js**: allow more openlayers sources
- **OLTileProvider**: support arbitrary number of tiles per Map tile
- **planartilebuilder**: center correctly planar map tiles when using geographic extents
- **Map**: rewrite removeLayer() to actually remove the layer

### Refactor

- **COGProvider/ColorLayer/ElevationLayer**: architecture changes for the review
- **providers**: remove unused fx property
- **Map**: remove unused property validityExtent
- **TileGeometry**: simplify, comment and accelerate TileGeometry creation
- **Prefab/**: remove Prefab/ (PlanarTileBuilder, PanoramaTileBuilder and PanoramaView)
- **OLTileProvider**: fix type signature of loadTiles()
- **Map**: remove disableSkirt property
- rename view in instance
- add names to THREE objects
- **entities/layers**: add 'type' property to help with Inspector
- **LayerUpdateStrategy**: create an object that contains all strategies
- **Layer**: rename clean() -> dispose()

### Perf

- **OLTileProvider**: further optimize the generation of tile textures
- **TileGeometry**: rewrote TileGeometry in the fashion of SmartGrid
- **COGProvider**: produce DataTextures instead of Textures
- **OLTileProvider**: produce DataTextures instead of Textures
- **LayeredMaterial**: support DataTextures

## v0.4.0 (2022-08-29)

### BREAKING CHANGE

- `Instance.removeObject` has been renamed, please use `Instance.remove` instead.
- `3dtiles` data source should now use `Tiles3D` instead of `GeometryLayer`. Example code:

```js
import Tiles3D from '../src/entities/Tiles3D.js';
import Tiles3DSource from '../src/sources/Tiles3DSource.js';

const pointcloud = new Tiles3D(
    'pointcloud',
    new Tiles3DSource('https://3d.oslandia.com/3dtiles/eglise_saint_blaise_arles/tileset.json'),
);
```

- The protocols 'rasterizer' and 'wfs' should be remplaced by a Vector source. The
  protocol 'wms' should be remplaced by a WMS source.
- Map.addLayer requires a Layer, ColorLayer or a ElevationLayer, not an
  object anymore. Please see `./examples/planar.js` for instance.
- Instance.getParentLayer() has been renamed to Instance.getOwner()

### Feat

- **Instance**: add domElement accessor
- **entities**: add the Tiles3D entity
- **Instance**: add registerCRS() static method

### Fix

- **Instance**: reject when object is not of the correct type
- **DEMUtils.js**: fix offset calculation from parent texture when picking
- **DEMUtils.js**: fix a call to THREE API (a leftover from an upgrade of THREE)
- **DEMUtils.js**: fix the logic of getting the correct tile we pick from
- **LayeredMaterial.js**: stop using arbitrary long timeout for refreshing atlas
- correctly inherit textures from parent tiles
- **examples**: use useTHREEcontrols() everywhere
- **examples**: use MapControls instead of OrbitControls to be consistent
- **TileFS.glsl**: don't compile shader loop if TEX_UNITS is not defined
- **PointCloud**: fix colorizing a pointcloud via a layer
- **cog example**: fix the layer selection in the example
- **examples**: fix searchbox ignoring upper case text
- **StaticProvider**: fix usage of StaticProvider with new source
- **Map**: provide optional object3d in constructor
- **examples**: define the `__DEBUG__` variable if mode = 'development'
- **examples**: fix path to giro3d.js bundle

### Refactor

- **DEMUtils**: remove some useless function parameters
- **DEMUtils**: rename some variables named layer in entity
- **LayeredMaterial**: separate elevation and color texture get/set methods
- **Instance**: rename removeObject() -> remove()
- **examples**: remove references to loading screen
- **examples**: use clearColor option in Instance constructor
- **examples**: use Instance.registerCRS()
- **CustomTiledImageProvider**: remove magic number
- rename Static\* to CustomTiledImage
- **StaticSource**: move code from static provider to source
- **LayeredMaterial**: remove dead code
- **LayeredMaterial**: unroll the loop in the shader itself
- **examples**: use tree shaked module imports and separate JS files
- **examples**: remove json defined layers
- **examples**: move dat.gui in package devDependencies
- **tileMesh**: move findNeighbours in TileMesh class
- **map**: move updateMinMaxDistance in Map class
- **map**: move testTileSSE in Map class
- tree-shake Three.js imports
- remove ColorTextureProcessing.js and ElevationTextureProcessing.js
- create CogSource to replace 'cog' protocol when creating layer
- delete useless instance parameter
- adapt the C3DEngine class to ES6
- remove Raster, WFS and WMS protocols
- create ColorLayer and ElevationLayer
- **examples**: use export function to access CLI options

## v0.3.0 (2022-07-04)

### BREAKING

- Instance, Map: capitalize file names: you might need to change your imports if you reference
  individual files

### Features

- Add helpers method to integrate any THREE controls in Giro3D
- add min/max height options on FirstPersonControls

### Fixes

- Fix picking with radius on regular THREE.js objects

### Documentation

More classes are now documented. More are even in progress!

The README has been rewritten (fix broken links, add logo, improve readability)

### others

- vscode: add tasks.json

## v0.2.0 (2022-06-16)

- Example: change the background color of orthographic.html
- Update three js to v0.135
- Fix: remove useless log
- Upgrade OpenLayers to the latest version to use the GeoTIFF loader

## v0.1.1 (2022-05-25)

- Fix: display of heightfield elevation
- Fix: fix picking on tile with heightfield elevation
- Fix: correct typo in instance.threeObjects
- Fix: also pick from THREE.Object3D we know about
- Chore: fix the repo url in package.json
- Fix: babel invocation in observer.py

## v0.1.0 (2022-05-20)

Initial release
