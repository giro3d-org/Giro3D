import {
    AdditiveBlending,
    BackSide,
    EventDispatcher,
    MeshBasicMaterial,
    Vector2,
    Vector3,
} from 'three';
import type Disposable from '../core/Disposable';
import type Instance from '../core/Instance';
import type PickResult from '../core/picking/PickResult';
import type { ShapePickResult, VerticalLineLabelFormatter } from '../entities/Shape';
import Shape, {
    angleFormatter,
    isShape,
    isShapePickResult,
    slopeSegmentFormatter,
    type ShapeConstructorOptions,
} from '../entities/Shape';
import ConstantSizeSphere from '../renderer/ConstantSizeSphere';
import { AbortError } from '../utils/PromiseUtils';
import { isVector2 } from '../utils/predicates';

const DEFAULT_MARKER_RADIUS = 5;
const MIN_MARKER_RADIUS = 4;
const MARKER_BORDER_WIDTH = 2;
const OPACITY_OVER_VERTEX = 0.4;
const OPACITY_OVER_EDGE = 0.4;
const SQUARE_DISTANCE_LIMIT_FOR_CLICK_DETECTION = 25; // 5 pixels squared

const tmpVec2 = new Vector2();

/**
 * Various constraints that can be applied to shapes created by this tool.
 */
interface Permissions {
    insertPoint: boolean;
    movePoint?: boolean;
    removePoint?: boolean;
}

type ShapeUserData = {
    permissions?: Permissions;
};

/**
 * A callback that can be used to test for a mouse button or key combination.
 * If the function returns `true`, the associated action is executed.
 */
export type MouseCallback = (e: MouseEvent) => boolean;

/**
 * A pick function that is used by the drawtool to interact with the scene.
 */
export type PickCallback<T extends PickResult = PickResult> = (
    eventOrCanvasCoordinate: MouseEvent | Vector2,
) => T[];

export type CommonCreationOptions = {
    /**
     * The optional signal to listen to cancel the creation of a shape.
     */
    signal?: AbortSignal;
    /**
     * The optional custom picking function.
     */
    pick?: PickCallback;
    /**
     * An optional callback to be called when a point has been moved.
     * @param shape - The shape being created.
     * @param position - The position of the point.
     */
    onTemporaryPointMoved?: (shape: Shape, position: Vector3) => void;
    /**
     * The input required to finish drawing the shape.
     * Does not apply to shapes that require a fixed number of points (i.e point, segment, etc).
     * @defaultValue right click
     */
    endCondition?: MouseCallback;
};

export type CreationOptions = Partial<ShapeConstructorOptions> & CommonCreationOptions;

/**
 * Verify that the given operation is possible on the shape.
 *
 * Note: if the shape was created outside of this tool,
 * the operations list is absent. In that case we allow every operation.
 */
function isOperationAllowed<K extends keyof Permissions>(
    shape: Shape<ShapeUserData>,
    constraint: K,
): boolean {
    if (!shape.userData.permissions) {
        return true;
    }

    return shape.userData.permissions[constraint] ?? true;
}

const isFirstVertexPicked = (shape: Shape, e: MouseEvent | Vector2) => {
    const canvasCoordinates = isVector2(e) ? e : tmpVec2.set(e.offsetX, e.offsetY);
    const pickSelf = shape.pick(canvasCoordinates);
    return pickSelf.length > 0 && pickSelf[0].pickedVertexIndex === 0;
};

/**
 * Options for the {@link DrawTool.createShape} method.
 */
export type CreateShapeOptions = Partial<ShapeConstructorOptions> &
    CommonCreationOptions & {
        /**
         * The minimum number of points to create before the shape can be completed.
         */
        minPoints?: number;
        /**
         * The maximum number of points to create before the shape is automatically completed.
         */
        maxPoints?: number;
        /**
         * If `true`, the shape's line will be closed just before being returned to the caller.
         */
        closeRing?: boolean;
        /**
         * An optional callback to be called when a point has been added to the shape.
         * @param shape - The shape being created.
         * @param index - The index of the point.
         * @param position - The position of the point.
         */
        onPointCreated?: (shape: Shape, index: number, position: Vector3) => void;
        /**
         * An optional list of permitted operations.
         */
        constraints?: Permissions;
    };

function inhibit(e: Event) {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
}

