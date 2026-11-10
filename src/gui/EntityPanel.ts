/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';
import type Entity from '../entities/Entity';
import type Entity3D from '../entities/Entity3D';
import type EntityInspector from './EntityInspector';

import { isEntity3D } from '../entities/Entity3D';
import AtmosphereInspector from './AtmosphereInspector';
import AxisGridInspector from './AxisGridInspector';
import FeatureCollectionInspector from './FeatureCollectionInspector';
import GlowInspector from './GlowInspector';
import ImageCollectionInspector from './ImageCollectionInspector';
import MapInspector from './MapInspector';
import Panel from './Panel';
import PointCloudInspector from './PointCloudInspector';
import ShapeInspector from './ShapeInspector';
import SkyDomeInspector from './SkyDomeInspector';
import Tiles3DInspector from './Tiles3DInspector';

const customInspectors: Record<string, typeof EntityInspector<Entity3D>> = {
    Map: MapInspector,
    Globe: MapInspector,
    Tiles3D: Tiles3DInspector,
    SphericalPanorama: MapInspector,
    AxisGrid: AxisGridInspector,
    Shape: ShapeInspector,
    FeatureCollection: FeatureCollectionInspector,
    PointCloud: PointCloudInspector,
    Atmosphere: AtmosphereInspector,
    SkyDome: SkyDomeInspector,
    Glow: GlowInspector,
    OrientedImageCollection: ImageCollectionInspector,
    OrientedPanoramaCollection: ImageCollectionInspector,
};

/**
 * Provides an inspector for the entities in an instance.
 * To add a custom inspector for a specific entity type,
 * use {@link registerInspector}.
 */
class EntityPanel extends Panel {
    public inspectors: Map<Entity3D['id'], { folder: GUI; inspector: EntityInspector }> = new Map();

    private _onInstanceUpdated: () => void;
    private _onEntityAdded: (e: { entity: Entity }) => void;
    private _onEntityRemoved: (e: { entity: Entity }) => void;

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     */
    public constructor(gui: GUI, instance: Instance) {
        super(gui, instance, 'Entities');

        this._onInstanceUpdated = this.update.bind(this);
        this._onEntityAdded = this.onEntityAdded.bind(this);
        this._onEntityRemoved = this.onEntityRemoved.bind(this);

        this.instance.addEventListener('update-start', this._onInstanceUpdated);

        this.instance.addEventListener('entity-added', this._onEntityAdded);
        this.instance.addEventListener('entity-removed', this._onEntityRemoved);

        this.instance.getEntities().forEach(entity => this.onEntityAdded({ entity }));
    }

    public override dispose(): void {
        this.instance.removeEventListener('update-start', this._onInstanceUpdated);
        this.instance.removeEventListener('entity-added', this._onEntityAdded);
        this.instance.removeEventListener('entity-removed', this._onEntityRemoved);

        this.inspectors.forEach(({ folder, inspector }) => {
            folder.destroy();
            inspector.dispose();
        });
    }

    /**
     * Registers an inspector for an entity type.
     *
     * @param type - The entity type. This should match the property `type` on the entity.
     * @param inspector - The inspector.
     * @example
     * EntityPanel.registerInspector('Map', MyCustomMapInspector);
     */
    public static registerInspector<T extends Entity3D = Entity3D>(
        type: string,
        inspector: typeof EntityInspector<T>,
    ): void {
        customInspectors[type] = inspector;
    }

    public override update(): void {
        this.inspectors.forEach(entry => entry.inspector.update());
    }

    private onEntityAdded({ entity }: { entity: Entity }): void {
        if (this.inspectors.has(entity.id)) {
            return;
        }

        if (isEntity3D(entity)) {
            const type = entity.type;

            if (customInspectors[type] != null) {
                const inspector = new customInspectors[type](this.gui, this.instance, entity);

                this.inspectors.set(entity.id, { inspector, folder: inspector.gui });
            } else {
                console.warn(`no inspector found for entity type ${type}`);
            }
        }
    }

    private onEntityRemoved({ entity }: { entity: Entity }): void {
        const entry = this.inspectors.get(entity.id);
        if (entry) {
            entry.folder.destroy();
            entry.inspector.dispose();
        }
    }
}

export default EntityPanel;
