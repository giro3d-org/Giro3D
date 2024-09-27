import Instance from '@giro3d/giro3d/core/Instance.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import LASSource from '@giro3d/giro3d/sources/LASSource.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';

import StatusBar from './widgets/StatusBar.js';
import { placeCameraOnTop } from './widgets/placeCameraOnTop.js';

// LAS processing requires the WebAssembly laz-perf library
// This path is specific to your project, and must be set accordingly.
setLazPerfPath('/assets/wasm');

const url = 'https://3d.oslandia.com/giro3d/pointclouds/autzen-simplified.laz';

const instance = new Instance({
    crs: 'EPSG:3857',
    target: 'view',
    backgroundColor: null,
});

async function load(url) {
    const source = new LASSource({ url });

    const entity = new PointCloud({ source });

    await instance.add(entity);

    entity.setActiveAttribute('Color');

    placeCameraOnTop(entity.getBoundingBox(), instance);
}

load(url).catch(console.error);

Inspector.attach('inspector', instance);
StatusBar.bind(instance);
