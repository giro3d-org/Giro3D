import { AdditiveBlending, BackSide, EventDispatcher, MeshBasicMaterial, Vector3 } from 'three';
import type Disposable from '../core/Disposable';
import type Instance from '../core/Instance';
import type PickResult from '../core/picking/PickResult';
import type { ShapePickResult, VerticalLineLabelFormatter } from '../entities/Shape';
import Shape, {
    angleFormatter,
    isShape,
    slopeSegmentFormatter,
    type ShapeConstructorOptions,
} from '../entities/Shape';
import ConstantSizeSphere from '../renderer/ConstantSizeSphere';
import { AbortError } from '../utils/PromiseUtils';

const DEFAULT_MARKER_RADIUS = 5;
const OPACITY_OVER_VERTEX = 0.4;
const OPACITY_OVER_EDGE = 0.4;

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

export type PickCallback = (event: MouseEvent) => PickResult[];

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

export const inhibitHook = () => false;

export const limitRemovePointHook = (limit: number) => (options: { shape: Shape }) => {
    return options.shape.points.length > limit;
};

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

export const afterUpdatePointOfRing = (options: {
    shape: Shape;
    index: number;
    newPosition: Vector3;
}) => {
    const { index, shape, newPosition } = options;

    if (index === 0) {
        // Also remove last point
        shape.updatePoint(shape.points.length - 1, newPosition);
    } else if (index === shape.points.length - 1) {
        // Also remove first point
        shape.updatePoint(0, newPosition);
    }
};

const LEFT_BUTTON = 0;
const MIDDLE_BUTTON = 1;
const RIGHT_BUTTON = 2;

function middleButtonOrLeftButtonAndAlt(e: MouseEvent): boolean {
    if (e.button === MIDDLE_BUTTON) {
        return true;
    }

    // OpenLayers style
    if (e.button === LEFT_BUTTON && e.altKey) {
        return true;
    }

    return false;
}

function leftButton(e: MouseEvent): boolean {
    if (e.button === LEFT_BUTTON) {
        return true;
    }

    return false;
}

/**
 * A callback that can be used to test for a mouse button or key combination.
 * If the function returns `true`, the associated action is executed.
 */
export type MouseCallback = (e: MouseEvent) => boolean;

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
    }

    private defaultPick(e: MouseEvent): PickResult[] {
        return this._instance.pickObjectsAt(e);
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

        const pick: PickCallback = options?.pick ?? this.defaultPick.bind(this);
        const pickFirstShape = (e: MouseEvent) => {
            const picked = pick(e);

            for (const item of picked) {
                const entity = item.entity;
                if (isShape(entity) && (ids == null || ids.has(entity.id))) {
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
                        }
                    }

                    if (index != null) {
                        // Start dragging the picked vertex
                        if (isOperationAllowed(shape, 'movePoint') && onBeforePointMoved(e)) {
                            pickedVertexIndex = index;
                            isDragging = true;
                            pickedShape = shape;

                            this.displayVertexMarker(
                                shape,
                                picked.point,
                                shape.vertexRadius + shape.borderWidth,
                                OPACITY_OVER_VERTEX,
                            );

                            this.dispatchEvent({ type: 'start-drag' });
                        }

                        if (isOperationAllowed(shape, 'removePoint') && onBeforePointRemoved(e)) {
                            shape.removePoint(index);
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

                        if (this._selectedVertexMarker) {
                            this._selectedVertexMarker.visible = true;
                            this._selectedVertexMarker.position.copy(position);
                            this._selectedVertexMarker.updateMatrixWorld(true);
                        }
                    }
                }
            } else {
                const picked = pickFirstShape(e);

                if (picked) {
                    const isVertex = picked.pickedVertexIndex != null;
                    const isSegment = picked.pickedSegment != null;

                    const shape = picked.entity;

                    const radius = shape.showVertices
                        ? shape.vertexRadius + shape.borderWidth
                        : DEFAULT_MARKER_RADIUS;

                    const opacity = isVertex ? OPACITY_OVER_VERTEX : OPACITY_OVER_EDGE;

                    if (isVertex || (isSegment && isOperationAllowed(shape, 'insertPoint'))) {
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

        shape.userData.permissions = options.constraints;

        const pickableLabels = shape.pickableLabels;

        // We don't want labels to prevent us from drawing points.
        shape.pickableLabels = false;

        this._inhibitEdition = true;

        const domElement = this._domElement;

        const { minPoints, maxPoints } = options;

        const pick: PickCallback = options?.pick ?? this.defaultPick.bind(this);

        this._instance.add(shape);

        const firstPoint = new Vector3();
        const points = [firstPoint];

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

            const onMouseMove = (e: MouseEvent) => {
                const point = pick(e)[0]?.point;
                if (point != null) {
                    points[points.length - 1].copy(point);
                    updatePoints();
                    if (options?.onTemporaryPointMoved) {
                        options.onTemporaryPointMoved(shape, point);
                    }
                    shape.visible = true;
                } else {
                    shape.visible = clickCount > 0;
                }
            };

            const onMouseDown = (e: MouseEvent) => {
                e.stopPropagation();

                if (e.button === LEFT_BUTTON) {
                    const point = pick(e)[0]?.point;
                    if (point != null) {
                        clickCount++;

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
                } else if (e.button === RIGHT_BUTTON) {
                    if (minPoints != null && clickCount >= minPoints) {
                        shape.setPoints(points.slice(0, -1));
                        if (options?.closeRing === true) {
                            shape.makeClosed();
                        }

                        finalize(shape);
                    } else {
                        this._instance.remove(shape);

                        finalize(null);
                    }
                }
            };

            const signal = options.signal;

            removeListeners = () => {
                domElement.removeEventListener('mousedown', onMouseDown);
                domElement.removeEventListener('mousemove', onMouseMove);
                domElement.removeEventListener('mouseup', inhibit);
                domElement.removeEventListener('contextmenu', inhibit);

                signal?.removeEventListener('abort', onAbort);
            };

            this._domElement.addEventListener('mousemove', onMouseMove);
            this._domElement.addEventListener('mousedown', onMouseDown);
            this._domElement.addEventListener('mouseup', inhibit);
            this._domElement.addEventListener('contextmenu', inhibit);

            signal?.addEventListener('abort', onAbort);
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
    }
}
