/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import type Instance from '../core/Instance';
import type Tiles3D from '../entities/Tiles3D';

import ColorMapInspector from './ColorMapInspector';
import EntityInspector from './EntityInspector';
import LayerInspector from './LayerInspector';

class Tiles3DInspector extends EntityInspector<Tiles3D> {
    /** The color map inspector */
    public colorMapInspector: ColorMapInspector;

    public layers: LayerInspector[] = [];
    /** The layer folder. */
    public layerFolder: GUI;

    /**
     * Creates an instance of Tiles3DInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param entity - The inspected 3D tileset.
     */
    public constructor(parentGui: GUI, instance: Instance, entity: Tiles3D) {
        super(parentGui, instance, entity, {
            visibility: true,
            boundingBoxColor: false,
            boundingBoxes: true,
            opacity: true,
        });

        this.addController(this.entity, 'castShadow');
        this.addController(this.entity, 'receiveShadow');
        this.addController(this.entity, 'errorTarget').min(0.1).max(1000);
        this.addController(this.entity, 'pointSize').min(0).max(20).step(1);
        this.addController(this.entity.pointCloudColorimetryOptions, 'brightness')
            .min(0)
            .max(1)
            .onChange(() => this.notify(entity));
        this.addController(this.entity.pointCloudColorimetryOptions, 'contrast')
            .min(0)
            .max(1)
            .onChange(() => this.notify(entity));
        this.addController(this.entity.pointCloudColorimetryOptions, 'saturation')
            .min(0)
            .max(1)
            .onChange(() => this.notify(entity));

        this.colorMapInspector = new ColorMapInspector(
            this.gui,
            instance,
            () => entity.colorMap,
            () => this.notify(entity),
        );

        this.layerFolder = this.gui.addFolder('Layers');

        const fillLayers = this.fillLayers.bind(this);
        this.fillLayers();

        this.entity.addEventListener('layer-added', fillLayers);
        this.entity.addEventListener('layer-removed', fillLayers);
    }

    public fillLayers(): void {
        while (this.layers.length > 0) {
            this.layers.pop()?.dispose();
        }
        // We reverse the order so that the layers are displayed in a natural order:
        // top layers in the inspector are also on top in the composition.
        this.entity
            .getLayers()
            .reverse()
            .forEach(lyr => {
                const gui = new LayerInspector(this.layerFolder, this.instance, this.entity, lyr);
                this.layers.push(gui);
            });
    }

    public override updateValues(): void {
        super.updateValues();
        this.layers.forEach(l => l.updateValues());
    }

    public override toggleBoundingBoxes(visible: boolean): void {
        this.entity.displayBoxBounds = visible;
        this.entity.displayRegionBounds = visible;
        this.entity.displaySphereBounds = visible;
    }
}

export default Tiles3DInspector;
