/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Camera, Curve, Euler, Object3D } from 'three';

import { CatmullRomCurve3, Clock, EventDispatcher, LineCurve3, MathUtils, Vector3 } from 'three';

import type Disposable from '../core/Disposable';
import type Progress from '../core/Progress';
import type Shape from '../entities/Shape';

import { isShape } from '../entities/Shape';
import { isObject3D } from '../utils/predicates';

export interface CameraAnimatorEvents {
    dispose: unknown;
    update: unknown;
}

const tempPosition = new Vector3();

export type CameraOrientation = Object3D | Euler | 'follow';

export default class CameraAnimator
    extends EventDispatcher<CameraAnimatorEvents>
    implements Progress, Disposable
{
    private readonly _camera: Camera;

    private _interpolant = 0;
    private _abortController: AbortController | null = null;
    private _offset: Vector3 | null = null;

    private _orientation: CameraOrientation = 'follow';
    private _curveLength = 0;
    private _curve: Curve<Vector3> | null = null;
    private _speed = 10;

    public constructor(camera: Camera) {
        super();
        this._camera = camera;
    }

    /**
     * The speed, in meters/second.
     */
    public set speed(value: number) {
        this._speed = value;
    }

    public get speed(): number {
        return this._speed;
    }

    public setPath(path: Vector3[] | Curve<Vector3> | Shape): this {
        this.stop();
        this.reset();

        if (Array.isArray(path) || isShape(path)) {
            const points = isShape(path) ? path.points : path;

            if (points.length >= 2) {
                if (points.length === 2) {
                    this._curve = new LineCurve3(points[0], points[1]);
                } else {
                    const closed = points.length > 3 && points[0].equals(points[points.length - 1]);
                    this._curve = new CatmullRomCurve3([...points], closed);
                }
            } else {
                throw new Error('the path must contain at least two points');
            }
        } else {
            this._curve = path;
        }

        if (this._curve != null) {
            this._curve.updateArcLengths();
            this._curveLength = this._curve.getLength();
        }

        return this;
    }

    public setCameraOffset(offset?: Vector3): void {
        this._offset = offset ?? null;
    }

    public setCameraOrientation(orientation: CameraOrientation): void {
        this._orientation = orientation;
    }

    private updateCameraTarget(curve: Curve<Vector3>): void {
        if (this._orientation === 'follow') {
            const lookAt = curve.getPointAt(this._interpolant + 0.01);
            if (this._offset != null) {
                lookAt.add(this._offset);
            }
            // TODO better "next point" determination
            this._camera.lookAt(lookAt);
        } else if (isObject3D(this._orientation)) {
            this._orientation.updateMatrixWorld(true);
            const lookAt = this._orientation.getWorldPosition(tempPosition);
            if (this._offset != null) {
                lookAt.add(this._offset);
            }
            this._camera.lookAt(lookAt);
        } else {
            this._camera.setRotationFromEuler(this._orientation);
        }
    }

    public play(): void {
        if (this._curve == null) {
            throw new Error('no path set.');
        }

        this.stop();

        this._abortController = new AbortController();
        const signal = this._abortController.signal;
        const clock = new Clock();
        const curve = this._curve;

        const step = (): void => {
            if (signal.aborted) {
                return;
            }

            // Delta in second since last frame
            const dt = clock.getDelta();
            // Delta in meters since last frame
            const dd = dt * this.speed;
            // Delta in normalized value [0, 1]
            const dn = dd / this._curveLength;

            this._interpolant += dn;

            if (this._interpolant >= 1) {
                return;
            }

            this._interpolant = MathUtils.clamp(this._interpolant, 0, 1);

            const cameraPosition = curve.getPointAt(this._interpolant, tempPosition);

            if (this._offset != null) {
                cameraPosition.add(this._offset);
            }

            this._camera.position.copy(cameraPosition);

            this.updateCameraTarget(curve);

            this._camera.updateMatrixWorld(true);

            this.dispatchEvent({ type: 'update' });

            requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    }

    public stop(): void {
        this._abortController?.abort();
        this._abortController = null;
    }

    public reset(): void {
        this._interpolant = 0;
    }

    public get loading(): boolean {
        throw new Error('Method not implemented.');
    }

    public get progress(): number {
        throw new Error('Method not implemented.');
    }

    public dispose(): void {
        this.dispatchEvent({ type: 'dispose' });
    }
}
