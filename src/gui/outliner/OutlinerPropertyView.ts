import type GUI from 'lil-gui';
import { Object3D } from 'three';
import type Instance from '../../core/Instance';
import Panel from '../Panel';

class OutlinerPropertyView extends Panel {
    protected _folders: GUI[];

    constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Properties');

        this._folders = [];

        this.gui.domElement.style.overflow = 'auto';
        this.gui.domElement.style.maxHeight = '200px';
        this.gui.open(true);

        this.populateProperties(new Object3D());
    }

    createControllers(obj: any, gui: GUI) {
        if (!obj) {
            return;
        }
        const keys = Object.keys(obj).sort();
        keys.forEach(prop => {
            const value = obj[prop];
            if (value != null && !(value instanceof Object)) {
                this._controllers.push(
                    gui.add(obj, prop).onChange(() => this.instance.notifyChange()),
                );
            }
        });
    }

    /**
     * @param obj - The object to update.
     */
    updateObject(obj: Object3D) {
        obj.updateMatrixWorld(true);
        obj.updateWorldMatrix(true, true);
        this.notify();
    }

    populateProperties(obj: Object3D) {
        while (this._controllers.length > 0) {
            this._controllers.pop()?.destroy();
        }
        while (this._folders.length > 0) {
            this._folders.pop()?.destroy();
        }
        this.createControllers(obj, this.gui);

        const position = this.gui.addFolder('Position');
        position.close();
        this._folders.push(position);
        this._controllers.push(
            position.add(obj.position, 'x').onChange(() => this.updateObject(obj)),
        );
        this._controllers.push(
            position.add(obj.position, 'y').onChange(() => this.updateObject(obj)),
        );
        this._controllers.push(
            position.add(obj.position, 'z').onChange(() => this.updateObject(obj)),
        );

        const scale = this.gui.addFolder('Scale');
        scale.close();
        this._folders.push(scale);
        this._controllers.push(scale.add(obj.scale, 'x').onChange(() => this.updateObject(obj)));
        this._controllers.push(scale.add(obj.scale, 'y').onChange(() => this.updateObject(obj)));
        this._controllers.push(scale.add(obj.scale, 'z').onChange(() => this.updateObject(obj)));

        if ('material' in obj && obj.material) {
            const material = this.gui.addFolder('Material');
            this._folders.push(material);
            material.close();
            this.createControllers(obj.material, material);
        }

        if ('geometry' in obj && obj.geometry) {
            const geometry = this.gui.addFolder('Geometry');
            this._folders.push(geometry);
            geometry.close();
            this.createControllers(obj.geometry, geometry);

            if ((obj as any).geometry.attributes) {
                const attrs = (obj as any).geometry.attributes;
                const attributes = geometry.addFolder('Attributes');
                Object.keys(attrs).forEach(p => {
                    const attrValue = attrs[p];
                    if (p && attrValue) {
                        const attr = attributes.addFolder(p);
                        attr.close();
                        attr.add(attrValue, 'normalized');
                        attr.add(attrValue, 'count');
                        attr.add(attrValue, 'itemSize');
                        attr.add(attrValue, 'usage');
                    }
                });
            }
        }
    }
}

export default OutlinerPropertyView;
