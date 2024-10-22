import type GUI from 'lil-gui';
import type { Vector3 } from 'three';
import { Object3D } from 'three';
import type Instance from '../../core/Instance';
import { isBufferGeometry } from '../../utils/predicates';
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

    createControllers(obj: object, gui: GUI) {
        if (obj == null) {
            return;
        }

        const notify = () => this.instance.notifyChange();

        const entries = Object.entries(obj);

        entries.forEach(([name, value]) => {
            if (!name.startsWith('___outliner')) {
                switch (typeof value) {
                    case 'string':
                    case 'number':
                    case 'bigint':
                    case 'boolean':
                        if (value != null) {
                            this._controllers.push(gui.add(obj, name).onChange(notify));
                        }
                        break;
                }
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

        const update = () => this.updateObject(obj);

        function bindVector<K extends string & keyof Vector3>(gui: GUI, v: Vector3, key: K) {
            return gui.add(v, key).step(0.01);
        }

        this._controllers.push(bindVector(position, obj.position, 'x').onChange(update));
        this._controllers.push(bindVector(position, obj.position, 'y').onChange(update));
        this._controllers.push(bindVector(position, obj.position, 'z').onChange(update));

        const scale = this.gui.addFolder('Scale');
        scale.close();
        this._folders.push(scale);

        this._controllers.push(bindVector(scale, obj.scale, 'x').onChange(update));
        this._controllers.push(bindVector(scale, obj.scale, 'y').onChange(update));
        this._controllers.push(bindVector(scale, obj.scale, 'z').onChange(update));

        if ('material' in obj && obj.material != null) {
            const material = this.gui.addFolder('Material');
            this._folders.push(material);
            material.close();
            this.createControllers(obj.material, material);
        }

        if ('geometry' in obj && isBufferGeometry(obj.geometry)) {
            const geometry = this.gui.addFolder('Geometry');
            this._folders.push(geometry);
            geometry.close();
            this.createControllers(obj.geometry, geometry);

            if (obj.geometry.attributes != null) {
                const attrs = obj.geometry.attributes;
                const attributes = geometry.addFolder('Attributes');
                Object.keys(attrs).forEach(p => {
                    const attrValue = attrs[p];
                    if (p && attrValue != null) {
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
