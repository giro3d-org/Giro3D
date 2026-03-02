/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';
import type { AxesHelper, GridHelper, Side } from 'three';

import { Color } from 'three';

import type Instance from '../core/Instance';
import type Map from '../entities/Map';
import type TileMesh from '../entities/tiles/TileMesh';
import type { BoundingBoxHelper } from '../helpers/Helpers';

import { isGlobe } from '../entities/Globe';
import Helpers from '../helpers/Helpers';
import RenderingState from '../renderer/RenderingState';
import { isMaterial } from '../utils/predicates';
import ColorimetryPanel from './ColorimetryPanel';
import ContourLinePanel from './ContourLinePanel';
import EntityInspector from './EntityInspector';
import GraticulePanel from './GraticulePanel';
import LayerInspector from './LayerInspector';
import MapLightingPanel from './MapLightingPanel';
import MapTerrainPanel from './MapTerrainPanel';
import TileInfoPanel from './TileInfoPanel';

type Sidedness = 'Front' | 'Back' | 'DoubleSide';

const sides: Sidedness[] = ['Front', 'Back', 'DoubleSide'];

class MapInspector extends EntityInspector<Map> {
    /** Toggle the frozen property of the map. */
    public frozen: boolean;
    public showGrid: boolean;
    public renderState: string;
    public layerCount: number;
    public background: Color;
    public backgroundOpacity: number;
    public extentColor: Color;
    public showExtent: boolean;
    public extentHelper: BoundingBoxHelper | null;
    public lightingPanel: MapLightingPanel;
    public tileInfoPanel: TileInfoPanel;
    public contourLinePanel: ContourLinePanel;
    public colorimetryPanel: ColorimetryPanel;
    public graticulePanel: GraticulePanel;
    /** The layer folder. */
    public layerFolder: GUI;
    public layers: LayerInspector[];
    private _fillLayersCb: () => void;
    private _paintCompleteCb: () => void;
    public grid?: GridHelper;
    public axes?: AxesHelper;
    public reachableTiles: number;
    public visibleTiles: number;
    public terrainPanel: MapTerrainPanel;
    public side: Sidedness = 'Front';
    public completePaints = 0;

    /**
     * Creates an instance of MapInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param map - The inspected Map.
     */
    public constructor(parentGui: GUI, instance: Instance, map: Map) {
        super(parentGui, instance, map, {
            visibility: true,
            boundingBoxColor: true,
            boundingBoxes: true,
            opacity: true,
        });

        this.boundingBoxColor = `#${new Color(this.entity.helperColor).getHexString()}`;
        this.frozen = this.entity.frozen ?? false;
        this.showGrid = false;
        this.renderState = 'Normal';
        this.side = sides[this.entity.side];

        this.addController(this.entity, 'discardNoData')
            .name('Discard no-data values')
            .onChange(() => this.notify(this.entity));
        this.layerCount = this.entity.layerCount;
        this.background = new Color().copyLinearToSRGB(this.entity.backgroundColor);
        this.backgroundOpacity = this.entity.backgroundOpacity;

        this.extentColor = new Color('red');
        this.showExtent = false;
        this.extentHelper = null;

        this.reachableTiles = 0;
        this.visibleTiles = 0;

        const notify = (): void => this.notify(this.entity);

        this.addController(this, 'side', sides)
            .name('Sidedness')
            .onChange(v => this.setSidedness(v));
        this.addController(this.entity, 'depthTest').name('Depth test').onChange(notify);
        this.addController(this, 'visibleTiles').name('Visible tiles');
        this.addController(this, 'reachableTiles').name('Reachable tiles');
        // @ts-expect-error private property
        this.addController(this.entity._allTiles, 'size').name('Loaded tiles');
        if (this.entity.elevationRange) {
            this.addController(this.entity.elevationRange, 'min')
                .name('Elevation range minimum')
                .onChange(notify);

            this.addController(this.entity.elevationRange, 'max')
                .name('Elevation range maximum')
                .onChange(notify);
        }
        if (isGlobe(this.entity)) {
            this.addController(this.entity, 'horizonCulling').onChange(notify);
        }
        this.addController(this, 'completePaints');
        this.addController(this.entity, 'castShadow').onChange(notify);
        this.addController(this.entity, 'receiveShadow').onChange(notify);
        this.addController(this, 'showGrid')
            .name('Show grid')
            .onChange(v => this.toggleGrid(v));
        this.addColorController(this, 'background')
            .name('Background')
            .onChange(v => this.updateBackgroundColor(v));
        this.addController(this, 'backgroundOpacity')
            .name('Background opacity')
            .min(0)
            .max(1)
            .onChange(v => this.updateBackgroundOpacity(v));
        this.addController(this.entity, 'showTileOutlines')
            .name('Show tiles outlines')
            .onChange(notify);
        this.addColorController(this.entity, 'tileOutlineColor')
            .name('Tile outline color')
            .onChange(notify);
        this.addController(this, 'showExtent')
            .name('Show extent')
            .onChange(() => this.toggleExtent());
        this.addColorController(this, 'extentColor')
            .name('Extent color')
            .onChange(() => this.updateExtentColor());
        this.addController(this.entity, 'showBoundingSpheres');
        this.addController(this.entity, 'subdivisionThreshold')
            .name('Subdivision threshold')
            .min(0.1)
            .max(3)
            .step(0.1)
            .onChange(notify);

        this.tileInfoPanel = new TileInfoPanel(this.entity, this.gui, instance);
        this.terrainPanel = new MapTerrainPanel(this.entity, this.gui, instance);

        this.lightingPanel = new MapLightingPanel(this.entity.lighting, this.gui, instance);
        this.lightingPanel.addEventListener('notify', notify);

        this.graticulePanel = new GraticulePanel(this.entity.graticule, this.gui, instance);
        this.graticulePanel.addEventListener('notify', notify);

        this.contourLinePanel = new ContourLinePanel(this.entity.contourLines, this.gui, instance);
        this.contourLinePanel.addEventListener('notify', notify);

        this.colorimetryPanel = new ColorimetryPanel(this.entity.colorimetry, this.gui, instance);
        this.colorimetryPanel.addEventListener('notify', notify);

        this.addController(this, 'layerCount').name('Layer count');
        this.addController(this, 'renderState', ['Normal', 'Picking'])
            .name('Render state')
            .onChange(v => this.setRenderState(v));
        this.addController(this, 'dumpTiles').name('Dump tiles in console');
        this.addController(this, 'disposeMapAndLayers').name('Dispose map and layers');

        this.layerFolder = this.gui.addFolder('Layers');

        this.layers = [];

        this._fillLayersCb = (): void => this.fillLayers();
        this._paintCompleteCb = (): void => this.paintComplete();

        this.entity.addEventListener('layer-added', this._fillLayersCb);
        this.entity.addEventListener('layer-removed', this._fillLayersCb);
        this.entity.addEventListener('layer-order-changed', this._fillLayersCb);
        this.entity.addEventListener('paint-complete', this._paintCompleteCb);

        this.fillLayers();
    }