const verticalLengthFormatter: VerticalLineLabelFormatter = (params: {
    shape: Shape;
    defaultFormatter: VerticalLineLabelFormatter;
    vertexIndex: number;
    length: number;
}) => {
    if (params.vertexIndex === 0) {
        // We don't want to display the first label because it will have a length of zero.
        return null;
    }

    return params.defaultFormatter(params);
};

export interface DrawToolEventMap {
    'start-drag': Record<string, unknown>;
    'end-drag': Record<string, unknown>;
}

/**
 * A hook that prevents the operation from occuring.
 */
export const inhibitHook = () => false;

/**
 * A hook that prevents the removal of a point if the new number of points is below a limit (e.g
 * removing a point of a 2-point LineString).
 */
export const limitRemovePointHook = (limit: number) => (options: { shape: Shape }) => {
    return options.shape.points.length > limit;
};

/**
 * A hook that ensures the ring remains closed after the first or last point of the ring is removed.
 */
export const afterRemovePointOfRing = (options: { shape: Shape; index: number }) => {
    const { shape, index } = options;

    if (index === 0) {
        // Also remove last point
        shape.removePoint(shape.points.length - 1);
    } else if (index === shape.points.length - 1) {
        // Also remove first point
        shape.removePoint(0);
    }

    shape.makeClosed();
};

/**
 * A hook that ensures the ring remains closed after the first or last point of the ring is moved.
 */
export const afterUpdatePointOfRing = (options: {
    shape: Shape;
    index: number;
    newPosition: Vector3;
}) => {
    const { index, shape, newPosition } = options;

    if (index === 0) {
        // Also update last point
        shape.updatePoint(shape.points.length - 1, newPosition);
    } else if (index === shape.points.length - 1) {
        // Also update first point
        shape.updatePoint(0, newPosition);
    }
};

const LEFT_BUTTON = 0;
const MIDDLE_BUTTON = 1;
const RIGHT_BUTTON = 2;

function middleButtonOrLeftButtonAndAlt(e: Event) {
    if (e.type === 'mousedown') {
        const mouseEvent = e as MouseEvent;
        if (mouseEvent.button === MIDDLE_BUTTON) {
            return true;
        }

        // OpenLayers style
        if (mouseEvent.button === LEFT_BUTTON && mouseEvent.altKey) {
            return true;
        }
    }

    return false;
}

function leftButton(e: Event) {
    if (e.type === 'mousedown') {
        if ((e as MouseEvent).button === LEFT_BUTTON) {
            return true;
        }
    }

    return false;
}

let lastMousePosition: Vector2 | null = null;
let mouseCumulativeDistance: Vector2 | null = null;

const rightClick: MouseCallback = e => {
    if (e.type === 'mousedown' && e.button === RIGHT_BUTTON) {
        mouseCumulativeDistance = new Vector2(0, 0);
        lastMousePosition = new Vector2(e.screenX, e.screenY);
    } else if (e.type === 'mousemove') {
        if (lastMousePosition != null && mouseCumulativeDistance != null) {
            const deltaX = Math.abs(e.screenX - lastMousePosition.x);
            const deltaY = Math.abs(e.screenY - lastMousePosition.y);
            mouseCumulativeDistance.x += deltaX;
            mouseCumulativeDistance.y += deltaY;
        }

        lastMousePosition?.set(e.screenX, e.screenY);
    } else if (e.type === 'mouseup' && e.button === RIGHT_BUTTON) {
        const sqDistance = mouseCumulativeDistance?.lengthSq() ?? 0;

        // We don't want the prevent the user from using the right button for other purposes,
        // e.g rotating the camera, so let's ensure that any dragging motion of the mouse is
        // not intepreted as a click. Note that the "contextmenu" event is not 100% equivalent
        // to a right click, so we're not using it.
        if (sqDistance < SQUARE_DISTANCE_LIMIT_FOR_CLICK_DETECTION) {
            e.stopPropagation();
            mouseCumulativeDistance = null;
            lastMousePosition = null;
            return true;
        }
    }

    return false;
};

const doubleClick: MouseCallback = e => {
    if (e.type === 'dblclick') {
        if ((e as MouseEvent).button === LEFT_BUTTON) {
            e.stopPropagation();
            return true;
        }
    }

    return false;
};

export const conditions = {
    rightClick,
    doubleClick,
};

/**
 * A callback that is called after a shape has been modified.
 */
export type ShapeModifiedCallback<T> = (
    arg: {
        /**
         * The modified shape.
         */
        shape: Shape;
    } & T,
) => void;

