import type GUI from 'lil-gui';
import type { AxesHelper, GridHelper, Side } from 'three';
import { Color, MathUtils, Mesh, MeshBasicMaterial, Sphere, SphereGeometry } from 'three';
import type Instance from '../core/Instance';
import Globe from '../entities/Globe';
import type Map from '../entities/Map';
import TileMesh from '../entities/tiles/TileMesh';
import type { BoundingBoxHelper } from '../helpers/Helpers';
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

const tmpSphere = new Sphere();

type Sidedness = 'Front' | 'Back' | 'DoubleSide';

const sides: Sidedness[] = ['Front', 'Back', 'DoubleSide'];

class MapInspector extends EntityInspector<Map> {
    /** Toggle the frozen property of the map. */
    frozen: boolean;
    showGrid: boolean;
    renderState: string;
    layerCount: number;
    background: Color;
    backgroundOpacity: number;
    extentColor: Color;
    showExtent: boolean;
    extentHelper: BoundingBoxHelper | null;
    lightingPanel: MapLightingPanel;
    tileInfoPanel: TileInfoPanel;
    contourLinePanel: ContourLinePanel;
    colorimetryPanel: ColorimetryPanel;
    graticulePanel: GraticulePanel;
    /** The layer folder. */
    layerFolder: GUI;
    layers: LayerInspector[];
    private _fillLayersCb: () => void;
    grid?: GridHelper;
    axes?: AxesHelper;
    reachableTiles: number;
    visibleTiles: number;
    terrainPanel: MapTerrainPanel;
    side: Sidedness = 'Front';
    showSphereVolumes = false;
    boundingSpheres: Set<Mesh<SphereGeometry, MeshBasicMaterial>> = new Set();
    sphereMaterial?: MeshBasicMaterial;
    sphereGeometry?: SphereGeometry;

    /**
     * Creates an instance of MapInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param map - The inspected Map.
     */
    constructor(parentGui: GUI, instance: Instance, map: Map) {
        super(parentGui, instance, map, {
            visibility: true,
            boundingBoxColor: true,
            boundingBoxes: true,
            opacity: true,
        });

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

        this.addController(this, 'side', sides)
            .name('Sidedness')
            .onChange(v => this.setSidedness(v));
        this.addController(this.entity, 'depthTest')
            .name('Depth test')
            .onChange(() => this.notify(this.entity));
        this.addController(this, 'visibleTiles').name('Visible tiles');
        this.addController(this, 'reachableTiles').name('Reachable tiles');
        // @ts-expect-error private property
        this.addController(this.entity._allTiles, 'size').name('Loaded tiles');
        if (this.entity.elevationRange) {
            this.addController(this.entity.elevationRange, 'min')
                .name('Elevation range minimum')
                .onChange(() => this.notify(map));

            this.addController(this.entity.elevationRange, 'max')
                .name('Elevation range maximum')
                .onChange(() => this.notify(map));
        }
        if (this.entity instanceof Globe) {
            this.addController(this.entity, 'horizonCulling');
        }
        this.addController(this.entity, 'castShadow');
        this.addController(this.entity, 'receiveShadow');
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
            .onChange(() => this.notify());
        this.addColorController(this.entity, 'tileOutlineColor')
            .name('Tile outline color')
            .onChange(() => this.notify());
        this.addController(this, 'showExtent')
            .name('Show extent')
            .onChange(() => this.toggleExtent());
        this.addColorController(this, 'extentColor')
            .name('Extent color')
            .onChange(() => this.updateExtentColor());
        this.addController(this, 'showSphereVolumes')
            .name('Show sphere volumes')
            .onChange(() => this.notify());
        this.addController(this.entity, 'subdivisionThreshold')
            .name('Subdivision threshold')
            .min(0.1)
            .max(3)
            .step(0.1)
            .onChange(() => this.notify());

        this.tileInfoPanel = new TileInfoPanel(this.entity, this.gui, instance);
        this.terrainPanel = new MapTerrainPanel(this.entity, this.gui, instance);

        this.lightingPanel = new MapLightingPanel(this.entity.lighting, this.gui, instance);

        this.graticulePanel = new GraticulePanel(this.entity.graticule, this.gui, instance);

        this.contourLinePanel = new ContourLinePanel(this.entity.contourLines, this.gui, instance);

        this.colorimetryPanel = new ColorimetryPanel(this.entity.colorimetry, this.gui, instance);

        this.addController(this, 'layerCount').name('Layer count');
        this.addController(this, 'renderState', ['Normal', 'Picking'])
            .name('Render state')
            .onChange(v => this.setRenderState(v));
        this.addController(this, 'dumpTiles').name('Dump tiles in console');
        this.addController(this, 'disposeMapAndLayers').name('Dispose map and layers');

        this.layerFolder = this.gui.addFolder('Layers');

        this.layers = [];

        this._fillLayersCb = () => this.fillLayers();

        this.entity.addEventListener('layer-added', this._fillLayersCb);
        this.entity.addEventListener('layer-removed', this._fillLayersCb);
        this.entity.addEventListener('layer-order-changed', this._fillLayersCb);

        this.instance.addEventListener(
            'after-camera-update',
            this.updateBoundingSpheres.bind(this),
        );

        this.fillLayers();
    }

