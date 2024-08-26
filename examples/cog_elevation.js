import colormap from 'colormap';

import { Color } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import CogSource from '@giro3d/giro3d/sources/CogSource.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/layer/ColorMap.js';

import StatusBar from './widgets/StatusBar.js';

const extent = new Extent('EPSG:3857', -13581040.085, -13469591.026, 5780261.83, 5942165.048);

// Instantiate Giro3D
const instance = new Instance({
    target: 'view',
    crs: extent.crs(),
});

// Instantiate the camera
instance.view.camera.position.set(-13656319, 5735451, 88934);

// Instantiate the controls
const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(-13545408, 5837154, 0);
instance.useTHREEControls(controls);

// Construct a map and add it to the instance
const map = new Map({
    extent,
    backgroundColor: 'gray',
    hillshading: true,
});
instance.add(map);

// Use an elevation COG with nodata values
const source = new CogSource({
    // https://www.sciencebase.gov/catalog/item/632a9a9ad34e71c6d67b95a3
    url: 'https://3d.oslandia.com/cog_data/COG_EPSG3857_USGS_13_n47w122_20220919.tif',
    crs: extent.crs(),
});

function makeColorMap(name) {
    return colormap({ colormap: name, nshades: 256 }).map(v => new Color(v));
}

const min = 263;
const max = 4347;

// Display it as elevation and color
const viridis = new ColorMap(makeColorMap('viridis'), min, max, ColorMapMode.Elevation);
const magma = new ColorMap(makeColorMap('magma'), min, max, ColorMapMode.Elevation);

// Attach the inspector
Inspector.attach(document.getElementById('panelDiv'), instance);

StatusBar.bind(instance);

function updateMode(value) {
    map.removeLayer(map.getLayers()[0]);

    switch (value) {
        case 'elevation-colormap':
            map.addLayer(
                new ElevationLayer({
                    name: value,
                    extent,
                    source,
                    colorMap: viridis,
                    minmax: { min, max },
                }),
            );
            break;
        case 'elevation':
            map.addLayer(
                new ElevationLayer({
                    name: value,
                    extent,
                    source,
                    minmax: { min, max },
                }),
            );
            break;
        case '8bit':
            map.addLayer(
                new ColorLayer({
                    name: value,
                    extent,
                    source,
                    interpretation: Interpretation.CompressTo8Bit(min, max),
                }),
            );
            break;
        case 'colormap':
            map.addLayer(
                new ColorLayer({
                    name: value,
                    extent,
                    source,
                    colorMap: magma,
                }),
            );
            break;
        default:
            break;
    }

    instance.notifyChange(map);
}

const mode = document.getElementById('mode');
mode.onchange = () => updateMode(mode.value);
updateMode(mode.value);
