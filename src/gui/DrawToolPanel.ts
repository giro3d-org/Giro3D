import type GUI from 'lil-gui';
import { Color } from 'three';
import Coordinates from '../core/geographic/Coordinates';
import type Instance from '../core/Instance';
import type Shape from '../entities/Shape';
import { DEFAULT_COLOR, type VertexLabelFormatter } from '../entities/Shape';
import DrawTool from '../interactions/DrawTool';
import Panel from './Panel';

const vertexLabelFormatter: (instance: Instance) => VertexLabelFormatter =
    (instance: Instance) =>
    ({ position }) => {
        const latlon = new Coordinates(instance.referenceCrs, position.x, position.y).as(
            'EPSG:4326',
        );

        return `lat: ${latlon.latitude.toFixed(5)}°, lon: ${latlon.longitude.toFixed(5)}°`;
    };

export default class DrawToolPanel extends Panel {
    private readonly _shapes: Shape[] = [];
    private _drawTool?: DrawTool;

    color: Color = new Color(DEFAULT_COLOR);

    get pendingColor() {
        return new Color(this.color).offsetHSL(0, 0, -0.1);
    }

    constructor(parent: GUI, instance: Instance) {
        super(parent, instance, 'DrawTool');

        this.addColorController(this, 'color').onChange(c =>
            this._shapes.forEach(shape => (shape.color = c)),
        );
        this.addController(this, 'createSegment').name('Segment');
        this.addController(this, 'createPolygon').name('Polygon');
        this.addController(this, 'createPoint').name('Point');
        this.addController(this, 'clear').name('Clear');
    }

    private onShapeFinished(shape: Shape | null) {
        if (shape != null) {
            shape.color = this.color;
            this._shapes.push(shape);
        }
    }

    private createDrawToolIfNecessary() {
        if (!this._drawTool) {
            this._drawTool = new DrawTool({
                instance: this.instance,
                domElement: this.instance.domElement,
            });
        }

        return this._drawTool;
    }

    createSegment() {
        const tool = this.createDrawToolIfNecessary();

        tool.createSegment({
            showLineLabel: true,
            color: this.pendingColor,
        }).then(shape => this.onShapeFinished(shape));
    }

    createPoint() {
        const tool = this.createDrawToolIfNecessary();

        tool.createPoint({
            vertexLabelFormatter: vertexLabelFormatter(this.instance),
            showVertexLabels: true,
            color: this.pendingColor,
        }).then(shape => this.onShapeFinished(shape));
    }

    createPolygon() {
        const tool = this.createDrawToolIfNecessary();

        tool.createPolygon({
            showSurfaceLabel: true,
            color: this.pendingColor,
        }).then(shape => this.onShapeFinished(shape));
    }

    clear() {
        this._shapes.forEach(shape => this.instance.remove(shape));
        this._shapes.length = 0;
    }
}