/**
 * Called when a point has been inserted in a shape during edition.
 */
export type PointInsertedCallback = ShapeModifiedCallback<{
    /**
     * The index of the inserted point.
     */
    pointIndex: number;
    /**
     * The position of the inserted point.
     */
    position: Vector3;
}>;

/**
 * Called when a point has been removed in a shape during edition.
 */
export type PointRemovedCallback = ShapeModifiedCallback<{
    /**
     * The index of the inserted point.
     */
    pointIndex: number;
}>;

/**
 * Called when a point has been moved during edition.
 */
export type PointUpdatedCallback = ShapeModifiedCallback<{
    /**
     * The index of the updated point.
     */
    pointIndex: number;
    /**
     * The new position of the updated point.
     */
    newPosition: Vector3;
}>;

function computeMarkerRadius(shape: Shape, type: 'vertex' | 'segment') {
    let baseRadius: number;

    // If we display the vertex marker on a vertex, we need it to be slightly
    // bigger than the vertex. Otherwise, make it slightly bigger than the line.
    switch (type) {
        case 'vertex':
            baseRadius = shape.showVertices
                ? shape.vertexRadius + shape.borderWidth
                : DEFAULT_MARKER_RADIUS;
            break;
        case 'segment':
            baseRadius = shape.lineWidth / 2 + shape.borderWidth;
            break;
    }

    return Math.max(MIN_MARKER_RADIUS, baseRadius + MARKER_BORDER_WIDTH);
}

/**
 * A tool that allows interactive creation and edition of {@link Shape}s.
 *
 * ## Creation
 *
 * To create shapes, you can either use one of the preset methods ({@link createSegment},
 * {@link createPolygon}...), or start creating a free shape with {@link createShape}.
 *
 * This method allows fine control over the constraints to apply to the shape (how many vertices,
 * styling options, what component to display...).
 *
 * ## Edition
 *
 * The {@link enterEditMode} method allows the user to edit any shape that the mouse interacts with.
 * Depending on the constraints put on the shape during the creation (assuming of course that the
 * shape was created with this tool), some operations might not be permitted.
 *
 * To exit edition mode, call {@link exitEditMode}.
 *
 * ### Examples of constraints
 *
 * - If a shape was created with the {@link createSegment} method, it is not possible to insert
 * or remove points, because the constraint forces the shape to have exactly 2 points.
 *
 * - If a shape was created with the {@link createPolygon} method, then any time the user moves the first or
 * last vertex, the other one is automatically moved at the same position, to ensure the shape
 * remains closed.
 */
export default class DrawTool extends EventDispatcher<DrawToolEventMap> implements Disposable {
    private readonly _domElement: HTMLElement;
    private readonly _instance: Instance;
    private readonly _markerMaterial: MeshBasicMaterial;

    private _selectedVertexMarker?: ConstantSizeSphere;
    private _editionModeController?: AbortController;
    private _inhibitEdition = false;
    private _mouseEventHandler: (e: MouseEvent) => void;
    private _lastMouseCoordinate: Vector2 | null = null;

    constructor(options: {
        /**
         * The Giro3D instance.
         */
        instance: Instance;
        /**
         * The DOM element to listen to. If unspecified, this will use {@link Instance.domElement}.
         */
        domElement?: HTMLElement;
    }) {
        super();

        this._instance = options.instance;
        this._domElement = options.domElement ?? this._instance.domElement;

        this._markerMaterial = new MeshBasicMaterial({
            color: 'white',
            depthTest: false,
            side: BackSide,
            transparent: true,
            blending: AdditiveBlending,
        });

        // We listen to the global mousemove event to track the mouse location without
        // relying on a mousemove event on the DOM element (which might not be focused yet).
        // This will be used to preview the shape being created, even when the mouse has not been
        // moved after the creation started. This can happen if the creation is triggered by a
        // key press rather than a click for example.
        this._mouseEventHandler = this.onMouseEvent.bind(this);
        window.addEventListener('mousemove', this._mouseEventHandler);
    }

    private onMouseEvent(e: MouseEvent) {
        const rect = this._domElement.getBoundingClientRect();
        const x = e.clientX - rect.x;
        const y = e.clientY - rect.y;

        this._lastMouseCoordinate = new Vector2(x, y);
    }

    private defaultPickShapes(e: MouseEvent | Vector2, shapes?: Shape[]): ShapePickResult[] {
        return this._instance.pickObjectsAt(e, {
            where: shapes,
            sortByDistance: true,
        }) as ShapePickResult[];
    }

