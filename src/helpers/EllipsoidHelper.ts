/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    ArrowHelper,
    AxesHelper,
    BufferAttribute,
    BufferGeometry,
    Color,
    LineSegments,
    MeshBasicMaterial,
    Object3D,
    Vector3,
    type ColorRepresentation,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type Disposable from '../core/Disposable';

import Ellipsoid from '../core/geographic/Ellipsoid';
import { Vector3Array } from '../core/VectorArray';

const tmp = {
    a: new Vector3(),
    b: new Vector3(),
};

function createParallel(
    ellipsoid: Ellipsoid,
    latitude: number,
    segments: number,
    positions: Vector3Array,
    colors: Vector3Array,
    color: Color,
): void {
    const step = 360 / segments;

    let longitude = 0;

    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);

    for (let i = 0; i <= segments; i++) {
        const v0 = ellipsoid.toCartesian(latitude, longitude, 0, tmp.a);
        const v1 = ellipsoid.toCartesian(latitude, longitude + step, 0, tmp.b);

        longitude += step;

        positions.pushVector(v0);
        positions.pushVector(v1);

        colors.push(r, g, b);
        colors.push(r, g, b);
    }
}

function createMeridian(
    ellipsoid: Ellipsoid,
    longitude: number,
    segments: number,
    target: Vector3Array,
    colors: Vector3Array,
    color: Color,
): void {
    const step = 360 / segments;

    let latitude = -90;

    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);

    for (let i = 0; i <= segments / 2; i++) {
        const v0 = ellipsoid.toCartesian(latitude, longitude, 0, tmp.a);
        const v1 = ellipsoid.toCartesian(latitude + step, longitude, 0, tmp.b);

        latitude += step;

        target.pushVector(v0);
        target.pushVector(v1);

        colors.push(r, g, b);
        colors.push(r, g, b);
    }
}

function createLabel(text: string, color: ColorRepresentation): CSS2DObject {
    const div = document.createElement('div');

    div.style.textAlign = 'center';
    div.style.verticalAlign = 'middle';
    div.style.textShadow = 'black 0 0 3px';
    div.style.fontWeight = 'bold';
    div.style.color = '#' + new Color(color).getHexString();

    div.innerText = text;

    const label = new CSS2DObject(div);

    label.name = text;

    return label;
}

/**
 * Displays an ellipsoid along with its axes.
 */
export default class EllipsoidHelper extends Object3D implements Disposable {
    public readonly isEllipsoidHelper = true as const;
    public override readonly type = 'EllipsoidHelper' as const;

    public readonly ellipsoid: Ellipsoid;

    private readonly _mesh: LineSegments<BufferGeometry, MeshBasicMaterial>;
    private readonly _axes: AxesHelper;
    private readonly _labels: CSS2DObject[];
    private readonly _arrows: ArrowHelper[] = [];

    private _showNormals = false;
    private _disposed = false;

    /**
     * The color of the lines.
     */
    public get color(): Color {
        return this._mesh.material.color;
    }

    public set color(c: Color) {
        this._mesh.material.color = c;
    }

    public get showLines(): boolean {
        return this._mesh.visible;
    }

    public set showLines(show: boolean) {
        this._mesh.visible = show;
    }

    public get showAxes(): boolean {
        return this._axes.visible;
    }

    public set showAxes(show: boolean) {
        this._axes.visible = show;
    }

    public get showNormals(): boolean {
        return this._showNormals;
    }

    public set showNormals(show: boolean) {
        if (this._showNormals !== show) {
            this._showNormals = show;
            if (show) {
                this.createNormalArrows();
            } else {
                this.deleteNormalArrows();
            }
        }
    }

    public get showLabels(): boolean {
        return this._labels[0].visible;
    }

    public set showLabels(show: boolean) {
        this._labels.forEach(l => (l.visible = show));
    }

