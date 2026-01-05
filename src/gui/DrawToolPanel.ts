/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import { Color } from 'three';

import type Instance from '../core/Instance';
import type Shape from '../entities/Shape';
import type { LineLabelFormatter, SurfaceLabelFormatter } from '../entities/Shape';

import Coordinates from '../core/geographic/Coordinates';
import CoordinateSystem from '../core/geographic/CoordinateSystem';
import { DEFAULT_COLOR, type VertexLabelFormatter } from '../entities/Shape';
import DrawTool from '../interactions/DrawTool';
import Panel from './Panel';

const vertexLabelFormatter: (instance: Instance) => VertexLabelFormatter =
    (instance: Instance) =>
    ({ position }) => {
        const latlon = new Coordinates(instance.coordinateSystem, position.x, position.y).as(
            CoordinateSystem.epsg4326,
        );

        return `lat: ${latlon.latitude.toFixed(5)}°, lon: ${latlon.longitude.toFixed(5)}°`;
    };

const lineLabelFormatter: LineLabelFormatter = params => {
    const length = params.length;
    let precision = 1;
    if (length < 1) {
        precision = 2;
    }
    if (length < 0.5) {
        precision = 3;
    }
    return length.toFixed(precision);
};

const surfaceLabelFormatter: SurfaceLabelFormatter = params => {
    const area = params.area;
    let precision = 1;
    if (area < 1) {
        precision = 2;
    }
    if (area < 0.5) {
        precision = 3;
    }
    return area.toFixed(precision);
};

export default class DrawToolPanel extends Panel {
    private readonly _shapes: Shape[] = [];
    private _drawTool?: DrawTool;

    public color: Color = new Color(DEFAULT_COLOR);

    public get pendingColor(): Color {
        return new Color(this.color).offsetHSL(0, 0, -0.1);
    }

    public constructor(parent: GUI, instance: Instance) {
        super(parent, instance, 'DrawTool');

        this.addColorController(this, 'color').onChange(c =>
            this._shapes.forEach(shape => (shape.color = c)),
        );
        this.addController(this, 'createSegment').name('Segment');
        this.addController(this, 'createPolygon').name('Polygon');
        this.addController(this, 'createPoint').name('Point');
        this.addController(this, 'clear').name('Clear');
    }

    private onShapeFinished(shape: Shape | null): void {
        if (shape != null) {
            shape.color = this.color;
            this._shapes.push(shape);
        }
    }

    private createDrawToolIfNecessary(): DrawTool {
        if (!this._drawTool) {
            this._drawTool = new DrawTool({
                instance: this.instance,
                domElement: this.instance.domElement,
            });
        }

        return this._drawTool;
    }

    public createSegment(): void {
        const tool = this.createDrawToolIfNecessary();

        tool.createSegment({
            showLineLabel: true,
            color: this.pendingColor,
            lineLabelFormatter,
        }).then(shape => this.onShapeFinished(shape));
    }

    public createPoint(): void {
        const tool = this.createDrawToolIfNecessary();

        tool.createPoint({
            vertexLabelFormatter: vertexLabelFormatter(this.instance),
            showVertexLabels: true,
            color: this.pendingColor,
        }).then(shape => this.onShapeFinished(shape));
    }

    public createPolygon(): void {
        const tool = this.createDrawToolIfNecessary();

        tool.createPolygon({
            showSurfaceLabel: true,
            color: this.pendingColor,
            surfaceLabelFormatter,
        }).then(shape => this.onShapeFinished(shape));
    }

    public clear(): void {
        this._shapes.forEach(shape => this.instance.remove(shape));
        this._shapes.length = 0;
    }
}
