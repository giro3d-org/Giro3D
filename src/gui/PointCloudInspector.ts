/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';
import type PointCloud from '../entities/PointCloud';

import ColorMapInspector from './ColorMapInspector';
import EntityInspector from './EntityInspector';
import PointCloudSourceInspector from './PointCloudSourceInspector';

export default class PointCloudInspector extends EntityInspector<PointCloud> {
    public elevationColorMapInspector: ColorMapInspector | null = null;
    public attributesColorMapInspectors: ReadonlyMap<string, ColorMapInspector> | null = null;
    public sourceInspector: PointCloudSourceInspector | null = null;

    public get pointBudget(): number {
        return this.entity.pointBudget ?? -1;
    }

    public set pointBudget(v: number) {
        if (v === -1) {
            this.entity.pointBudget = null;
        } else {
            this.entity.pointBudget = v;
        }
    }

    public constructor(parent: GUI, instance: Instance, entity: PointCloud) {
        super(parent, instance, entity, {
            visibility: true,
            opacity: true,
            boundingBoxes: false,
            boundingBoxColor: false,
        });

        if (entity.ready) {
            this.populate(entity);
        } else {
            entity.addEventListener('initialized', () => this.populate(entity));
        }
    }

    private populate(entity: PointCloud): void {
        this.addController(entity, 'showPoints');
        this.addController(entity, 'showVolume');
        this.addController(entity, 'cleanupDelay');
        this.addController(entity, 'depthTest');
        this.addController(entity, 'brightness').min(0).max(1);
        this.addController(entity, 'contrast').min(0).max(1);
        this.addController(entity, 'saturation').min(0).max(1);
        this.addController(entity, 'showNodeVolumes');
        this.addController(entity, 'decimation').min(1).max(100).step(1);
        this.addController(this, 'pointBudget');
        this.addController(entity, 'showNodeDataVolumes');
        if (entity.pointCount != null) {
            this.addController(entity, 'pointCount');
        }
        this.addController(entity, 'displayedPointCount');
        this.addController(entity, 'subdivisionThreshold').min(0.1).max(5).step(0.1);
        this.addController(entity, 'pointSize').min(0).max(50).step(1);
        this.addController(entity, 'clear');

        this.elevationColorMapInspector = new ColorMapInspector(
            this.gui,
            this.instance,
            () => entity.elevationColorMap,
            () => this.notify(entity),
        );

        const attributesColorMapInspectors = new Map<string, ColorMapInspector>();
        const supportedAttributes = entity.getSupportedAttributes();
        for (const attribute of supportedAttributes) {
            attributesColorMapInspectors.set(
                attribute.name,
                new ColorMapInspector(
                    this.gui,
                    this.instance,
                    () => entity.getAttributeColorMap(attribute.name),
                    () => this.notify(entity),
                ),
            );
        }

        this.sourceInspector = new PointCloudSourceInspector(
            this.gui,
            this.instance,
            entity.source,
        );
    }

    public override updateControllers(): void {
        if (!this.entity.ready) {
            return;
        }
        super.updateControllers();
        this.sourceInspector?.updateControllers();
        this.elevationColorMapInspector?.updateControllers();
    }
}
