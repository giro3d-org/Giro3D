import type { ColorRepresentation, Object3D } from 'three';
import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Group,
    LineBasicMaterial,
    LineSegments,
    MathUtils,
    Sphere,
    Vector2,
    Vector3,
    type Box3,
    type Camera,
} from 'three';

import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type Context from '../core/Context';
import { crsToUnit, UNIT } from '../core/geographic/Coordinates';
import type Extent from '../core/geographic/Extent';
import { getGeometryMemoryUsage, type GetMemoryUsageContext } from '../core/MemoryUsage';
import Helpers from '../helpers/Helpers';
import { isBufferGeometry } from '../utils/predicates';
import { nonNull } from '../utils/tsutils';
import type { EntityUserData } from './Entity';
import type { Entity3DEventMap } from './Entity3D';
import Entity3D from './Entity3D';

const mod = MathUtils.euclideanModulo;

const UP = new Vector2(0, 1);
const RIGHT = new Vector2(1, 0);
const tmpVec2 = new Vector2();
const tmpVec3 = new Vector3();

const tmpBl = new Vector2();
const tmpBr = new Vector2();
const tmpTl = new Vector2();
const tmpTr = new Vector2();

const tmp = {
    position: new Vector3(),
    planeNormal: new Vector3(),
    edgeCenter: new Vector3(),
    sideCenter: new Vector3(),
    v2: new Vector2(),
    sphere: new Sphere(),
};

export const DEFAULT_STYLE = {
    color: new Color('white'),
    fontSize: 10,
    numberFormat: new Intl.NumberFormat(),
};

/**
 * The grid step values.
 */
export interface Ticks {
    /** The tick distance on the x axis. */
    x: number;
    /** The tick distance on the y axis. */
    y: number;
    /** The tick distance on the z (vertical) axis. */
    z: number;
}

/**
 * The grid volume.
 */
export interface Volume {
    /** The grid volume extent. */
    extent: Extent;
    /** The elevation of the grid floor. */
    floor: number;
    /** The elevation of the grid ceiling. */
    ceiling: number;
}

/**
 * The grid formatting options.
 */
export interface Style {
    /** The grid line and label colors. */
    color: ColorRepresentation;
    /** The fontsize, in points (pt). */
    fontSize: number;
    /** The number format for the labels. */
    numberFormat: Intl.NumberFormat;
}

/**
 * Describes the starting point of the ticks.
 */
export enum TickOrigin {
    /**
     * Tick values represent distances to the grid's lower left corner
     */
    Relative = 0,
    /**
     * Tick values represent coordinates in the CRS of the scene.
     */
    Absolute = 1,
}

class Side extends LineSegments {
    logicalVisibility = false;
}

class Edge extends Group {
    readonly isEdge = true as const;
    readonly side1: Side;
    readonly side2: Side;

    constructor(side1: Side, side2: Side) {
        super();
        this.side1 = side1;
        this.side2 = side2;
    }
}

function getCssColor(color: ColorRepresentation) {
    return `#${new Color(color).getHexString()}`;
}

function createLabelElement(text: string, color: string, opacity: number, fontSize: number) {
    const div = document.createElement('div');

    // Static properties
    div.style.textAlign = 'center';
    div.style.verticalAlign = 'middle';
    div.style.textShadow = 'black 0 0 3px';

    // Dynamic properties
    div.innerText = text;

    // API exposed properties
    div.style.opacity = `${opacity}`;
    div.style.color = color;
    div.style.fontSize = `${fontSize}pt`;

    return div;
}

/**
 * Create a 3D axis grid. This is represented as a box volume where each side of the box is itself a
 * grid.
 *
 * ```js
 * // Create a 200x200 meters extent
 * const extent = new Extent('EPSG:3857', -100, +100, -100, +100);
 *
 * // Create an AxisGrid on this extent, with the grid floor at zero meters,
 * // and the grid ceiling at 2500 meters.
 * //
 * // Display a tick (grid line), every 10 meters on the horizontal axes,
 * // and every 50 meters on the vertical axis.
 * const grid = new AxisGrid({
 *   volume: {
 *       extent,
 *       floor: 0,
 *       ceiling: 2500,
 *   },
 *   origin: TickOrigin.Relative,
 *   ticks: {
 *       x: 10,
 *       y: 10,
 *       z: 50,
 *   },
 * });
 * ```
 */