    public constructor(params?: {
        /**
         * The ellipsoid to use.
         * @defaultValue {@link Ellipsoid.WGS84}
         */
        ellipsoid?: Ellipsoid;
        /**
         * The number of parallels, including the equator. Must be an odd number. 0 disable parallels.
         * @defaultValue 5
         */
        parallels?: number;
        /**
         * The number of meridians.
         * @defaultValue 24 (one per timezone)
         */
        meridians?: number;
        /**
         * The number of segments.
         * @defaultValue 32
         */
        segments?: number;
        /**
         * The color of the lines (except equator and prime meridian).
         * @defaultValue grey
         */
        lineColor?: ColorRepresentation;
        /**
         * The color of the equator line.
         * @defaultValue #FF4F93
         */
        equatorColor?: ColorRepresentation;
        /**
         * The color of the prime meridian line.
         * @defaultValue #75B1C7
         */
        primeMeridianColor?: ColorRepresentation;
    }) {
        super();

        this.ellipsoid = params?.ellipsoid ?? Ellipsoid.WGS84;
        const meridianCount = params?.meridians ?? 24;
        const segments = params?.segments ?? 32;
        const parallelCount = params?.parallels ?? 5;

        const mainColor =
            params?.lineColor != null ? new Color(params?.lineColor) : new Color('grey');

        const primeMeridianColor =
            params?.primeMeridianColor != null
                ? new Color(params.primeMeridianColor)
                : new Color('#75b1c7');

        if (parallelCount % 2 === 0) {
            throw new Error(`parallels must be an odd number, got: ${parallelCount}`);
        }

        const vectors = new Vector3Array(new Float32Array(3000));
        vectors.length = 0;

        const colors = new Vector3Array(new Uint8ClampedArray(3000));
        colors.length = 0;

        // equator
        if (parallelCount > 0) {
            const equatorColor =
                params?.equatorColor != null
                    ? new Color(params.equatorColor)
                    : new Color('#ff4f93');
            createParallel(this.ellipsoid, 0, segments, vectors, colors, equatorColor);
        }

        const parallelsPerHemisphere = (parallelCount - 1) / 2;
        const latitudeStep = 90 / (parallelsPerHemisphere + 1);
        let latitude = latitudeStep;

        for (let index = 0; index < parallelsPerHemisphere; index++) {
            createParallel(this.ellipsoid, +latitude, segments, vectors, colors, mainColor);
            createParallel(this.ellipsoid, -latitude, segments, vectors, colors, mainColor);

            latitude += latitudeStep;
        }

        let longitude = 0;
        const longitudeStep = 360 / meridianCount;

        for (let index = 0; index < meridianCount; index++) {
            const color = index === 0 ? primeMeridianColor : mainColor;
            createMeridian(this.ellipsoid, longitude, segments, vectors, colors, color);
            longitude += longitudeStep;
        }

        const positionBuffer = new BufferAttribute(vectors.toFloat32Array(), 3);
        colors.trim();
        const colorBuffer = new BufferAttribute(colors.array, 3, true);

        const geometry = new BufferGeometry();

        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('color', colorBuffer);

        this._mesh = new LineSegments(geometry, new MeshBasicMaterial({ vertexColors: true }));
        this._mesh.name = 'lines';

        this._axes = new AxesHelper(this.ellipsoid.semiMajorAxis * 1.3);
        this._axes.name = 'axes';
        this._axes.scale.set(1, 1, this.ellipsoid.compressionFactor);

        const xLabel = createLabel('+X', new Color(1, 0.2, 0));
        const yLabel = createLabel('+Y', new Color(0.2, 1, 0));
        const zLabel = createLabel('+Z', new Color(0, 0.2, 1));

        zLabel.position.copy(
            this.ellipsoid.toCartesian(+90, 0, this.ellipsoid.semiMinorAxis * 0.4),
        );
        yLabel.position.copy(
            this.ellipsoid.toCartesian(0, +90, this.ellipsoid.semiMajorAxis * 0.4),
        );
        xLabel.position.copy(this.ellipsoid.toCartesian(0, 0, this.ellipsoid.semiMajorAxis * 0.4));

        this.add(xLabel);
        this.add(yLabel);
        this.add(zLabel);

        this._labels = [xLabel, yLabel, zLabel];

        this.add(this._mesh);
        this.add(this._axes);

        this.updateMatrixWorld(true);
    }

    private deleteNormalArrows(): void {
        if (this._arrows.length > 0) {
            this._arrows.forEach(arrow => {
                arrow.dispose();
                arrow.removeFromParent();
            });
            this._arrows.length = 0;
        }
    }

    private createNormalArrows(): void {
        const normal = new Vector3();
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 20; j++) {
                const lat = i * 18 - 90;
                const lon = j * 18 - 180;

                const origin = this.ellipsoid.toCartesian(lat, lon, 0);
                this.ellipsoid.getNormal(lat, lon, normal);

                const arrow = new ArrowHelper(
                    normal,
                    origin,
                    this.ellipsoid.semiMajorAxis * 0.3,
                    'yellow',
                );
                this.add(arrow);
                arrow.updateMatrixWorld(true);
                this._arrows.push(arrow);
            }
        }
    }

    public dispose(): void {
        if (this._disposed) {
            return;
        }

        this._disposed = true;
        this._mesh.geometry.dispose();
        this._mesh.material.dispose();
        this._axes.dispose();

        this._labels.forEach(l => l.element.remove);
        this._labels.length = 0;

        this._arrows.forEach(a => {
            a.dispose();
            a.removeFromParent();
        });
        this._arrows.length = 0;

        this.clear();
    }
}
