/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import StadiaMaps from 'ol/source/StadiaMaps.js';
import { WebGLRenderer } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer.js';
import Map from '@giro3d/giro3d/entities/Map.js';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';

const extent = new Extent(
    CoordinateSystem.epsg3857,
    -20037508.342789244,
    20037508.342789244,
    -20037508.342789244,
    20037508.342789244,
);

const source = new TiledImageSource({
    source: new StadiaMaps({ layer: 'stamen_watercolor', wrapX: false }),
});

function buildViewer(target, defaultRenderer = true) {
    const instance = new Instance({
        target,
        crs: extent.crs,
        backgroundColor: null,
        renderer: defaultRenderer ? null : new WebGLRenderer({ antialias: true, alpha: true }),
    });

    const map = new Map({ extent, maxSubdivisionLevel: 10 });

    instance.add(map);

    map.addLayer(new ColorLayer({ source })).catch(e => console.error(e));

    instance.view.camera.position.set(0, 0, 25000000);

    const controls = new MapControls(instance.view.camera, instance.domElement);

    instance.view.setControls(controls);

    // Disable zoom so it doesn't capture scrolling
    controls.enableZoom = false;
}

// Remove the pre-generated default HTML elements for this example
document.getElementById('view').remove();
document.getElementById('inspector').remove();

// Dynamically find all viewers we have to build
const viewerDivs = document.getElementsByClassName('viewer');
for (let i = 0; i < viewerDivs.length; i += 1) {
    buildViewer(viewerDivs[i]);
}

// Dynamically find all viewers we have to build with custom WebGLRenderers
const viewerCustomRendererDivs = document.getElementsByClassName('viewer-custom-renderer');
for (let i = 0; i < viewerCustomRendererDivs.length; i += 1) {
    buildViewer(viewerCustomRendererDivs[i], false);
}
