import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Instance from '@giro3d/giro3d/core/Instance.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import AggregatePointCloudSource from '@giro3d/giro3d/sources/AggregatePointCloudSource';
import COPCSource from '@giro3d/giro3d/sources/COPCSource.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import { bindDropDown } from './widgets/bindDropDown.js';
import { bindNumberInput } from './widgets/bindNumberInput.js';
import { bindProgress } from './widgets/bindProgress.js';
import { bindToggle } from './widgets/bindToggle.js';
import { formatPointCount } from './widgets/formatPointCount.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import StatusBar from './widgets/StatusBar.js';

// LAS processing requires the WebAssembly laz-perf library
// This path is specific to your project, and must be set accordingly.
setLazPerfPath('/assets/wasm');

Instance.registerCRS(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const instance = new Instance({
    target: 'view',
    crs: 'EPSG:2154',
    backgroundColor: 'black',
    renderer: {
        logarithmicDepthBuffer: true,
    },
});

instance.renderingOptions.enableEDL = true;
instance.renderingOptions.EDLStrength = 5;

const colormaps = {
    Intensity: new ColorMap({ colors: makeColorRamp('jet'), min: 0, max: 100 }),
    Z: new ColorMap({ colors: makeColorRamp('portland'), min: 0, max: 100 }),
};

const datasets = [
    'LHD_FXX_0657_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0657_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0651_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0650_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0653_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0655_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0652_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0656_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0654_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0649_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0648_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0647_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0646_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0644_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0645_6859_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6868_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6864_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6865_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6866_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6867_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6860_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6861_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6862_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6863_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6857_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6858_PTS_O_LAMB93_IGN69.copc.laz',
    'LHD_FXX_0658_6859_PTS_O_LAMB93_IGN69.copc.laz',
];

const server = 'https://3d.oslandia.com/giro3d/pointclouds/lidarhd/paris/';

const source = new AggregatePointCloudSource({
    sources: datasets.map(dataset => new COPCSource({ url: server + dataset })),
});

const pointCloud = new PointCloud({ source });

const [setProgress, progressElement] = bindProgress('progress');

source.addEventListener('progress', () => setProgress(source.progress));

pointCloud.showVolume = true;

/**
 * @param {PointCloud} entity
 */
async function onInitialized(entity) {
    progressElement.style.display = 'none';
    document.getElementById('options').style.display = 'block';

    entity.colorMap = colormaps.Z;
    entity.setActiveAttribute('Z');

    document.getElementById('point-count').innerText = formatPointCount(entity.pointCount);

    document.getElementById('file-count').innerText = source.sources.length.toString();

    const volume = entity.getBoundingBox();
    const center = volume.getCenter(new Vector3());

    const camera = instance.view.camera;
    const lookAt = new Vector3(center.x, center.y, volume.min.z);

    camera.position.set(center.x, center.y - 1, volume.max.z * 10);

    camera.lookAt(lookAt);

    const controls = new MapControls(camera, instance.domElement);
    controls.target.copy(lookAt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    instance.view.setControls(controls);

    instance.notifyChange(camera);

    const metadata = await source.getMetadata();

    // Update the Z colormap with the min/max height of the datasets.
    colormaps.Z.min = volume.min.z * 1.1;
    colormaps.Z.max = volume.max.z * 0.6;

    colormaps.Intensity.min = 0;
    colormaps.Intensity.max = 5000;

    StatusBar.bind(instance);

    const [, , , setAvailableAttributes] = bindDropDown('attribute', attribute => {
        entity.setActiveAttribute(attribute);
        entity.colorMap = colormaps[attribute];
    });

    setAvailableAttributes(
        metadata.attributes.map((att, index) => ({
            id: att.name,
            name: att.name,
            selected: index === 0,
        })),
    );

    bindToggle('show-volume', show => (entity.showVolume = show));
    bindToggle('show-tile-volumes', show => (entity.showNodeVolumes = show));
    bindToggle('edl', edl => {
        instance.renderingOptions.enableEDL = edl;
        instance.notifyChange();
    });
    bindNumberInput('point-budget', v => {
        if (v <= 0) {
            entity.pointBudget = null;
        } else {
            entity.pointBudget = v;
        }
    });

    instance.addEventListener('update-end', () => {
        document.getElementById('displayed-point-count').innerText = formatPointCount(
            entity.displayedPointCount,
        );
    });
}

instance.add(pointCloud).then(onInitialized).catch(console.error);

Inspector.attach('inspector', instance);