class AxisGrid<UserData = EntityUserData> extends Entity3D<Entity3DEventMap, UserData> {
    readonly type = 'AxisGrid' as const;
    /**
     * Read-only flag to check if a given object is of type AxisGrid.
     */
    readonly isAxisGrid = true as const;

    private readonly _root: Group;
    private readonly _labelRoot: Group;
    private readonly _labels: CSS2DObject[];
    private readonly _labelElements: HTMLElement[];
    private _style: Style;
    private _boundingSphere: Sphere;
    private _boundingBoxCenter: Vector3;
    private _origin: TickOrigin;
    private _ticks: Ticks;
    private _unitSuffix: string;
    private _material: LineBasicMaterial;
    private _cameraForward: Vector3;
    private _showFloorGrid: boolean;
    private _showCeilingGrid: boolean;
    private _showSideGrids: boolean;
    private _disposed = false;

    private _volume: Volume;
    private _lastCamera: Camera | null = null;
    private _boundingBox: Box3 | null = null;
    private _dimensions: Vector2 | null = null;
    private _arrowRoot: Group | null = null;
    private _floor: Side | null = null;
    private _ceiling: Side | null = null;
    private _front: Side | null = null;
    private _back: Side | null = null;
    private _left: Side | null = null;
    private _right: Side | null = null;
    private _height: number | null = null;
    private _midHeight: number | null = null;
    private _needsRebuild = false;

    showHelpers: boolean;

    /**
     * Creates an instance of AxisGrid.
     *
     * @param options - The options.
     */
    constructor(options: {
        /**
         * The grid volume
         */
        volume: Volume;
        /**
         * The origin of the ticks volume
         * @defaultValue {@link TickOrigin.Relative}
         */
        origin?: TickOrigin;
        /**
         * The distance between grid lines.
         * @defaultValue 100 on each axis.
         */
        ticks?: Ticks;
        /**
         * The style to apply to lines and labels.
         */
        style?: Partial<Style>;
    }) {
        super(new Group());

        this._root = this.object3d as Group;

        this._labelRoot = new Group();
        this._labelRoot.name = 'labels';
        this._labels = [];
        this._style = {
            color: options.style?.color ?? DEFAULT_STYLE.color,
            fontSize: options.style?.fontSize ?? DEFAULT_STYLE.fontSize,
            numberFormat: options.style?.numberFormat ?? DEFAULT_STYLE.numberFormat,
        };
        this.onObjectCreated(this._labelRoot);
        this._root.add(this._labelRoot);
        this._labelElements = [];
        this._boundingSphere = new Sphere();
        this._boundingBoxCenter = new Vector3();

        if (options.volume == null) {
            throw new Error('options.volume is undefined');
        }

        this._volume = options.volume;
        this._ticks = options.ticks ?? { x: 100, y: 100, z: 100 };
        this._origin = options.origin ?? TickOrigin.Relative;

        const unit = crsToUnit(this.volume.extent.crs);
        switch (unit) {
            case UNIT.METER:
                this._unitSuffix = ' m';
                break;
            case UNIT.DEGREE:
                this._unitSuffix = ' °';
                break;
            default:
                this._unitSuffix = '';
                break;
        }

        const color = new Color(this.style.color);
        this._material = new LineBasicMaterial({ color });

        this._cameraForward = new Vector3();

        this._showFloorGrid = true;
        this._showCeilingGrid = true;
        this._showSideGrids = true;
        this.showHelpers = false;

        this.refresh();
    }

    getMemoryUsage(context: GetMemoryUsageContext) {
        this.traverse(obj => {
            if ('geometry' in obj && isBufferGeometry(obj.geometry)) {
                getGeometryMemoryUsage(context, obj.geometry);
            }
        });
    }

    updateOpacity() {
        const v = this.opacity;
        this._labelElements.forEach(l => {
            l.style.opacity = `${v}`;
        });

        const mat = this._material;
        mat.opacity = v;
        mat.transparent = v < 1.0;
        mat.needsUpdate = true;
    }

    /**
     * Gets or sets the style.
     * You will need to call {@link refresh} to recreate the grid.
     */
    get style() {
        return this._style;
    }

    set style(v) {
        if (v === undefined || v === null) {
            throw new Error('cannot assign undefined/null style');
        }
        this._style = v;
    }