    private defaultPick(e: MouseEvent | Vector2): PickResult[] {
        return this._instance.pickObjectsAt(e, { sortByDistance: true });
    }

    private hideVertexMarker() {
        if (this._selectedVertexMarker) {
            this._selectedVertexMarker.visible = false;
        }

        this._instance.notifyChange();
    }

    private displayVertexMarker(shape: Shape, position: Vector3, radius: number, opacity: number) {
        if (!this._selectedVertexMarker) {
            this._selectedVertexMarker = new ConstantSizeSphere({
                radius: radius,
                material: this._markerMaterial,
            });

            this._selectedVertexMarker.enableRaycast = false;
            this._selectedVertexMarker.visible = false;

            this._instance.add(this._selectedVertexMarker);
        }

        this._selectedVertexMarker.renderOrder = shape.renderOrder + 1000;
        this._selectedVertexMarker.visible = true;
        this._selectedVertexMarker.radius = radius;
        this._markerMaterial.opacity = opacity;

        this._selectedVertexMarker.position.copy(position);
        this._selectedVertexMarker.updateMatrixWorld(true);

        this._instance.notifyChange();
    }

    /**
     * Enter edition mode. In this mode, existing {@link Shape}s can be modified (add/remove points, move points).
     * @param options - The options.
     */
    enterEditMode(options?: {
        /**
         * The custom picking function. If unspecified, the default one will be used.
         */
        pick?: PickCallback;
        /**
         * A picking function to pick **shapes only**. If unspecified, the default one will be used.
         */
        pickShapes?: PickCallback<ShapePickResult>;
        /**
         * The optional callback called just before a point is clicked, to determine if it can be deleted.
         * By default, points are removed with a **click on the middle mouse button** or **Alt + Left click**.
         */
        onBeforePointRemoved?: MouseCallback;
        /**
         * The optional callback called just before a point is clicked, to determine if it can be moved.
         * By default, points are moved with a **left click**.
         */
        onBeforePointMoved?: MouseCallback;
        /**
         * The optional callback to test for mouse or key combination when a segment is clicked.
         * By default, points are inserted with a **left click**.
         */
        onSegmentClicked?: MouseCallback;
        /**
         * An optional callback called when a point has been inserted.
         */
        onPointInserted?: PointInsertedCallback;
        /**
         * An optional callback called when a point has been removed.
         */
        onPointRemoved?: PointRemovedCallback;
        /**
         * An optional callback called when a point has been updated (i.e moved).
         */
        onPointUpdated?: PointUpdatedCallback;
        /**
         * The shapes to edit. If `undefined` or empty, all shapes become editable.
         */
        shapesToEdit?: Shape[];
    }) {
        this._editionModeController?.abort();
        this._editionModeController = new AbortController();

        // Optionally limit the shapes to edit to the specified entity ids.
        let ids: Set<string> | null = null;
        if (options?.shapesToEdit != null && options.shapesToEdit.length > 0) {
            ids = new Set(options.shapesToEdit.map(shape => shape.id));
        }

        const onBeforePointRemoved =
            options?.onBeforePointRemoved ?? middleButtonOrLeftButtonAndAlt;
        const onBeforePointMoved = options?.onBeforePointMoved ?? leftButton;
        const onBeforePointInserted = options?.onSegmentClicked ?? leftButton;
        const noOp = () => {};
        const onPointInserted = options?.onPointInserted ?? noOp;
        const onPointRemoved = options?.onPointRemoved ?? noOp;
        const onPointUpdated = options?.onPointUpdated ?? noOp;

        const pick: PickCallback = options?.pick ?? this.defaultPick.bind(this);
        const pickShapes: PickCallback<ShapePickResult> =
            options?.pickShapes ?? (e => this.defaultPickShapes(e, options?.shapesToEdit));

        const pickFirstShape = (e: MouseEvent) => {
            const picked = pickShapes(e);
            for (const item of picked) {
                const entity = item.entity;
                if (ids == null || ids.has(entity.id)) {
                    return item as ShapePickResult;
                }
            }

            return null;
        };
        const pickNonShapes = (e: MouseEvent) => {
            const picked = pick(e);

            for (const item of picked) {
                if (!isShape(item.entity)) {
                    return item;
                }
            }

            return null;
        };

        let pickedVertexIndex: number | null = null;
        let isDragging = false;
        let pickedShape: Shape | null = null;

        // Clicking will either start dragging the picked vertex,
        // or insert/remove a vertex depending on the mouse button.
        const onMouseDown = (e: MouseEvent) => {
            if (this._inhibitEdition) {
                return;
            }

            const picked = pickFirstShape(e);

            if (picked) {
                if (isShape(picked.entity)) {
                    // TODO configure buttons
                    let index = picked.pickedVertexIndex;
                    const segment = picked.pickedSegment;

                    const shape = picked.entity;

                    // We didn't pick a vertex, we are then inserting a vertex on a segment
                    if (
                        index == null &&
                        segment != null &&
                        isOperationAllowed(shape, 'insertPoint')
                    ) {
                        if (onBeforePointInserted(e)) {
                            index = segment + 1;
                            shape.insertPoint(index, picked.point);
                            onPointInserted({ shape, pointIndex: index, position: picked.point });

                            const radius = computeMarkerRadius(shape, 'vertex');

                            this.displayVertexMarker(
                                shape,
                                picked.point,
                                radius,
                                OPACITY_OVER_VERTEX,
                            );
                        }
                    }

                    if (index != null) {
                        // Start dragging the picked vertex
                        if (isOperationAllowed(shape, 'movePoint') && onBeforePointMoved(e)) {
                            pickedVertexIndex = index;
                            isDragging = true;
                            pickedShape = shape;

                            const radius = computeMarkerRadius(shape, 'vertex');

                            this.displayVertexMarker(
                                shape,
                                picked.point,
                                radius,
                                OPACITY_OVER_VERTEX,
                            );

                            this.dispatchEvent({ type: 'start-drag' });
                        }

                        if (isOperationAllowed(shape, 'removePoint') && onBeforePointRemoved(e)) {
                            shape.removePoint(index);
                            onPointRemoved({ shape, pointIndex: index });
                        }
                    }
                }
            }
        };

        const onMouseUp = () => {
            if (this._inhibitEdition) {
                return;
            }

            this._instance.notifyChange();
            this.dispatchEvent({ type: 'end-drag' });

            isDragging = false;
            pickedVertexIndex = null;
            pickedShape = null;
        };

        const onMouseMove = (e: MouseEvent) => {
            if (this._inhibitEdition) {
                return;
            }

            if (isDragging) {
                if (pickedShape && pickedVertexIndex != null) {
                    const position = pickNonShapes(e)?.point;
                    if (position) {
                        pickedShape.updatePoint(pickedVertexIndex, position);
                        onPointUpdated({
                            shape: pickedShape,
                            pointIndex: pickedVertexIndex,
                            newPosition: position,
                        });

                        if (this._selectedVertexMarker) {
                            this.displayVertexMarker(
                                pickedShape,
                                position,
                                computeMarkerRadius(pickedShape, 'vertex'),
                                OPACITY_OVER_VERTEX,
                            );
                        }
                    }
                }
            } else {
                const picked = pickFirstShape(e);

                if (picked) {
                    const isVertex = picked.pickedVertexIndex != null;
                    const isSegment = picked.pickedSegment != null;

                    const shape = picked.entity;

                    const opacity = isVertex ? OPACITY_OVER_VERTEX : OPACITY_OVER_EDGE;

                    if (isVertex || (isSegment && isOperationAllowed(shape, 'insertPoint'))) {
                        const radius = computeMarkerRadius(shape, isVertex ? 'vertex' : 'segment');

                        this.displayVertexMarker(shape, picked.point, radius, opacity);
                    } else {
                        this.hideVertexMarker();
                    }
                } else {
                    this.hideVertexMarker();
                }
            }
        };

        this._editionModeController.signal.addEventListener('abort', () => {
            this._domElement.removeEventListener('mousemove', onMouseMove);
            this._domElement.removeEventListener('mousedown', onMouseDown);
            this._domElement.removeEventListener('mouseup', onMouseUp);
            this._domElement.removeEventListener('contextmenu', inhibit);
        });

        this._domElement.addEventListener('mousemove', onMouseMove);
        this._domElement.addEventListener('mousedown', onMouseDown);
        this._domElement.addEventListener('mouseup', onMouseUp);
        this._domElement.addEventListener('contextmenu', inhibit);
    }

