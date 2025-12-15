/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { GlobeControls } from '3d-tiles-renderer';
import {
    GoogleCloudAuthPlugin,
    TileCompressionPlugin,
    TilesFadePlugin,
    UnloadTilesPlugin,
    UpdateOnChangePlugin,
} from '3d-tiles-renderer/plugins';
import { Vector3 } from 'three';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D.js';
import Inspector from '@giro3d/giro3d/gui/Inspector.js';

import StatusBar from './widgets/StatusBar.js';

function run(apiKey) {
    const instance = new Instance({
        target: 'view',
        crs: CoordinateSystem.epsg4978,
        backgroundColor: 'black',
    });

    // Note that we need the DRACO and Basis libraries.
    // You can omit those parameters to use the default URLs which use a CDN.
    const entity = new Tiles3D({
        dracoDecoderPath: '/assets/wasm/',
        ktx2DecoderPath: '/assets/wasm/',
    });

    const tiles = entity.tiles;

    const view = instance.view;

    view.minNearPlane = 200;

    const camera = view.camera;
    camera.up = new Vector3(0, 0, 1);
    camera.position.set(30_000_000, 0, 0);
    camera.lookAt(0, 0, 0);

    camera.updateMatrixWorld();

    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new UpdateOnChangePlugin());
    tiles.registerPlugin(new UnloadTilesPlugin());
    tiles.registerPlugin(new TilesFadePlugin());

    const controls = new GlobeControls(instance.scene, camera, instance.domElement, tiles);
    controls.enableDamping = true;

    /** @type {Array<{ type: string, value: any }>} */
    const attributions = [];

    function updateAttributions() {
        attributions.length = 0;

        entity.tiles.getAttributions(attributions);

        const text = attributions.map(a => a.value).join(',');

        StatusBar.setAttributionHtml(`© ${text}`);
    }

    function animate() {
        const altitude = controls.getDistanceToCenter() - 6_400_000;

        if (altitude > 100_000) {
            view.minNearPlane = 2000;
        } else if (altitude > 1_000) {
            view.minNearPlane = 200;
        } else {
            view.minNearPlane = 2;
        }

        controls.update();

        instance.notifyChange(entity);

        updateAttributions();

        requestAnimationFrame(animate);
    }

    animate();

    controls.update();

    instance.add(entity);

    Inspector.attach('inspector', instance);

    StatusBar.bind(instance);
}

let key = new URL(document.URL).searchParams.get('key');

if (key != null) {
    run(key);
} else {
    document.getElementById('warning').style.display = 'block';
}

document.getElementById('start').onclick = () => {
    // @ts-expect-error value does not exist on HtmlElement
    const enteredKey = document.getElementById('googleApiKey').value;

    if (enteredKey != null) {
        const url = new URL(document.URL);
        url.searchParams.delete('key');

        url.searchParams.append('key', enteredKey);

        window.history.replaceState({}, null, url.toString());

        run(enteredKey);

        document.getElementById('warning').style.display = 'none';
    }
};
