/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';

import { Color } from 'three';

import type ColorMap from '../core/ColorMap';
import type { ColorMapMode } from '../core/ColorMap';
import type CoordinateSystem from '../core/geographic/coordinate-system/CoordinateSystem';
import type Instance from '../core/Instance';
import type Layer from '../core/layer/Layer';
import type Entity3D from '../entities/Entity3D';
import type { BoundingBoxHelper } from '../helpers/Helpers';

import { isColorLayer } from '../core/layer/ColorLayer';
import { isElevationLayer } from '../core/layer/ElevationLayer';
import * as MemoryUsage from '../core/MemoryUsage';
import { isMap } from '../entities/Map';
import Helpers from '../helpers/Helpers';
import { isMaterial } from '../utils/predicates';
import ColorimetryPanel from './ColorimetryPanel';
import ColorMapInspector from './ColorMapInspector';
import Panel from './Panel';
import SourceInspector from './SourceInspector';

function getTitle(layer: Layer): string {
    return [layer.visible ? '👁️' : '❌', layer.type, `(${layer.name ?? layer.id})`].join(' ');
}

const blendingModes = ['None', 'Normal', 'Add', 'Multiply'];

/**
 * Inspector for a {@link Layer}.
 */
class LayerInspector extends Panel {
    /** The inspected layer. */
    public layer: Layer;
    public entity: Entity3D;
    public state: string;
    public sourceCrs: CoordinateSystem;
    public interpretation: string;
    public minmax: { min: number; max: number } | undefined;
    public extentColor: Color;
    public showExtent: boolean;
    public extentHelper: BoundingBoxHelper | null;
    public visible = true;
    /** The color map inspector */
    public colorMapInspector: ColorMapInspector;
    /** The source inspector. */
    public sourceInspector: SourceInspector | undefined;
    public colorimetryPanel: ColorimetryPanel | undefined;
    public composerImages = 0;
    public cpuMemoryUsage = 'unknown';
    public gpuMemoryUsage = 'unknown';
    public blendingMode = 'Normal';

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     * @param entity - The map.
     * @param layer - The layer to inspect
     */
    public constructor(gui: GUI, instance: Instance, entity: Entity3D, layer: Layer) {
        super(gui, instance, getTitle(layer));

        this.layer = layer;

        this.entity = entity;
        this.state = 'idle';
        this.sourceCrs = layer.source.getCrs() ?? instance.coordinateSystem;

        this.updateValues();

        this.addController(this.layer, 'id').name('Identifier');
        this.addController(this, 'cpuMemoryUsage').name('Memory usage (CPU)');
        this.addController(this, 'gpuMemoryUsage').name('Memory usage (GPU)');
        if (layer.name != null) {
            this.addController(this.layer, 'name').name('Name');
        }
        this.addController(this.sourceCrs, 'id').name('Source CRS');

        this.addController(this, 'state').name('Status');
        this.addController(this.layer, 'resolutionFactor').name('Resolution factor');
        this.addController(this.layer, 'visible')
            .name('Visible')
            .onChange(() => {
                this.gui.title(getTitle(layer));
                this.notify(entity);
            });

        this.addController(this.layer, 'frozen')
            .name('Frozen')
            .onChange(() => {
                this.notify(entity);
            });

        this.interpretation = layer.interpretation.toString();
        this.addController(this, 'interpretation').name('Interpretation');

        this.addController(this, 'repaint')
            .name('Repaint layer')
            .onChange(() => {
                this.notify(entity);
            });

        this.addController(this, 'composerImages').name('Loaded images');

        if (isElevationLayer(this.layer)) {
            this.minmax = { min: this.layer.minmax.min, max: this.layer.minmax.max };
            this.addController(this.minmax, 'min').name('Minimum elevation');
            this.addController(this.minmax, 'max').name('Maximum elevation');
        }

        if (isColorLayer(this.layer)) {
            const colorLayer = this.layer;

            if (colorLayer.elevationRange) {
                this.addController(colorLayer.elevationRange, 'min')
                    .name('Elevation range minimum')
                    .onChange(() => this.notify(entity));

                this.addController(colorLayer.elevationRange, 'max')
                    .name('Elevation range maximum')
                    .onChange(() => this.notify(entity));
            }

            this.blendingMode = blendingModes[colorLayer.blendingMode];

            this.addController(this, 'blendingMode', blendingModes)
                .name('Blending mode')
                .onChange(v => {
                    colorLayer.blendingMode = blendingModes.indexOf(v);
                    this.notify(colorLayer);
                });

            this.colorimetryPanel = new ColorimetryPanel(
                colorLayer.colorimetry,
                this.gui,
                instance,
            );
        }

        if ('opacity' in this.layer && this.layer.opacity !== undefined) {
            this.addController(this.layer, 'opacity')
                .name('Opacity')
                .min(0)
                .max(1)
                .onChange(() => this.notify(entity));
        }

        this.extentColor = new Color('#52ff00');
        this.showExtent = false;
        this.extentHelper = null;

        this.addController(this, 'showExtent')
            .name('Show extent')
            .onChange(() => this.toggleExtent());
        this.addColorController(this, 'extentColor')
            .name('Extent color')
            .onChange(() => this.updateExtentColor());

        this.colorMapInspector = new ColorMapInspector(
            this.gui,
            instance,
            () => layer.colorMap,
            () => this.notify(layer),
        );

        if (this.layer.source != null) {
            this.sourceInspector = new SourceInspector(this.gui, instance, layer.source);
        }

        this.addController(this, 'disposeLayer').name('Dispose layer');

        if (isMap(this.entity)) {
            this.addController(this, 'removeLayer').name('Remove layer from map');
        }

        layer.addEventListener('visible-property-changed', () => this.gui.title(getTitle(layer)));
    }

