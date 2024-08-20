import { Clock, MathUtils as ThreeMath, Sphere } from 'three';
import Entity from '../entities/Entity';
import type C3DEngine from '../renderer/c3DEngine';
import Context from './Context';
import type Instance from './Instance';

/** Rendering state */
export enum RenderingState {
    /* Paused */
    RENDERING_PAUSED = 0,
    /* Scheduled */
    RENDERING_SCHEDULED = 1,
}

const tmpSphere = new Sphere();

function updateElements(context: Context, entity: Entity, elements?: unknown[]) {
    if (!elements) {
        return;
    }
    for (const element of elements) {
        // update element
        const newElementsToUpdate = entity.update(context, element);
        updateElements(context, entity, newElementsToUpdate);
    }
}

class MainLoop {
    private _renderingState: RenderingState;
    public get renderingState(): RenderingState {
        return this._renderingState;
    }
    private _needsRedraw: boolean;
    private _automaticCameraPlaneComputation = true;
    private readonly _gfxEngine: C3DEngine;
    /**
     * @deprecated Use {@link Instance.engine}
     */
    public get gfxEngine(): C3DEngine {
        return this._gfxEngine;
    }
    private _updateLoopRestarted: boolean;
    private readonly _changeSources: Set<unknown>;
    private readonly _clock = new Clock();
    private _frame = 0;

    /**
     * The number of frames processed.
     */
    get frameCount() {
        return this._frame;
    }

    /**
     * Toggles automatic camera clipping plane computation.
     * @defaultValue true
     */
    get automaticCameraPlaneComputation() {
        return this._automaticCameraPlaneComputation;
    }

    set automaticCameraPlaneComputation(v: boolean) {
        this._automaticCameraPlaneComputation = v;
    }

    constructor(engine: C3DEngine) {
        this._renderingState = RenderingState.RENDERING_PAUSED;
        this._needsRedraw = false;
        this._gfxEngine = engine; // TODO: remove me
        this._updateLoopRestarted = true;
        this._changeSources = new Set<unknown>();
    }

    scheduleUpdate(
        instance: Instance,
        changeSource: unknown | unknown[] = undefined,
        options?: {
            needsRedraw?: boolean;
            immediate?: boolean;
        },
    ) {
        if (changeSource) {
            if (Array.isArray(changeSource)) {
                changeSource.forEach(s => this._changeSources.add(s));
            } else {
                this._changeSources.add(changeSource);
            }
        }
        const needsRedraw = options?.needsRedraw ?? true;
        const immediate = options?.immediate ?? false;
        this._needsRedraw = this._needsRedraw || needsRedraw;

        if (this._renderingState !== RenderingState.RENDERING_SCHEDULED) {
            this._renderingState = RenderingState.RENDERING_SCHEDULED;

            if (immediate) {
                this.step(instance);
            } else {
                requestAnimationFrame(() => {
                    this.step(instance);
                });
            }
        }
    }

