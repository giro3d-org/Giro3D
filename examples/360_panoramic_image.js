import { AxesHelper, Group, PolarGridHelper, Vector3 } from 'three';

import { Feature } from 'ol';
import { LineString, Point } from 'ol/geom.js';
import { Circle, Fill, Stroke, Style } from 'ol/style.js';

import FirstPersonControls from '@giro3d/giro3d/controls/FirstPersonControls.js';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem.js';
import Ellipsoid from '@giro3d/giro3d/core/geographic/Ellipsoid.js';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import SphericalPanorama from '@giro3d/giro3d/entities/SphericalPanorama.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import EllipsoidHelper from '@giro3d/giro3d/helpers/EllipsoidHelper.js';
import StaticImageSource from '@giro3d/giro3d/sources/StaticImageSource.js';
import VectorSource from '@giro3d/giro3d/sources/VectorSource.js';

import { bindButton } from './widgets/bindButton.js';
import { bindNumberInput } from './widgets/bindNumberInput.js';
import { bindToggle } from './widgets/bindToggle.js';
import StatusBar from './widgets/StatusBar.js';

const instance = new Instance({
    target: 'view',
    crs: CoordinateSystem.epsg4978,
});

const ellipsoid = Ellipsoid.WGS84.scale(0.0001);

const ellipsoidHelper = new EllipsoidHelper({
    ellipsoid,
    parallels: 91,
    meridians: 180,
    segments: 64,
});

instance.add(ellipsoidHelper);

const radius = 5;

const panorama = new SphericalPanorama({ depthTest: true, radius });

instance.add(panorama);

const source = new StaticImageSource({
    source: 'https://3d.oslandia.com/giro3d/images/panorama.jpg',
    // Since the image is covering the entire sphere, we must express the extent as such
    extent: Extent.fullEquirectangularProjection,
});

const panoramicLayer = new ColorLayer({
    name: 'panorama',
    source,
});

panorama.addLayer(panoramicLayer).catch(e => console.error(e));

// Let's create a vector layer with various geometries to help us navigate in the panoramic image.
const debugLayer = new ColorLayer({
    name: 'debug',
    source: new VectorSource({
        data: [
            // Center of image
            new Feature(new Point([0, 0])),
            // Equator of image
            new Feature(
                new LineString([
                    [-180, 0],
                    [+180, 0],
                ]),
            ),
            // Prime meridian of image
            new Feature(
                new LineString([
                    [0, -90],
                    [0, +90],
                ]),
            ),
        ],
        style: new Style({
            stroke: new Stroke({ color: 'yellow' }),
            image: new Circle({
                radius: 8,
                fill: new Fill({ color: 'yellow' }),
                stroke: new Stroke({ color: 'orange' }),
            }),
        }),
    }),
});

debugLayer.visible = false;

panorama.addLayer(debugLayer).catch(e => console.error(e));

const view = instance.view;
const camera = view.camera;

// Set camera at the center of the panorama sphere
camera.position.set(0, 0, 0);

// Look at the center of the panoramic image
camera.lookAt(new Vector3(0, 1, 0));

const controls = new FirstPersonControls(instance, { focusOnMouseOver: true });

controls.options.moveSpeed = 5;
instance.domElement.focus();
controls.reset();

instance.addEventListener('after-camera-update', () => controls.reset());

instance.notifyChange(panorama);

// Let's configure the panorama graticule with 1° step to
// help us visualize the rotation of the sphere.
panorama.graticule.xStep = 1;
panorama.graticule.yStep = 1;
panorama.graticule.color = '#f6d32d';
panorama.graticule.opacity = 0.25;
panorama.graticule.thickness = 0.2;

// @ts-expect-error typing
camera.fov = 60;

const axes = new AxesHelper(7);

panorama.object3d.add(axes);

Inspector.attach('inspector', instance);

StatusBar.bind(instance);

const params = {
    latitude: 0,
    longitude: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
};

const horizontalGrid = new PolarGridHelper(radius, 18, 4, 64, 'red', 'red');

horizontalGrid.rotateX(-Math.PI / 2);
horizontalGrid.updateMatrixWorld(true);

const verticalGrid = new PolarGridHelper(radius, 18, 4, 64, 'blue', 'blue');
verticalGrid.rotateZ(-Math.PI / 2);
verticalGrid.updateMatrixWorld(true);

axes.visible = false;
verticalGrid.visible = false;
horizontalGrid.visible = false;

const helperGroup = new Group();

helperGroup.add(verticalGrid, horizontalGrid);

instance.add(helperGroup);

const updateOrientation = () => {
    panorama.setOrientation({
        heading: params.heading,
        pitch: params.pitch,
        roll: params.roll,
    });
    instance.notifyChange(panorama);
};

const updatePosition = () => {
    // Compute the cartesian coordinates from the geographic coordinates
    const position = ellipsoid.toCartesian(params.latitude, params.longitude, 0);
    panorama.object3d.position.copy(position);
    panorama.object3d.updateMatrixWorld(true);

    // Update the camera up vector to match the normal of the ellipsoid at our location
    // Useful for navigation controls to know where "up" is.
    instance.view.camera.up = ellipsoid.getNormalFromCartesian(position);

    // Get the local rotation matrix that matches the normal vector
    const localMatrix = ellipsoid.getEastNorthUpMatrixFromCartesian(position);

    helperGroup.position.copy(position);
    helperGroup.setRotationFromMatrix(localMatrix);
    helperGroup.updateMatrixWorld(true);

    updateOrientation();

    instance.notifyChange(panorama);
};

updatePosition();

instance.view.goTo(panorama);

bindNumberInput('latitude', latitude => {
    params.latitude = latitude;
    updatePosition();
});
bindNumberInput('longitude', longitude => {
    params.longitude = longitude;
    updatePosition();
});
bindNumberInput('azimuth', azimuth => {
    params.heading = azimuth;
    updateOrientation();
});
bindNumberInput('pitch', pitch => {
    params.pitch = pitch;
    updateOrientation();
});
bindNumberInput('roll', roll => {
    params.roll = roll;
    updateOrientation();
});
bindToggle('graticule', show => {
    panorama.graticule.enabled = show;
    instance.notifyChange(panorama);
});
bindToggle('show-rotation-helpers', show => {
    horizontalGrid.visible = show;
    verticalGrid.visible = show;
    axes.visible = show;

    instance.notifyChange();
});
bindToggle('show-debug-layer', show => {
    debugLayer.visible = show;

    instance.notifyChange(debugLayer);
});
bindButton('go-to-panorama', () => {
    instance.view.goTo(panorama);
});