    /**
     * Gets or sets the volume.
     * You will need to call {@link refresh} to recreate the grid.
     */
    get volume() {
        return this._volume;
    }

    set volume(v) {
        if (v === undefined || v === null) {
            throw new Error('cannot assign undefined/null volume');
        }
        this._volume = v;
    }

    /**
     * Gets or sets the tick origin.
     * You will need to call {@link refresh} to recreate the grid.
     */
    get origin() {
        return this._origin;
    }

    set origin(v) {
        if (v === undefined || v === null) {
            throw new Error('cannot assign undefined/null origin');
        }
        this._origin = v;
    }

    /**
     * Gets or sets the grid and label color.
     */
    get color() {
        return this.style.color;
    }

    set color(color) {
        this._material.color = new Color(color);
        this.style.color = color;
        const cssColor = getCssColor(color);
        this._labelElements.forEach(l => {
            l.style.color = cssColor;
        });
    }

    /**
     * Shows or hides labels.
     */
    get showLabels() {
        return this._labelRoot.visible;
    }

    set showLabels(v) {
        if (v !== this._labelRoot.visible) {
            this._labelRoot.visible = v;
            this.updateLabelsVisibility(this._lastCamera);
        }
    }

    /**
     * Shows or hides the floor grid.
     */
    get showFloorGrid() {
        return this._showFloorGrid;
    }

    set showFloorGrid(v) {
        if (v !== this._showFloorGrid) {
            this._showFloorGrid = v;
            this.updateVisibility();
        }
    }

    /**
     * Shows or hides the ceiling grid.
     */
    get showCeilingGrid() {
        return this._showCeilingGrid;
    }

    set showCeilingGrid(v) {
        if (v !== this._showCeilingGrid) {
            this._showCeilingGrid = v;
            this.updateVisibility();
        }
    }

    /**
     * Shows or hides the side grids.
     */
    get showSideGrids() {
        return this._showSideGrids;
    }

    set showSideGrids(v) {
        if (v !== this._showSideGrids) {
            this._showSideGrids = v;
            this.updateVisibility();
        }
    }

    /**
     * Gets or sets the tick intervals.
     * You will need to call {@link refresh} to recreate the grid.
     */
    get ticks() {
        return this._ticks;
    }

    set ticks(v: Ticks) {
        if (v === undefined || v === null) {
            throw new Error('cannot assign undefined/null ticks');
        }
        this._ticks = v;
    }

    /**
     * Rebuilds the grid. This is necessary after changing the ticks, volume or origin.
     */
    refresh() {
        this._needsRebuild = true;
    }

    private rebuildObjects() {
        this.volume.extent.centerAsVector2(tmpVec2);

        this._root.position.setX(tmpVec2.x);
        this._root.position.setY(tmpVec2.y);

        this.buildSides();
        this.buildLabels();

        this._root.updateMatrixWorld();

        this._boundingBox = this.volume.extent.toBox3(this.volume.floor, this.volume.ceiling);
        this._boundingBox.getBoundingSphere(this._boundingSphere);

        this._boundingBox.getCenter(this._boundingBoxCenter);

        this.updateVisibility();
    }

    private removeLabels() {
        const children = [...this._labelRoot.children];
        children.forEach(c => c.removeFromParent());
        this._labelElements.forEach(elt => elt.remove());
        this._labelElements.length = 0;
        this._labels.length = 0;
    }

    updateVisibility() {
        super.updateVisibility();

        this.updateLabelsVisibility(this._lastCamera);
    }