    /**
     * Exits edition mode.
     */
    exitEditMode() {
        this._editionModeController?.abort();
        this.hideVertexMarker();
    }

    private exitCreateMode() {
        this._inhibitEdition = false;
    }

    /**
     * Starts creating a {@link Shape} with the given parameters.
     * @param options - The shape creation options.
     * @returns A promise that eventually resolves with the created shape, or `null` if the creation
     * was cancelled.
     */
    createShape(options: CreateShapeOptions): Promise<Shape | null> {
        const shape = new Shape<ShapeUserData>({ ...options });

        shape.visible = false;

        shape.userData.permissions = options.constraints;

        const pickableLabels = shape.pickableLabels;

        // We don't want labels to prevent us from drawing points.
        shape.pickableLabels = false;

        this._inhibitEdition = true;

        const endCondition = options.endCondition ?? rightClick;

        const domElement = this._domElement;

        const { minPoints, maxPoints } = options;

        const pick: PickCallback = options?.pick ?? this.defaultPick.bind(this);

        this._instance.add(shape);

        const firstPoint = new Vector3();
        const points = [firstPoint];

        const lastPointerLocation = new Vector2();
        const currentPointerLocation = new Vector2();

        function updatePoints() {
            shape.setPoints([...points]);
        }

        const promise = new Promise<Shape | null>((resolve, reject) => {
            let clickCount = 0;

            let removeListeners: (() => void) | undefined = undefined;

            const finalize = (shape: Shape | null) => {
                if (shape) {
                    shape.pickableLabels = pickableLabels;
                }
                if (removeListeners) {
                    removeListeners();
                }
                this.exitCreateMode();
                resolve(shape);
            };

            const onAbort = () => {
                this._instance.remove(shape);
                if (removeListeners) {
                    removeListeners();
                }
                this.exitCreateMode();
                reject(new AbortError());
            };

            const updateTemporaryPoint = (e: MouseEvent | Vector2) => {
                // When moving the temporary point around, we ecounter two possible scenarios:
                // - we picked the first point of the shape
                // - we picked something else
                const picked = pick(e);

                if (picked.length > 0) {
                    let point: Vector3 | null = null;

                    const shapePickResults = picked.filter(p => isShapePickResult(p));

                    // First scenario: we clicked on the first point of the shape and the shape
                    // is marked as a closed ring. We have to complete the drawing by closing the shape.
                    if (
                        options.closeRing === true &&
                        shapePickResults.length > 0 &&
                        shapePickResults[0].pickedVertexIndex === 0
                    ) {
                        // Snap to first vertex to close the ring
                        points[points.length - 1].copy(shape.points[0]);
                        point = shape.points[0];
                    } else {
                        // Second scenario: we didn't pick the first point of the shape
                        // in ring mode. Let's see if we did actually pick the environment.
                        // If not, then we didn't really pick anything and shouldn't
                        // update the shape. Note that we don't want to pick the shape here,
                        // although we might want to consider picking the shape to provide a
                        // "snap" feature in the future. But for now, let's keep things simple.
                        const nonShapeResults = picked.filter(p => !isShapePickResult(p));
                        if (nonShapeResults.length > 0) {
                            point = nonShapeResults[0].point;
                            points[points.length - 1].copy(point);
                        }
                    }
                    updatePoints();
                    if (point != null && options?.onTemporaryPointMoved) {
                        options.onTemporaryPointMoved(shape, point);
                    }
                    shape.visible = true;
                } else {
                    shape.visible = clickCount > 0;
                }
            };

            const onMouseMove = (e: MouseEvent) => {
                updateTemporaryPoint(e);
            };

            const finishDrawing = () => {
                if (minPoints != null && clickCount >= minPoints) {
                    shape.setPoints(points);

                    if (options?.closeRing === true) {
                        shape.makeClosed();
                    }

                    finalize(shape);
                } else {
                    this._instance.remove(shape);

                    finalize(null);
                }
            };

            const onMouseDown = (e: MouseEvent) => {
                lastPointerLocation.set(e.screenX, e.screenY);
            };

            const onClick = (e: MouseEvent) => {
                // Not a simple click
                if (e.detail !== 1) {
                    return;
                }

                e.stopPropagation();
                currentPointerLocation.set(e.screenX, e.screenY);

                // Check that the mouse is not dragging (might be a camera movement)
                const distance = currentPointerLocation.distanceToSquared(lastPointerLocation);

                if (distance <= SQUARE_DISTANCE_LIMIT_FOR_CLICK_DETECTION) {
                    lastPointerLocation.copy(currentPointerLocation);

                    if (e.button === LEFT_BUTTON) {
                        const point = pick(e)[0]?.point;

                        if (point != null) {
                            clickCount++;

                            if (
                                clickCount > 2 &&
                                options.closeRing === true &&
                                isFirstVertexPicked(shape, e)
                            ) {
                                // Special case: in the case of rings, if the user clicks on the first
                                // point, we close the ring and finish the drawing.
                                points.pop();
                                finishDrawing();
                            } else {
                                // Let's create a new point
                                if (maxPoints != null && points.length < maxPoints) {
                                    if (options?.onPointCreated) {
                                        const pointIndex = clickCount - 1;
                                        options.onPointCreated(shape, pointIndex, point);
                                    }
                                    points.push(point);
                                }

                                updatePoints();

                                if (clickCount === maxPoints) {
                                    finalize(shape);
                                }
                            }
                        }
                    }
                }
            };

            const signal = options.signal;

            const handleEvent = (event: MouseEvent) => {
                if (endCondition(event)) {
                    finishDrawing();
                } else {
                    switch (event.type) {
                        case 'click':
                            onClick(event);
                            break;
                        case 'mousedown':
                            onMouseDown(event);
                            break;
                        case 'mousemove':
                            onMouseMove(event);
                            break;
                    }
                }
            };

            removeListeners = () => {
                domElement.removeEventListener('mousedown', handleEvent);
                domElement.removeEventListener('mousemove', handleEvent);
                domElement.removeEventListener('mouseup', handleEvent);
                domElement.removeEventListener('dblclick', handleEvent);
                domElement.removeEventListener('click', handleEvent);

                signal?.removeEventListener('abort', onAbort);
            };

            domElement.addEventListener('mousedown', handleEvent, { signal });
            domElement.addEventListener('mousemove', handleEvent, { signal });
            domElement.addEventListener('mouseup', handleEvent, { signal });
            domElement.addEventListener('dblclick', handleEvent, { signal });
            domElement.addEventListener('click', handleEvent, { signal });

            signal?.addEventListener('abort', onAbort, { signal });

            // Show the temporary point at the last mouse coordinate.
            // Useful if the user started the creation by something else than a
            // mouse action (e.g a keyboars shortcut), which would otherwise not
            // display the point until the first mouse move event.
            if (this._lastMouseCoordinate != null) {
                updateTemporaryPoint(this._lastMouseCoordinate);
            }
        });

        return promise;
    }

