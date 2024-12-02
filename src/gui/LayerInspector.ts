import type GUI from 'lil-gui';
import { Color } from 'three';

import type Instance from '../core/Instance';
import { isColorLayer } from '../core/layer/ColorLayer';
import { isElevationLayer } from '../core/layer/ElevationLayer';
import type Layer from '../core/layer/Layer';
import * as MemoryUsage from '../core/MemoryUsage';
import type Entity3D from '../entities/Entity3D';
import { isMap } from '../entities/Map';
import type { BoundingBoxHelper } from '../helpers/Helpers';
import Helpers from '../helpers/Helpers';
import { isMaterial } from '../utils/predicates';
import ColorimetryPanel from './ColorimetryPanel';
import ColorMapInspector from './ColorMapInspector';
import Panel from './Panel';
import SourceInspector from './SourceInspector';

function getTitle(layer: Layer) {
    return [layer.visible ? '👁️' : '❌', layer.type, `(${layer.name ?? layer.id})`].join(' ');
}

const blendingModes = ['None', 'Normal', 'Add', 'Multiply'];

/**
 * Inspector for a {@link Layer}.
 */
class LayerInspector extends Panel {
    /** The inspected layer. */
    layer: Layer;
    entity: Entity3D;
    state: string;
    sourceCrs: string;
    interpretation: string;
    minmax: { min: number; max: number } | undefined;
    extentColor: Color;
    showExtent: boolean;
    extentHelper: BoundingBoxHelper | null;
    visible = true;
    /** The color map inspector */
    colorMapInspector: ColorMapInspector;
    /** The source inspector. */
    sourceInspector: SourceInspector | undefined;
    colorimetryPanel: ColorimetryPanel | undefined;
    composerImages = 0;
    cpuMemoryUsage = 'unknown';
    gpuMemoryUsage = 'unknown';
    blendingMode = 'Normal';

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     * @param entity - The map.
     * @param layer - The layer to inspect
     */
    constructor(gui: GUI, instance: Instance, entity: Entity3D, layer: Layer) {
        super(gui, instance, getTitle(layer));

        this.layer = layer;

        this.entity = entity;
        this.state = 'idle';
        this.sourceCrs = layer.source.getCrs() ?? instance.referenceCrs;

        this.updateValues();

        this.addController(this.layer, 'id').name('Identifier');
        this.addController(this, 'cpuMemoryUsage').name('Memory usage (CPU)');
        this.addController(this, 'gpuMemoryUsage').name('Memory usage (GPU)');
        if (layer.name != null) {
            this.addController(this.layer, 'name').name('Name');
        }
        this.addController(this, 'sourceCrs').name('Source CRS');

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

    repaint() {
        this.layer.clear();
    }

    get colorMap() {
        if (this.layer.colorMap) {
            return this.layer.colorMap;
        }

        return { min: '-1', max: '-1', mode: 'N/A' };
    }

    removeLayer() {
        if (isMap(this.entity)) {
            this.entity.removeLayer(this.layer);
        }
    }

    disposeLayer() {
        this.layer.dispose();
        this.notify(this.layer);
    }

    updateExtentColor() {
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

    toggleExtent() {
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

    updateControllers(): void {
        super.updateControllers();
        this.colorMapInspector?.updateControllers();
    }

    updateValues() {
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
