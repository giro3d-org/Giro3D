import colormap from 'colormap';

import { Color } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import GeoTIFFSource from '@giro3d/giro3d/sources/GeoTIFFSource.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import ElevationLayer from '@giro3d/giro3d/core/layer/ElevationLayer.js';
import Interpretation from '@giro3d/giro3d/core/layer/Interpretation.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';
import ColorMap, { ColorMapMode } from '@giro3d/giro3d/core/ColorMap.js';

import StatusBar from './widgets/StatusBar.js';
import { makeColorRamp } from './widgets/makeColorRamp.js';
import { bindDropDown } from './widgets/bindDropDown.js';

const extent = new Extent('EPSG:3857', -13581040.085, -13469591.026, 5780261.83, 5942165.048);

const instance = new Instance({
    target: 'view',
    crs: extent.crs,
});

instance.view.camera.position.set(-13656319, 5735451, 88934);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;
controls.target.set(-13545408, 5837154, 0);
instance.view.setControls(controls);

const map = new Map({
    extent,
    backgroundColor: 'gray',
    hillshading: true,
});
instance.add(map);

// Use an elevation COG with nodata values
const source = new GeoTIFFSource({
    // https://www.sciencebase.gov/catalog/item/632a9a9ad34e71c6d67b95a3
    url: 'https://3d.oslandia.com/cog_data/COG_EPSG3857_USGS_13_n47w122_20220919.tif',
    crs: extent.crs,
});

const min = 263;
const max = 4347;

// Display it as elevation and color
const viridis = new ColorMap(makeColorRamp('viridis'), min, max, ColorMapMode.Elevation);
const magma = new ColorMap(makeColorRamp('magma'), min, max, ColorMapMode.Elevation);

// Attach the inspector
Inspector.attach('inspector', instance);

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

bindDropDown('mode', updateMode);

updateMode('elevation');