    /**
     * Create a segment (straight line between two points).
     * @param options - The options.
     * @returns A promise that eventually returns the {@link Shape} or `null` if creation was cancelled.
     */
    createSegment(options?: CreationOptions): Promise<Shape | null> {
        return this.createShape({
            ...options,
            minPoints: 2,
            maxPoints: 2,
            constraints: {
                insertPoint: false,
                movePoint: true,
                removePoint: false,
            },
            beforeRemovePoint: inhibitHook,
            beforeInsertPoint: inhibitHook,
        });
    }

    /**
     * Creates a LineString {@link Shape}.
     * @param options - The options.
     * @returns A promise that eventually returns the {@link Shape} or `null` if creation was cancelled.
     */
    createLineString(options?: CreationOptions): Promise<Shape | null> {
        return this.createShape({
            ...options,
            beforeRemovePoint: limitRemovePointHook(2),
            minPoints: 2,
            maxPoints: +Infinity,
        });
    }

    /**
     * Creates a vertical measure {@link Shape} that displays the vertical distance between
     * the start and end point, as well as the angle between the segment formed by those points
     * and the horizontal plane. The shape looks like a right triangle.
     * @param options - The options.
     * @returns A promise that eventually returns the {@link Shape} or `null` if creation was cancelled.
     */
    createVerticalMeasure(options?: CreationOptions): Promise<Shape | null> {
        let canUpdateFloor = true;

        const updateDashSize = (shape: Shape) => {
            if (shape.points.length > 1) {
                const p0 = shape.points[0];
                const p1 = shape.points[1];
                const height = Math.max(p0.z, p1.z) - Math.min(p0.z, p1.z);
                shape.dashSize = height / 20;
            }
        };

        const onPointCreated = (shape: Shape, index: number, position: Vector3) => {
            if (index === 0) {
                canUpdateFloor = false;
                const height = position.z;
                shape.floorElevation = height;

                shape.showFloorLine = true;
                shape.showVerticalLines = true;
                shape.showFloorVertices = true;
                shape.showVerticalLineLabels = true;
            }

            updateDashSize(shape);
        };

        // Whenever the first point is updated, we need to set the floor height to
        // this point's height, so that we always display a nice right triangle.
        const updateFloor = (shape: Shape, position: Vector3) => {
            const height = position.z;
            shape.floorElevation = height;
        };

        const onTemporaryPointMoved = (shape: Shape, position: Vector3) => {
            if (canUpdateFloor) {
                updateFloor(shape, position);
            }

            updateDashSize(shape);
        };

        const afterUpdatePoint = (options: {
            shape: Shape;
            index: number;
            newPosition: Vector3;
        }) => {
            const { index, shape, newPosition } = options;

            if (index === 0) {
                updateFloor(shape, newPosition);
            }

            updateDashSize(shape);
        };

        return this.createShape({
            showFloorLine: false,
            showVerticalLines: false,
            showFloorVertices: false,
            showVerticalLineLabels: false,
            showSegmentLabels: true,
            constraints: {
                insertPoint: false,
                removePoint: false,
                movePoint: true,
            },
            verticalLineLabelFormatter: verticalLengthFormatter,
            segmentLabelFormatter: slopeSegmentFormatter,
            beforeRemovePoint: inhibitHook,
            beforeInsertPoint: inhibitHook,
            onPointCreated,
            onTemporaryPointMoved,
            afterUpdatePoint,
            ...options,
            minPoints: 2,
            maxPoints: 2,
        });
    }