    disposeMapAndLayers() {
        const layers = this.entity.getLayers();
        for (const layer of layers) {
            this.entity.removeLayer(layer, { disposeLayer: true });
        }
        this.instance.remove(this.entity);
        this.notify();
    }

    private updateBoundingSpheres() {
        if (!this.showSphereVolumes) {
            if (this.boundingSpheres.size > 0) {
                this.boundingSpheres.forEach(mesh => {
                    mesh.removeFromParent();
                    mesh.userData.owner.userData.boundingSphere = null;
                });
                this.boundingSpheres.clear();
            }
            return;
        }

        if (!this.sphereMaterial) {
            this.sphereMaterial = new MeshBasicMaterial({
                color: this.boundingBoxColor,
                wireframe: true,
            });
        }

        if (!this.sphereGeometry) {
            this.sphereGeometry = new SphereGeometry(1, 32, 16);
        }

        this.sphereMaterial.color = new Color(this.boundingBoxColor);

        [...this.boundingSpheres].forEach(mesh => {
            const tile: TileMesh = mesh.userData.owner;
            if (tile.disposed) {
                mesh.removeFromParent();
                this.boundingSpheres.delete(mesh);
            } else {
                mesh.visible = tile.visible && tile.material.visible;
            }
        });

        this.entity.traverseTiles(tile => {
            if (tile.userData.boundingSphere == null) {
                const mesh = new Mesh(this.sphereGeometry, this.sphereMaterial);
                tile.userData.boundingSphere = mesh;

                this.instance.add(mesh);
                this.boundingSpheres.add(mesh);

                mesh.userData.owner = tile;
                // So that the poles of the sphere match the vertical axis
                mesh.rotateX(MathUtils.degToRad(90));
            }

            const mesh: Mesh = tile.userData.boundingSphere;
            const sphere = tile.getWorldSpaceBoundingSphere(tmpSphere);

            const r = sphere.radius;

            mesh.scale.set(r, r, r);
            mesh.position.copy(sphere.center);

            mesh.updateMatrixWorld(true);
        });
    }

    override toggleBoundingBoxes() {
        const color = new Color(this.boundingBoxColor);
        const noDataColor = new Color('gray');
        // by default, adds axis-oriented bounding boxes to each object in the hierarchy.
        // custom implementations may override this to have a different behaviour.
        // @ts-expect-error monkey patched method
        this.rootObject.traverseOnce(obj => {
            if (obj instanceof TileMesh) {
                const tile = obj as TileMesh;
                let finalColor = new Color();
                const layerCount = obj.material?.getLayerCount();
                if (layerCount === 0) {
                    finalColor = noDataColor;
                } else {
                    finalColor = color;
                }
                this.addOrRemoveBoundingBox(tile, this.boundingBoxes, finalColor);
            }
        });
        this.notify(this.entity);
    }

    override updateControllers(): void {
        super.updateControllers();
        this.layers.forEach(insp => insp.updateControllers());
    }

    updateBackgroundOpacity(a: number) {
        this.backgroundOpacity = a;
        this.entity.backgroundOpacity = a;
        this.notify(this.entity);
    }

    updateBackgroundColor(srgb: Color) {
        this.background.copy(srgb);
        this.entity.backgroundColor.copySRGBToLinear(srgb);
        this.notify(this.entity);
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

    setSidedness(side: Sidedness) {
        this.entity.side = sides.indexOf(side) as Side;
        this.notify(this.entity);
    }

    setRenderState(state: string) {
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

    removeEventListeners() {
        this.entity.removeEventListener('layer-added', this._fillLayersCb);
        this.entity.removeEventListener('layer-removed', this._fillLayersCb);
        this.entity.removeEventListener('layer-order-changed', this._fillLayersCb);
    }

    override dispose() {
        super.dispose();
        this.removeEventListeners();
    }

    dumpTiles() {
        const tiles: TileMesh[] = [];
        const collect = (t: TileMesh) => tiles.push(t);
        this.entity.traverseTiles(collect);
        console.log(tiles);
    }

    override updateValues() {
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

    fillLayers() {
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

    toggleGrid(value: boolean) {
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