    private buildLabels() {
        // Labels are displayed along each edge of the box volume.
        // There are 12 edges in a box, and those edges are linked to their two sides.

        const labelRoot = this._labelRoot;
        const labelElements = this._labelElements;
        const labels = this._labels;

        this.removeLabels();

        const numberFormat = this.style.numberFormat;
        const cssColor = getCssColor(this.style.color);
        const opacity = this.opacity;
        const fontSize = this.style.fontSize;

        function createLabel(lx: number, ly: number, lz: number, text: string) {
            const label = new CSS2DObject(createLabelElement(text, cssColor, opacity, fontSize));
            labels.push(label);
            label.name = text;
            labelElements.push(label.element);
            label.position.set(lx, ly, lz);
            return label;
        }

        const v = new Vector3();
        this.volume.extent.centerAsVector2(tmpVec2);
        const origin = tmpVec3;
        tmpVec3.set(tmpVec2.x, tmpVec2.y, 0);

        /**
         * @param side1 - The first shared side of this edge.
         * @param side2 - The second shared side of this edge.
         * @param start -  The position, in world space, of the start of the edge.
         * @param end - The position, in world space, of the end of the edge.
         * @param startValue - The numerical value of the starting point.
         * @param prefix - The prefix to apply to the label text.
         * @param suffix - The suffix to apply to the label text.
         * @param tick - The distance between each tick.
         */
        const createLabelsAlongEdge = (
            side1: Side,
            side2: Side,
            start: Vector3,
            end: Vector3,
            startValue: number,
            prefix: string,
            suffix: string,
            tick: number,
        ) => {
            const g = new Edge(side1, side2);
            g.name = `${side1.name}-${side2.name}`;
            const edgeCenter = v.lerpVectors(start, end, 0.5).clone();
            edgeCenter.sub(origin);
            g.position.copy(edgeCenter);

            const sideLength = start.distanceTo(end);
            const step = tick / sideLength;
            let labelDistance = 0;

            let t = (tick - mod(startValue + tick, tick)) / sideLength;

            // Distribute the labels along the edge, on each tick
            do {
                v.lerpVectors(start, end, t);
                labelDistance = v.distanceTo(start);

                const rawValue = startValue + labelDistance;
                const labelValue = numberFormat.format(Math.round(rawValue));
                const text = `${prefix}${labelValue}${suffix}`;

                const label = createLabel(
                    v.x - edgeCenter.x - origin.x,
                    v.y - edgeCenter.y - origin.y,
                    v.z - edgeCenter.z - origin.z,
                    text,
                );

                g.add(label);

                t += step;
            } while (t <= 1);

            this.onObjectCreated(g);
            labelRoot.add(g);
        };

        const e = this.volume.extent;

        const zmax = this.volume.ceiling;
        const zmin = this.volume.floor;

        const br = e.bottomRight().toVector2(tmpBr);
        const tr = e.topRight().toVector2(tmpTr);
        const bl = e.bottomLeft().toVector2(tmpBl);
        const tl = e.topLeft().toVector2(tmpTl);

        const tlFloor = new Vector3(tl.x, tl.y, zmin);
        const trFloor = new Vector3(tr.x, tr.y, zmin);
        const brFloor = new Vector3(br.x, br.y, zmin);
        const blFloor = new Vector3(bl.x, bl.y, zmin);

        const tlCeil = new Vector3(tl.x, tl.y, zmax);
        const trCeil = new Vector3(tr.x, tr.y, zmax);
        const brCeil = new Vector3(br.x, br.y, zmax);
        const blCeil = new Vector3(bl.x, bl.y, zmax);

        const floor = nonNull(this._floor);
        const ceil = nonNull(this._ceiling);
        const front = nonNull(this._front);
        const back = nonNull(this._back);
        const left = nonNull(this._left);
        const right = nonNull(this._right);

        const relative = this.origin === TickOrigin.Relative;

        const bry = relative ? 0 : br.y;
        const blx = relative ? 0 : bl.x;
        const tlx = relative ? 0 : tl.x;
        const yPrefix = relative ? '' : 'y: ';
        const xPrefix = relative ? '' : 'x: ';
        const zPrefix = '';
        const hSuffix = relative ? this._unitSuffix : '';
        const vSuffix = this._unitSuffix;

        // floor edges
        createLabelsAlongEdge(floor, right, brFloor, trFloor, bry, yPrefix, hSuffix, this._ticks.y);
        createLabelsAlongEdge(floor, left, blFloor, tlFloor, bry, yPrefix, hSuffix, this._ticks.y);
        createLabelsAlongEdge(floor, front, blFloor, brFloor, blx, xPrefix, hSuffix, this._ticks.x);
        createLabelsAlongEdge(floor, back, tlFloor, trFloor, tlx, xPrefix, hSuffix, this._ticks.x);

        // ceiling edges
        createLabelsAlongEdge(ceil, right, brCeil, trCeil, bry, yPrefix, hSuffix, this._ticks.y);
        createLabelsAlongEdge(ceil, left, blCeil, tlCeil, bry, yPrefix, hSuffix, this._ticks.y);
        createLabelsAlongEdge(ceil, front, blCeil, brCeil, blx, xPrefix, hSuffix, this._ticks.x);
        createLabelsAlongEdge(ceil, back, tlCeil, trCeil, tlx, xPrefix, hSuffix, this._ticks.x);

        // vertical (elevation) edges
        createLabelsAlongEdge(front, right, brFloor, brCeil, zmin, zPrefix, vSuffix, this._ticks.z);
        createLabelsAlongEdge(front, left, blFloor, blCeil, zmin, zPrefix, vSuffix, this._ticks.z);
        createLabelsAlongEdge(back, left, tlFloor, tlCeil, zmin, zPrefix, vSuffix, this._ticks.z);
        createLabelsAlongEdge(back, right, trFloor, trCeil, zmin, zPrefix, vSuffix, this._ticks.z);
    }