    private paintComplete(): void {
        this.completePaints++;
        this.updateControllers();
    }

    public disposeMapAndLayers(): void {
        const layers = this.entity.getLayers();
        for (const layer of layers) {
            this.entity.removeLayer(layer, { disposeLayer: true });
        }
        this.instance.remove(this.entity);
        this.notify();
    }

    public override toggleBoundingBoxes(): void {
        this.entity.showBoundingBoxes = this.boundingBoxes;
        this.entity.helperColor = this.boundingBoxColor;
    }

    public override updateControllers(): void {
        super.updateControllers();
        this.layers.forEach(insp => insp.updateControllers());
    }

    public updateBackgroundOpacity(a: number): void {
        this.backgroundOpacity = a;
        this.entity.backgroundOpacity = a;
        this.notify(this.entity);
    }

    public updateBackgroundColor(srgb: Color): void {
        this.background.copy(srgb);
        this.entity.backgroundColor.copySRGBToLinear(srgb);
        this.notify(this.entity);
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
        if (!this.extentHelper && this.showExtent) {
            const { min, max } = this.entity.getElevationMinMax();
            const box = this.entity.extent.toBox3(min, max);
            this.extentHelper = Helpers.createBoxHelper(box, this.extentColor);
            this.instance.threeObjects.add(this.extentHelper);
            this.extentHelper.updateMatrixWorld(true);
        }

        if (this.extentHelper) {
            this.extentHelper.visible = this.showExtent;
        }

        this.notify(this.entity);
    }

    public setSidedness(side: Sidedness): void {
        this.entity.side = sides.indexOf(side) as Side;
        this.notify(this.entity);
    }

    public setRenderState(state: string): void {
        switch (state) {
            case 'Normal':
                this.entity.setRenderState(RenderingState.FINAL);
                break;
            case 'Picking':
                this.entity.setRenderState(RenderingState.PICKING);
                break;
            default:
                break;
        }

        this.notify(this.entity);
    }

    public removeEventListeners(): void {
        this.entity.removeEventListener('layer-added', this._fillLayersCb);
        this.entity.removeEventListener('layer-removed', this._fillLayersCb);
        this.entity.removeEventListener('layer-order-changed', this._fillLayersCb);
    }

    public override dispose(): void {
        super.dispose();
        this.removeEventListeners();
    }

    public dumpTiles(): void {
        const tiles: TileMesh[] = [];
        const collect = (t: TileMesh): void => {
            tiles.push(t);
        };
        this.entity.traverseTiles(collect);
        console.log(tiles);
    }

    public override updateValues(): void {
        super.updateValues();
        this.tileInfoPanel.updateValues();
        this.toggleBoundingBoxes();
        this.layerCount = this.entity.layerCount;
        this.layers.forEach(l => l.updateValues());

        this.reachableTiles = 0;
        this.visibleTiles = 0;
        this.entity.traverseTiles(t => {
            if (t.material.visible) {
                this.visibleTiles++;
            }
            this.reachableTiles++;
        });
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

    public toggleGrid(value: boolean): void {
        if (!value) {
            if (this.grid) {
                this.grid.parent?.remove(this.grid);
            }
            if (this.axes) {
                this.axes.parent?.remove(this.axes);
            }
        } else {
            const dims = this.entity.extent.dimensions();
            const size = Math.max(dims.x, dims.y) * 1.1;
            const origin = this.entity.extent.centerAsVector3();

            const grid = Helpers.createGrid(origin, size, 20);
            this.instance.scene.add(grid);
            grid.updateMatrixWorld(true);
            this.grid = grid;

            const axes = Helpers.createAxes(size * 0.05);
            // We don't want to add the axes to the grid because the grid is rotated,
            // which would rotate the axes too and give a wrong information about the vertical axis.
            axes.position.copy(origin);
            this.axes = axes;
            this.axes.updateMatrixWorld(true);
            this.instance.scene.add(axes);
        }
        this.notify();
    }
}

export default MapInspector;