    /**
     * Creates a single point {@link Shape}.
     * @param options - The options.
     * @returns A promise that eventually returns the {@link Shape} or `null` if creation was cancelled.
     */
    createPoint(options?: CreationOptions): Promise<Shape | null> {
        return this.createShape({
            ...options,
            minPoints: 1,
            maxPoints: 1,
            beforeRemovePoint: inhibitHook,
        });
    }

    /**
     * Creates multiple point {@link Shape}s.
     * @param options - The options.
     * @returns A promise that eventually returns the {@link Shape} or `null` if creation was cancelled.
     */
    createMultiPoint(options?: CreationOptions): Promise<Shape | null> {
        return this.createShape({
            showLine: false,
            ...options,
            beforeRemovePoint: limitRemovePointHook(1),
            minPoints: 1,
            maxPoints: +Infinity,
        });
    }

    /**
     * Creates a polygon {@link Shape}.
     * @param options - The options.
     * @returns A promise that eventually returns the {@link Shape} or `null` if creation was cancelled.
     */
    createPolygon(options?: CreationOptions): Promise<Shape | null> {
        return this.createShape({
            showSurface: true,
            closeRing: true,
            ...options,
            minPoints: 3,
            maxPoints: +Infinity,
            beforeRemovePoint: limitRemovePointHook(4), // We take into account the doubled first/last point
            afterRemovePoint: afterRemovePointOfRing,
            afterUpdatePoint: afterUpdatePointOfRing,
        });
    }

