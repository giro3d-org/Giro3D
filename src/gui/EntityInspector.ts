import type GUI from 'lil-gui';
import { Color, Object3D, Plane, PlaneHelper, Vector3, type ColorRepresentation } from 'three';
import type Instance from '../core/Instance';
import * as MemoryUsage from '../core/MemoryUsage';
import type Entity3D from '../entities/Entity3D';
import Helpers, { hasVolumeHelper } from '../helpers/Helpers';
import { isMaterial } from '../utils/predicates';
import Panel from './Panel';

const _tempArray: Object3D[] = [];

/**
 * Traverses the object hierarchy exactly once per object,
 * even if the hierarchy is modified during the traversal.
 *
 * In other words, objects can be safely added
 * to the hierarchy without causing infinite recursion.
 *
 * @param callback - The callback to call for each visited object.
 */
// @ts-expect-error monkey patching // FIXME
Object3D.prototype.traverseOnce = function traverseOnce(callback: (obj: Object3D) => void) {
    this.traverse((o: Object3D) => _tempArray.push(o));

    while (_tempArray.length > 0) {
        const obj = _tempArray.pop();
        if (obj) {
            callback(obj);
        }
    }
};

class ClippingPlanePanel extends Panel {
    entity: Entity3D;
    enableClippingPlane: boolean;
    normal: Vector3;
    distance: number;
    helperSize: number;
    negate: boolean;
    planeHelper?: PlaneHelper;

    constructor(entity: Entity3D, parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Clipping plane');

        this.entity = entity;

        this.enableClippingPlane = false;
        this.normal = new Vector3(0, 0, 1);
        this.distance = 0;
        this.helperSize = 5;
        this.negate = false;

        this.addController(this, 'enableClippingPlane')
            .name('Enable')
            .onChange(() => this.updateClippingPlane());

        this.addController(this.normal, 'x')
            .name('Plane normal X')
            .onChange(() => this.updateClippingPlane());
        this.addController(this.normal, 'y')
            .name('Plane normal Y')
            .onChange(() => this.updateClippingPlane());
        this.addController(this.normal, 'z')
            .name('Plane normal Z')
            .onChange(() => this.updateClippingPlane());
        this.addController(this, 'distance')
            .name('Distance')
            .onChange(() => this.updateClippingPlane());
        this.addController(this, 'helperSize')
            .name('Helper size')
            .onChange(() => this.updateClippingPlane());
        this.addController(this, 'negate')
            .name('Negate plane')
            .onChange(() => this.updateClippingPlane());
    }

    updateClippingPlane() {
        this.planeHelper?.removeFromParent();
        this.planeHelper?.dispose();

        if (this.enableClippingPlane) {
            const plane = new Plane(this.normal.clone(), this.distance);
            if (this.negate) {
                plane.negate();
            }
            this.entity.clippingPlanes = [plane];
            this.planeHelper = new PlaneHelper(plane, this.helperSize, 0xff0000);
            this.planeHelper.name = `Clipping plane for ${this.entity.id}`;
            this.instance.scene.add(this.planeHelper);
            this.planeHelper.updateMatrixWorld();
        } else {
            this.entity.clippingPlanes = null;
        }
        this.notify(this.entity);
    }

    dispose() {
        this.planeHelper?.removeFromParent();
        this.planeHelper?.dispose();
    }
}

interface EntityInspectorOptions {
    /** Display the bounding box checkbox. */
    boundingBoxes?: boolean;
    /** Display the bounding box color checkbox. */
    boundingBoxColor?: boolean;
    /** Display the opacity slider. */
    opacity?: boolean;
    /** Display the visibility checkbox. */
    visibility?: boolean;
}

function getTitle(entity: Entity3D): string {
    if (entity.name != null) {
        return `${entity.name} (${entity.type})`;
    }
    return entity.type;
}

/**
 * Base class for entity inspectors. To implement a custom inspector
 * for an entity type, you can inherit this class.
 */
class EntityInspector<T extends Entity3D = Entity3D> extends Panel {
    /** The inspected entity. */
    entity: T;
    /** The root object of the entity's hierarchy. */
    rootObject: Object3D;
    /** Toggle the visibility of the entity. */
    visible: boolean;
    /** Toggle the visibility of the bounding boxes. */
    boundingBoxes: boolean;
    boundingBoxColor: Color | string;
    state: string;
    clippingPlanePanel: ClippingPlanePanel;
    cpuMemoryUsage = 'unknown';
    gpuMemoryUsage = 'unknown';