    public repaint(): void {
        this.layer.clear();
    }

    public get colorMap(): Pick<ColorMap, 'min' | 'max' | 'mode'> {
        if (this.layer.colorMap) {
            return this.layer.colorMap;
        }

        return { min: -1, max: -1, mode: 'N/A' as unknown as ColorMapMode };
    }

    public removeLayer(): void {
        if (isMap(this.entity)) {
            this.entity.removeLayer(this.layer);
        }
    }

    public disposeLayer(): void {
        this.layer.dispose();
        this.notify(this.layer);
    }

    public updateExtentColor(): void {
        if (this.extentHelper) {
            this.instance.threeObjects.remove(this.extentHelper);
            if (isMaterial(this.extentHelper.material)) {
                this.extentHelper.material.dispose();
            }
            this.extentHelper.geometry.dispose();
            this.extentHelper = null;
        }
        this.toggleExtent();
    }

    public toggleExtent(): void {
        if (!this.extentHelper && this.showExtent && isMap(this.entity)) {
            const { min, max } = this.entity.getElevationMinMax();
            const box = this.layer.getExtent()?.toBox3(min, max);
            if (box) {
                this.extentHelper = Helpers.createBoxHelper(box, this.extentColor);
                this.instance.threeObjects.add(this.extentHelper);
                this.extentHelper.updateMatrixWorld(true);
            }
        }

        if (this.extentHelper) {
            this.extentHelper.visible = this.showExtent;
        }

        this.notify(this.layer);
    }

    public override updateControllers(): void {
        super.updateControllers();
        this.colorMapInspector?.updateControllers();
    }

    public override updateValues(): void {
        this.state = this.layer.loading
            ? `loading (${Math.round(this.layer.progress * 100)}%)`
            : 'idle';
        this.visible = this.layer.visible || true;
        this.composerImages = this.layer.composer?.images?.size ?? 0;
        if (isElevationLayer(this.layer)) {
            if (this.layer.minmax != null && this.minmax != null) {
                this.minmax.min = this.layer.minmax.min;
                this.minmax.max = this.layer.minmax.max;
            }
        }
        const ctx: MemoryUsage.GetMemoryUsageContext = {
            renderer: this.instance.renderer,
            objects: new Map(),
        };

        this.layer.getMemoryUsage(ctx);

        const memUsage = MemoryUsage.aggregateMemoryUsage(ctx);
        this.cpuMemoryUsage = MemoryUsage.format(memUsage.cpuMemory);
        this.gpuMemoryUsage = MemoryUsage.format(memUsage.gpuMemory);

        this._controllers.forEach(c => c.updateDisplay());

        if (this.sourceInspector) {
            this.sourceInspector.updateValues();
        }
    }
}

export default LayerInspector;