    private update(instance: Instance, updateSources: Set<unknown>, dt: number) {
        const context = new Context(instance.view, instance);

        if (this.automaticCameraPlaneComputation) {
            // Reset near/far to default value to allow update function to test
            // visibility using camera's frustum; without depending on the near/far
            // values which are only used for rendering.
            instance.view.resetPlanes();
        }

        const frame = this._frame;

        // We can't just use camera.updateProjectionMatrix() because part of
        // the update process use camera._viewMatrix, and this matrix depends
        // on near/far values.
        instance.view.update();

        for (const entity of instance.getObjects(o => o instanceof Entity) as Entity[]) {
            context.resetForEntity(entity);
            if (entity.shouldCheckForUpdate()) {
                instance.dispatchEvent({
                    type: 'before-entity-update',
                    frame,
                    entity,
                    dt,
                    updateLoopRestarted: this._updateLoopRestarted,
                });

                // Filter updateSources that are relevant for the entity
                const srcs = entity.filterChangeSources(updateSources);
                if (srcs.size > 0) {
                    // `preUpdate` returns an array of elements to update
                    const elementsToUpdate = entity.preUpdate(context, srcs);
                    // `update` is called in `updateElements`.
                    updateElements(context, entity, elementsToUpdate);
                    // `postUpdate` is called when this geom layer update process is finished
                    entity.postUpdate(context, updateSources);
                }

                if ('distance' in entity) {
                    const entityDistance = entity.distance as { min: number; max: number };
                    context.distance.min = Math.min(context.distance.min, entityDistance.min);
                    if (entityDistance.max === Infinity) {
                        context.distance.max = instance.view.maxFarPlane;
                    } else {
                        context.distance.max = Math.max(context.distance.max, entityDistance.max);
                    }
                }

                instance.dispatchEvent({
                    type: 'after-entity-update',
                    frame,
                    entity,
                    dt,
                    updateLoopRestarted: this._updateLoopRestarted,
                });
            }
        }

        // TODO document the fact Object3D must be added through threeObjects
        // if they want to influence the near / far planes
        instance.threeObjects.traverse(o => {
            if (!o.visible) {
                return;
            }
            const boundingSphere = ((o as any)?.geometry as any)?.boundingSphere as Sphere;
            if (boundingSphere && !boundingSphere.isEmpty()) {
                tmpSphere.copy(boundingSphere);
                tmpSphere.applyMatrix4(o.matrixWorld);
                const d = tmpSphere.distanceToPoint(context.view.camera.position);
                context.distance.min = ThreeMath.clamp(d, 0, context.distance.min);

                context.distance.max = Math.max(context.distance.max, d + 2 * tmpSphere.radius);
            }
        });

        if (this.automaticCameraPlaneComputation) {
            instance.view.near = context.distance.min;
            instance.view.far = context.distance.max;
        }

        instance.view.update();
    }

    private step(instance: Instance) {
        const dt = this._clock.getDelta() * 1000;

        const frame = this._frame++;

        instance.dispatchEvent({
            type: 'update-start',
            frame,
            dt,
            updateLoopRestarted: this._updateLoopRestarted,
        });

        const willRedraw = this._needsRedraw;

        // Reset internal state before calling _update (so future calls to Instance.notifyChange()
        // can properly change it)
        this._needsRedraw = false;
        this._renderingState = RenderingState.RENDERING_PAUSED;
        const updateSources = new Set(this._changeSources);
        this._changeSources.clear();

        instance.dispatchEvent({
            type: 'before-camera-update',
            frame,
            camera: instance.view,
            dt,
            updateLoopRestarted: this._updateLoopRestarted,
        });
        instance.execCameraUpdate();
        instance.dispatchEvent({
            type: 'after-camera-update',
            frame,
            camera: instance.view,
            dt,
            updateLoopRestarted: this._updateLoopRestarted,
        });

        // Disable camera's matrix auto update to make sure the camera's
        // world matrix is never updated mid-update.
        // Otherwise inconsistencies can appear because object visibility
        // testing and object drawing could be performed using different
        // camera matrixWorld.
        // Note: this is required at least because WEBGLRenderer calls
        // camera.updateMatrixWorld()
        const oldAutoUpdate = instance.view.camera.matrixAutoUpdate;
        instance.view.camera.matrixAutoUpdate = false;

        // update data-structure
        this.update(instance, updateSources, dt);

        // Redraw *only* if needed.
        // (redraws only happen when this.needsRedraw is true, which in turn only happens when
        // instance.notifyChange() is called with redraw=true)
        // As such there's no continuous update-loop, instead we use a ad-hoc update/render
        // mechanism.
        if (willRedraw) {
            instance.dispatchEvent({
                type: 'before-render',
                frame,
                dt,
                updateLoopRestarted: this._updateLoopRestarted,
            });
            instance.render();
            instance.dispatchEvent({
                type: 'after-render',
                frame,
                dt,
                updateLoopRestarted: this._updateLoopRestarted,
            });
        }

        // next time, we'll consider that we've just started the loop if we are still PAUSED now
        this._updateLoopRestarted = this._renderingState === RenderingState.RENDERING_PAUSED;

        instance.view.camera.matrixAutoUpdate = oldAutoUpdate;

        instance.dispatchEvent({
            type: 'update-end',
            frame,
            dt,
            updateLoopRestarted: this._updateLoopRestarted,
        });
    }
}

export default MainLoop;
