/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Vector2 } from 'three';

import {
    ArrowHelper,
    BackSide,
    FrontSide,
    GridHelper,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    Plane,
    PlaneGeometry,
    Vector3,
} from 'three';
import { TransformControls } from 'three/examples/jsm/Addons.js';

import type Disposable from '../core/Disposable';
import type HasClippingPlanes from '../core/HasClippingPlanes';
import type Instance from '../core/Instance';

import Shape from '../entities/Shape';

const tmpDirection = new Vector3();

type Parameters = {
    /** Is the clipping plane enabled on this object ? */
    enabled: boolean;
    /** Is the clipping plane negated on this object ? */
    negated: boolean;
};

export default class CrossSectionTool implements Disposable {
    private readonly _trackedObjects: Map<HasClippingPlanes, Parameters> = new Map();

    private readonly _plane: Plane;
    private readonly _negatedPlane: Plane;
    private readonly _instance: Instance;
    private readonly _onUpdate: () => void;
    private readonly _onUpdateAndNotify: () => void;
    private readonly _controls: TransformControls;
    private readonly _dummy = new Object3D();
    private readonly _planeRepresentation: Mesh;
    private readonly _originPoint = new Shape();
    private readonly _planeOrientationArrow = new ArrowHelper(
        undefined,
        undefined,
        undefined,
        'cyan',
    );

    public get showPlaneHelper(): boolean {
        return this._planeRepresentation.visible;
    }

    public get controls(): TransformControls {
        return this._controls;
    }

    public set showPlaneHelper(v: boolean) {
        if (this._planeRepresentation.visible !== v) {
            this._planeRepresentation.visible = v;
            this._instance.notifyChange();
        }
    }

    public constructor(params: { instance: Instance }) {
        this._plane = new Plane();
        this._negatedPlane = this._plane.clone().negate();

        this._instance = params.instance;

        this._controls = new TransformControls(
            this._instance.view.camera,
            this._instance.domElement,
        );

        this._dummy.name = 'CrossSectionTool-dummy';
        this._instance.add(this._dummy);
        this._controls.attach(this._dummy);

        this._planeRepresentation = new Mesh(
            new PlaneGeometry(1, 1, 1, 1),
            new MeshBasicMaterial({
                color: 'cyan',
                opacity: 0.2,
                transparent: true,
                side: FrontSide,
            }),
        );
        const backside = new Mesh(
            new PlaneGeometry(1, 1, 1, 1),
            new MeshBasicMaterial({
                color: 'red',
                opacity: 0.2,
                transparent: true,
                side: BackSide,
            }),
        );
        const grid = new GridHelper(1, 20, 'white', 'black');
        this._dummy.add(this._planeRepresentation);
        grid.rotateX(MathUtils.degToRad(90));
        this._planeRepresentation.scale.set(1, 1, 1);
        this._planeRepresentation.add(grid);
        this._planeRepresentation.add(backside);

        this._planeRepresentation.updateMatrixWorld(true);

        const helper = this._controls.getHelper();

        this._controls.connect();

        this._controls.enabled = true;
        this._controls.space = 'local';
        // TODO
        // this._controls.setRotationSnap(MathUtils.degToRad(15));

        this._onUpdate = this.update.bind(this);
        this._onUpdateAndNotify = this.updateAndNotify.bind(this);
        this._instance.addEventListener('update-end', this._onUpdate);
        this._controls.addEventListener('change', this._onUpdateAndNotify);

        this._instance.add(helper);

        this._originPoint.color = 'cyan';
        this._originPoint.showVertices = true;
        this._instance.add(this._originPoint);
        this._instance.add(this._planeOrientationArrow);
    }

    public setPlaneHelperSize(size: Vector2): void {
        this._planeRepresentation.scale.set(size.width, size.height, 1);
        this._planeRepresentation.updateMatrixWorld(true);
    }

    public setControlMode(mode: 'rotate' | 'translate'): void {
        this._controls.setMode(mode);

        this._controls.showX = false;
        this._controls.showY = false;
        this._controls.showZ = false;

        switch (mode) {
            case 'rotate':
                // Rotating around the normal of the plane makes no sense
                this._controls.showX = true;
                this._controls.showY = true;
                break;
            case 'translate':
                // Translating on the XY plane itself makes no sense as well
                this._controls.showZ = true;
                break;
        }
    }

    private updateAndNotify(): void {
        this.update();

        this._instance.notifyChange();
    }

    private update(): void {
        const direction = this._dummy.getWorldDirection(tmpDirection);
        const origin = this._dummy.position;

        this._planeOrientationArrow.setDirection(direction);
        this._planeOrientationArrow.position.copy(origin);
        this._planeOrientationArrow.setLength(10000);
        this._planeOrientationArrow.updateMatrixWorld(true);

        this._plane.setFromNormalAndCoplanarPoint(direction, origin);

        this._negatedPlane.copy(this._plane).negate();
        this._controls.getHelper().updateMatrixWorld(true);
        this._planeRepresentation.updateMatrixWorld(true);

        this._originPoint.setPoints([origin]);

        this._trackedObjects.forEach((params, obj) => {
            this.updateObject(obj, params);
        });
    }

    private updateObject(obj: HasClippingPlanes, params: Parameters): void {
        if (params.enabled) {
            if (params.negated) {
                obj.clippingPlanes = [this._plane];
            } else {
                obj.clippingPlanes = [this._negatedPlane];
            }
        } else {
            obj.clippingPlanes = null;
        }
    }

    public setPlane(origin: Vector3, direction: Vector3): void {
        this._dummy.position.copy(origin);
        this._dummy.lookAt(origin.clone().add(direction));

        this.update();
    }

    public add(
        obj: HasClippingPlanes,
        options?: { enabled?: boolean; negated?: boolean },
    ): boolean {
        if (this._trackedObjects.has(obj)) {
            return false;
        }

        const params: Parameters = {
            enabled: options?.enabled ?? true,
            negated: options?.negated ?? false,
        };

        this._trackedObjects.set(obj, params);

        this.updateObject(obj, params);

        return true;
    }

    public get plane(): Plane {
        return this._plane;
    }

    /**
     * Disposes the tool and removes the clipping planes on all tracked objects.
     */
    public dispose(): void {
        this._trackedObjects.forEach((v, k) => {
            k.clippingPlanes = null;
        });

        this._instance.scene.remove(this._controls.getHelper());

        this._instance.removeEventListener('update-end', this._onUpdate);
        this._controls.removeEventListener('change', this._onUpdateAndNotify);

        // TODO delete objects (helper, etc)
    }
}
