import { Vector3 } from 'three';

import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';
import SphericalPanorama from '@giro3d/giro3d/entities/SphericalPanorama.js';
import FirstPersonControls from '@giro3d/giro3d/controls/FirstPersonControls.js';

import StatusBar from './widgets/StatusBar.js';

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:4978',
});

const panorama = new SphericalPanorama({
    subdivisionThreshold: 2,
});

instance.add(panorama);

const source = new GeoTIFFSource({
    url: 'https://3d.oslandia.com/giro3d/rasters/360_panorama_church.tif',
    crs: 'EPSG:4326',
});

const panoramicLayer = new ColorLayer({
    name: 'panoramic',
    source,
});

panorama.addLayer(panoramicLayer).catch(e => console.error(e));

const step = () => {
    instance.notifyChange(panorama);
    requestAnimationFrame(step);
};

step();

const view = instance.view;
const camera = view.camera;

camera.near = 1;
camera.far = 1000;
camera.position.set(0, 0, 0);
camera.lookAt(new Vector3(1, 0, 0));

const controls = new FirstPersonControls(instance, { focusOnMouseOver: true });

controls.options.moveSpeed = 100;
instance.domElement.focus();
instance.notifyChange(camera);

controls.reset();

// @ts-expect-error typing
camera.fov = 75;

Inspector.attach('inspector', instance);

StatusBar.bind(instance);