    private deleteSides() {
        const root = this._root;

        function remove(obj: LineSegments | null) {
            if (obj) {
                obj.geometry.dispose();
                root.remove(obj);
            }
        }

        remove(this._floor);
        remove(this._ceiling);
        remove(this._front);
        remove(this._back);
        remove(this._left);
        remove(this._right);
    }

    private buildSides() {
        this._dimensions = this.volume.extent.dimensions();
        this._height = Math.abs(this.volume.ceiling - this.volume.floor);
        this._midHeight = this.volume.floor + this._height / 2;

        const x = this._dimensions.x;
        const y = this._dimensions.y;
        const z = this._height;

        const extent = this.volume.extent;

        const relative = this.origin === TickOrigin.Relative;

        const xStart = relative ? 0 : this._ticks.x - mod(extent.west, this._ticks.x);
        const yStart = relative ? 0 : this._ticks.y - mod(extent.south, this._ticks.y);
        const zStart = this._ticks.z - mod(this.volume.floor, this._ticks.z);

        this.deleteSides();

        this._floor = this.buildSide('floor', x, y, xStart, this._ticks.x, yStart, this._ticks.y);
        this._ceiling = this.buildSide(
            'ceiling',
            x,
            y,
            xStart,
            this._ticks.x,
            yStart,
            this._ticks.y,
        );

        this._front = this.buildSide('front', x, z, xStart, this._ticks.x, zStart, this._ticks.z);
        this._back = this.buildSide('back', x, z, xStart, this._ticks.x, zStart, this._ticks.z);

        this._left = this.buildSide('left', y, z, yStart, this._ticks.y, zStart, this._ticks.z);
        this._right = this.buildSide('right', y, z, yStart, this._ticks.y, zStart, this._ticks.z);

        // Since the root group is located at the extent's center,
        // all subsequent transformations are local to this point.
        this._front.rotateX(MathUtils.degToRad(90));
        this._front.position.set(0, -this._dimensions.y / 2, this._midHeight);

        this._back.scale.setZ(-1);
        this._back.rotateX(MathUtils.degToRad(90));
        this._back.position.set(0, +this._dimensions.y / 2, this._midHeight);

        this._right.rotateX(MathUtils.degToRad(90));
        this._right.rotateY(MathUtils.degToRad(90));
        this._right.position.set(+this._dimensions.x / 2, 0, this._midHeight);

        this._left.scale.setZ(-1);
        this._left.rotateX(MathUtils.degToRad(90));
        this._left.rotateY(MathUtils.degToRad(90));
        this._left.position.set(-this._dimensions.x / 2, 0, this._midHeight);

        this._ceiling.position.set(0, 0, this.volume.ceiling);

        this._floor.position.set(0, 0, this.volume.floor);
        this._floor.scale.setZ(-1);

        this.onObjectCreated(this._back);
        this.onObjectCreated(this._left);
        this.onObjectCreated(this._right);
        this.onObjectCreated(this._front);
        this.onObjectCreated(this._floor);
        this.onObjectCreated(this._ceiling);
        this._root.add(this._back);
        this._root.add(this._left);
        this._root.add(this._right);
        this._root.add(this._front);
        this._root.add(this._floor);
        this._root.add(this._ceiling);
    }

