/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import { Vector3 } from 'three';

import type Instance from '../core/Instance';
import type Entity3D from '../entities/Entity3D';

import Ellipsoid from '../core/geographic/Ellipsoid';
import { isEntity3D } from '../entities/Entity3D';
import Viewshed, { ViewshedMode } from '../interactions/Viewshed';
import Panel from './Panel';

export default class ViewshedPanel extends Panel {
    private _viewshed: Viewshed | null = null;

    private readonly _parameters = {
        enabled: false,
        maxDistance: 1000,
        minDistance: 1,
        bias: 1,
        offset: 5,
        observer: new Vector3(0, 0, 0),
    };

    public constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Viewshed');

        this.addController(this._parameters, 'maxDistance');
        this.addController(this._parameters, 'minDistance');
        this.addController(this._parameters, 'bias');
        this.addController(this._parameters, 'offset');
        this.addController(this._parameters, 'enabled').onChange(v => {
            if (!v && this._viewshed) {
                this._viewshed.dispose();
                this._viewshed = null;
            }
        });

        instance.domElement.addEventListener('mousemove', e => {
            if (this._parameters.enabled) {
                const results = instance.pickObjectsAt(e);
                if (results.length > 0) {
                    const point = results[0].point;
                    const normal = results[0].normal;
                    if (normal) {
                        point.addScaledVector(normal, this._parameters.offset);
                    } else {
                        const up = this.instance.coordinateSystem.isEpsg(4978)
                            ? Ellipsoid.WGS84.getNormalFromCartesian(point)
                            : new Vector3(0, 0, 1);
                        point.addScaledVector(up, this._parameters.offset);
                    }
                    this._parameters.observer.copy(point);
                }
            }
        });

        instance.addEventListener('after-render', () => {
            if (this._parameters.enabled && !this._viewshed) {
                this._viewshed = new Viewshed({
                    minDistance: 5,
                    instance,
                    maxDistance: 500,
                    objects: instance.getEntities(e => isEntity3D(e)) as unknown as Entity3D[],
                    mode: ViewshedMode.Omnidirectional,
                });
            }

            if (this._viewshed) {
                this._viewshed.bias = this._parameters.bias;
                this._viewshed.minDistance = this._parameters.minDistance;
                this._viewshed.maxDistance = this._parameters.maxDistance;
                this._viewshed.origin = this._parameters.observer;
                this._viewshed.render();
            }
        });
    }
}
