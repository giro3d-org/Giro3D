import type GUI from 'lil-gui';
import type { Color } from 'three';
import type Instance from '../core/Instance';
import type Tiles3D from '../entities/Tiles3D';
import Helpers from '../helpers/Helpers';
import EntityInspector from './EntityInspector';
import LayerInspector from './LayerInspector';

class Tiles3dInspector extends EntityInspector<Tiles3D> {
    /** Toggle the wireframe rendering of the entity. */
    wireframe: boolean;
    /** The SSE of the entity. */
    sse: number;
    layers: LayerInspector[] = [];
    layerFolder: GUI;

    /**
     * Creates an instance of Tiles3dInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param entity - The inspected 3D tileset.
     */
    constructor(parentGui: GUI, instance: Instance, entity: Tiles3D) {
        super(parentGui, instance, entity, {
            visibility: true,
            boundingBoxColor: true,
            boundingBoxes: true,
            opacity: true,
        });

        this.wireframe = entity.wireframe ?? false;
        this.sse = entity.sseThreshold;

        this.addController(this, 'wireframe')
            .name('Wireframe')
            .onChange(v => this.toggleWireframe(v));
        this.addController(this, 'sse')
            .min(this.sse / 4)
            .max(this.sse * 4)
            .name('Screen Space Error')
            .onChange(v => this.updateSSE(v));
        this.addController(this.entity, 'cleanupDelay')
            .min(10)
            .max(10000)
            .name('Cleanup delay (ms)')
            .onChange(() => this.notify());

        if (this.entity.material) {
            if ('brightness' in this.entity.material) {
                this.addController(this.entity.material, 'brightness')
                    .min(-1)
                    .max(1)
                    .name('Brightness')
                    .onChange(() => this.instance.notifyChange(this.entity));
            }
            if ('contrast' in this.entity.material) {
                this.addController(this.entity.material, 'contrast')
                    .name('Contrast')
                    .min(0)
                    .max(10)
                    .onChange(() => this.instance.notifyChange(this.entity));
            }
            if ('saturation' in this.entity.material) {
                this.addController(this.entity.material, 'saturation')
                    .name('Saturation')
                    .min(0)
                    .max(10)
                    .onChange(() => this.instance.notifyChange(this.entity));
            }
        }

        this.layerFolder = this.gui.addFolder('Layers');
        if (this.entity.layerCount > 0) {
            this.fillLayers();
        }
    }

    updateControllers(): void {
        super.updateControllers();
        if (this.layers.length !== this.entity.layerCount) {
            this.fillLayers();
        }
    }

    updateValues(): void {
        super.updateValues();
        this.layers.forEach(panel => panel.updateValues());
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

    toggleWireframe(value: boolean) {
        this.entity.wireframe = value;
        this.notify();
    }

    updateSSE(v: number) {
        this.entity.sseThreshold = v;
        this.notify();
    }

    notify() {
        this.instance.notifyChange(this.instance.view.camera);
    }

    toggleBoundingBoxes(visible: boolean) {
        // @ts-expect-error traverseOnce is monkey patched
        this.rootObject.traverseOnce(obj => {
            if (visible) {
                const { metadata } = obj.userData;
                if (metadata != null) {
                    const result = Helpers.create3DTileBoundingVolume(
                        this.entity,
                        obj,
                        metadata,
                        obj === this.entity.root ? 'cyan' : this.boundingBoxColor,
                    );
                    if (result) {
                        if (result.absolute) {
                            this.rootObject.add(result.object3d);
                        } else {
                            obj.add(result.object3d);
                        }
                        result.object3d.updateMatrixWorld();
                    }
                }
            } else {
                Helpers.remove3DTileBoundingVolume(obj);
            }
        });
        this.notify();
    }

    updateBoundingBoxColor(color: Color) {
        this.rootObject.traverse(obj => {
            Helpers.update3DTileBoundingVolume(obj, { color });
        });

        this.notify();
    }
}

export default Tiles3dInspector;