    /**
     * @param name - The name of the object.
     * @param width - The width of the plane.
     * @param height - The height of the plane.
     * @param xOffset - The starting offset on the X axis.
     * @param xStep - The distance between lines on the X axis.
     * @param yOffset - The starting offset on the Y axis.
     * @param yStep - The distance between lines on the Y axis.
     * @returns the mesh object.
     */
    private buildSide(
        name: string,
        width: number,
        height: number,
        xOffset: number,
        xStep: number,
        yOffset: number,
        yStep: number,
    ): Side {
        const vertices: number[] = [];
        const centerX = width / 2;
        const centerY = height / 2;
        let x = xOffset;
        let y = yOffset;

        const top = height;
        const bottom = 0;
        const left = 0;
        const right = width;

        function pushSegment(x0: number, y0: number, x1: number, y1: number) {
            vertices.push(x0 - centerX, y0 - centerY, 0);
            vertices.push(x1 - centerX, y1 - centerY, 0);
        }

        // Vertical boundary lines
        pushSegment(left, bottom, left, top);
        pushSegment(right, bottom, right, top);

        // Horizontal boundary lines
        pushSegment(left, bottom, right, bottom);
        pushSegment(left, top, right, top);

        // Horizontal subdivisions
        while (x <= right) {
            pushSegment(x, bottom, x, top);
            x += xStep;
        }

        // Vertical subdivisions
        while (y <= top) {
            pushSegment(left, y, right, y);
            y += yStep;
        }

        const geometry = new BufferGeometry();

        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));

        const mesh = new Side(geometry, this._material);
        this.onObjectCreated(mesh);

        mesh.name = name;

        return mesh;
    }

    private makeArrowHelper(start: Vector3, end: Vector3) {
        if (!this._arrowRoot) {
            this._arrowRoot = new Group();
            this.onObjectCreated(this._arrowRoot);
            nonNull(this._root.parent).add(this._arrowRoot);
        }

        const arrow = Helpers.createArrow(start.clone(), end.clone());

        this.onObjectCreated(arrow);
        this._arrowRoot.add(arrow);
        arrow.updateMatrixWorld();

        const startPoint = Helpers.createAxes(250);
        startPoint.position.copy(start);
        this.onObjectCreated(startPoint);
        this._arrowRoot.add(startPoint);
        startPoint.updateMatrixWorld(true);

        const endPoint = Helpers.createAxes(250);
        endPoint.position.copy(end);
        this.onObjectCreated(endPoint);
        this._arrowRoot.add(endPoint);
        endPoint.updateMatrixWorld(true);
    }

    private updateLabelsVisibility(camera: Camera | null) {
        this._lastCamera = camera;

        this.deleteArrowHelpers();

        if (camera) {
            this._labelRoot.children.forEach(o =>
                this.updateLabelEdgeVisibility(camera, o as Edge),
            );
        }
    }

    private deleteArrowHelpers() {
        if (this._arrowRoot) {
            const children = [...this._arrowRoot.children];
            for (const child of children) {
                child.removeFromParent();
            }
        }
    }

    private updateLabelEdgeVisibility(camera: Camera, edge: Edge) {
        if (!edge.isEdge) {
            return;
        }

        const rootVisible = this.object3d.visible && this._labelRoot.visible;
        const fontSize = this.style.fontSize;

        // Labels on an edge should be displayed only if one of their side is visible,
        // to prevent labels getting in the way.
        //
        // However, since the API enables overriding ceiling, floor or side grids visibility,
        // we must distinguish between the logical visibility of the side (aka computed from the
        // camera angle), and the final visibility, that also includes the API overrides.
        //
        // Note: HTML labels are not automatically hidden when their parent is hidden, because
        // they are not really part of the scene graph, so they must be updated accordingly.
        //
        const logicalVisibility = edge.side1.logicalVisibility !== edge.side2.logicalVisibility;
        const graphicalVisibility = edge.side1.visible || edge.side2.visible;
        const visible = logicalVisibility && graphicalVisibility && rootVisible;
        edge.visible = visible;

        let paddingTop = 0;
        let paddingBottom = 0;
        let paddingRight = 0;
        let paddingLeft = 0;

        if (visible) {
            // Now that we know this label edge is visible, we can compute the
            // offset to apply (in the form of padding) to the labels so they don't overlap
            // their edge line (for greater readability). We want to push the labels "outside"
            // the grid. Since labels are 2D elements in the DOM, we cannot simply move
            // the 3D objects around.
            //
            // To compute the vertical and horizontal paddings for the label in an edge,
            // we must first compute the vector from the center of the grid volume toward the center
            // of the label edge.
            //
            // Then project this vector on the screen, so that we can reason in the same
            // coordinate system than the DOM.
            //
            // Then we can establish a quadrant to know the padding. For example, if the vector
            // is pointing to the lower left corner of the screen, we know that the label must
            // be pushed in this direction, so that we apply padding accordingly.

            tmp.edgeCenter.set(0, 0, 0);
            const edgeCenter = edge.localToWorld(tmp.edgeCenter);

            const boxCenter = this._boundingBoxCenter.clone();

            if (this.showHelpers) {
                this.makeArrowHelper(boxCenter, edgeCenter);
            }

            edgeCenter.project(camera);
            boxCenter.project(camera);

            const clipVector = edgeCenter.sub(boxCenter);
            // Our screenvector is in clip space, which is still a 3D space
            // We need a purely screen-space vector.
            const screenVector = tmp.v2.set(clipVector.x, clipVector.y).normalize();

            const vQuadrant = UP.dot(screenVector);
            const hQuadrant = RIGHT.dot(screenVector);

            const zero = 0;
            const limit = 0;
            const yMargin = fontSize * 2;
            const xMargin = fontSize * 0.7; // per character

            if (vQuadrant > limit) {
                paddingBottom = yMargin;
                paddingTop = zero;
            } else {
                paddingBottom = zero;
                paddingTop = yMargin;
            }

            if (hQuadrant > limit) {
                paddingLeft = xMargin;
                paddingRight = zero;
            } else {
                paddingLeft = zero;
                paddingRight = xMargin;
            }
        }

        const showHelpers = this.showHelpers;

        edge.traverse((c: Object3D) => {
            if (c instanceof CSS2DObject && c.element != null) {
                c.visible = visible;
                if (visible) {
                    const style = c.element.style;
                    style.paddingTop = `${paddingTop}pt`;
                    style.paddingBottom = `${paddingBottom}pt`;
                    const charCount = c.element.innerText.length;
                    style.paddingRight = `${paddingRight * charCount}pt`;
                    style.paddingLeft = `${paddingLeft * charCount}pt`;
                    if (showHelpers) {
                        style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
                    }
                }
            }
        });
    }

    private updateSidesVisibility(camera: Camera) {
        function updateSideVisibility(side: Side, sideVisibility: boolean, cameraNormal: Vector3) {
            tmp.planeNormal.setFromMatrixColumn(side.matrixWorld, 2);
            // The reason why we distinguish between two kinds of visibility is because
            // label visibility rules must take into account the fact that the API
            // allows to manually hide the ceiling, floor, or side grids.
            // Without that, we would have labels displayed when they should not.
            side.logicalVisibility = cameraNormal.dot(tmp.planeNormal) < -0.1;
            side.visible = sideVisibility && side.logicalVisibility;
        }

        // Only display sides that are facing toward the camera
        updateSideVisibility(nonNull(this._front), this._showSideGrids, this._cameraForward);
        updateSideVisibility(nonNull(this._back), this._showSideGrids, this._cameraForward);
        updateSideVisibility(nonNull(this._right), this._showSideGrids, this._cameraForward);
        updateSideVisibility(nonNull(this._left), this._showSideGrids, this._cameraForward);
        updateSideVisibility(nonNull(this._ceiling), this._showCeilingGrid, this._cameraForward);
        updateSideVisibility(nonNull(this._floor), this._showFloorGrid, this._cameraForward);

        this.updateLabelsVisibility(camera);
    }

    preUpdate(context: Context): object[] {
        if (!this.visible) {
            return [];
        }

        if (this._needsRebuild) {
            this.rebuildObjects();
            this._needsRebuild = false;
        }

        const camera = context.view.camera as Camera;

        this._cameraForward.setFromMatrixColumn(camera.matrixWorld, 2);

        this.updateSidesVisibility(camera);

        this.updateMinMaxDistance(context);

        return [];
    }

    private updateMinMaxDistance(context: Context) {
        const cameraPos = context.view.camera.position;

        const centerDistance = this._boundingSphere.center.distanceTo(cameraPos);
        const radius = this._boundingSphere.radius;

        this._distance.min = centerDistance - radius;
        this._distance.max = centerDistance + radius;
    }

    dispose() {
        if (this._disposed) {
            return;
        }

        this._disposed = true;
        this._material.dispose();
        this.deleteSides();
        this._labelElements.forEach(elt => elt.remove());
        this._labelElements.length = 0;

        this.deleteArrowHelpers();
    }
}

export default AxisGrid;