    /**
     * Create a closed ring {@link Shape}.
     * @param options - The options.
     * @returns A promise that eventually returns the {@link Shape} or `null` if creation was cancelled.
     */
    createRing(options?: CreationOptions): Promise<Shape | null> {
        return this.createShape({
            closeRing: true,
            ...options,
            minPoints: 3,
            maxPoints: +Infinity,
            beforeRemovePoint: limitRemovePointHook(3),
            afterRemovePoint: afterRemovePointOfRing,
            afterUpdatePoint: afterUpdatePointOfRing,
        });
    }

    /**
     * Create a sector {@link Shape}.
     * @param options - The options.
     * @returns A promise that eventually returns the {@link Shape} or `null` if creation was cancelled.
     */
    createSector(options?: CreationOptions): Promise<Shape | null> {
        return this.createShape({
            vertexLabelFormatter: angleFormatter,
            showVertexLabels: true,
            showSurface: true,
            ...options,
            constraints: {
                insertPoint: false,
                removePoint: false,
                movePoint: true,
            },
            minPoints: 3,
            maxPoints: 3,
        });
    }

    /**
     * Disposes unmanaged resources created by this instance.
     */
    dispose() {
        this._markerMaterial.dispose();
        if (this._selectedVertexMarker) {
            this._instance.remove(this._selectedVertexMarker);
            this._selectedVertexMarker = undefined;
        }

        window.removeEventListener('mousemove', this._mouseEventHandler);
    }
}