    /**
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param entity - The entity to inspect.
     * @param options - The options.
     */
    constructor(
        parentGui: GUI,
        instance: Instance,
        entity: T,
        options: EntityInspectorOptions = {},
    ) {
        super(parentGui, instance, getTitle(entity));

        this.entity = entity;
        this.rootObject = entity.object3d;
        this.visible = entity.visible;
        this.boundingBoxes = false;
        this.boundingBoxColor = '#FFFF00';
        this.state = 'idle';

        this.addController(this.entity, 'id').name('Identifier');

        this.addController(this, 'cpuMemoryUsage').name('Memory usage (CPU)');
        this.addController(this, 'gpuMemoryUsage').name('Memory usage (GPU)');

        this.addController(this, 'state').name('Status');
        this.addController(this.entity, 'renderOrder')
            .name('Render order')
            .onChange(() => this.notify(this.entity));

        this.clippingPlanePanel = new ClippingPlanePanel(entity, this.gui, instance);

        if (options.visibility === true) {
            this.addController(this, 'visible')
                .name('Visible')
                .onChange(v => this.toggleVisibility(v));
        }
        this.addController(this.entity, 'frozen')
            .name('Freeze updates')
            .onChange(() => this.notify(this.entity));
        if (options.opacity === true) {
            this.addController(this.entity, 'opacity')
                .name('Opacity')
                .min(0)
                .max(1)
                .onChange(() => this.notify(this.entity));
        }
        if (options.boundingBoxes === true) {
            this.addController(this, 'boundingBoxes')
                .name('Show volumes')
                .onChange(v => this.toggleBoundingBoxes(v));
            if (options.boundingBoxColor === true) {
                this.addColorController(this, 'boundingBoxColor')
                    .name('Volume color')
                    .onChange(v => this.updateBoundingBoxColor(v));
            }
        }

        this.addController(this, 'deleteEntity').name('Delete entity');
    }

    deleteEntity() {
        this.instance.remove(this.entity);
    }

    dispose() {
        this.toggleBoundingBoxes(false);
        this.clippingPlanePanel.dispose();
    }

    updateValues() {
        const ctx: MemoryUsage.GetMemoryUsageContext = {
            renderer: this.instance.renderer,
            objects: new Map(),
        };
        this.entity.getMemoryUsage(ctx);
        const memUsage = MemoryUsage.aggregateMemoryUsage(ctx);
        this.cpuMemoryUsage = MemoryUsage.format(memUsage.cpuMemory);
        this.gpuMemoryUsage = MemoryUsage.format(memUsage.gpuMemory);
        this.state = this.entity.loading
            ? `loading (${Math.round(this.entity.progress * 100)}%)`
            : 'idle';
        if (this.boundingBoxes) {
            this.toggleBoundingBoxes(true);
        }
    }

    /**
     * Toggles the visibility of the entity in the scene.
     * You may override this method if the entity's visibility is not directly related
     * to its root object visibility.
     *
     * @param visible - The new visibility.
     */
    toggleVisibility(visible: boolean) {
        this.entity.visible = visible;
        this.notify(this.entity);
    }

    /**
     * Toggles the visibility of the bounding boxes.
     * You may override this method to use custom bounding boxes.
     *
     * @param visible - The new state.
     */
    toggleBoundingBoxes(visible: boolean) {
        const color = new Color(this.boundingBoxColor);
        // by default, adds axis-oriented bounding boxes to each object in the hierarchy.
        // custom implementations may override this to have a different behaviour.
        // @ts-expect-error traverseOnce() is monkey patched
        this.rootObject.traverseOnce(obj => this.addOrRemoveBoundingBox(obj, visible, color));
        this.notify(this.entity);
    }

    /**
     * @param obj - The object to decorate.
     * @param add - If true, bounding box is added, otherwise it is removed.
     * @param color - The bounding box color.
     */

    addOrRemoveBoundingBox(obj: Object3D, add: boolean, color: Color) {
        if (add) {
            if ('material' in obj && isMaterial(obj.material)) {
                if (obj.visible && obj.material != null && obj.material.visible) {
                    Helpers.addBoundingBox(obj, color);
                }
            }
        } else {
            Helpers.removeBoundingBox(obj);
        }
    }

    updateBoundingBoxColor(colorHex: ColorRepresentation) {
        const color = new Color(colorHex);
        this.rootObject.traverse(obj => {
            if (hasVolumeHelper(obj)) {
                obj.volumeHelper.material.color = color;
            }
        });

        this.notify(this.entity);
    }
}

export default EntityInspector;
