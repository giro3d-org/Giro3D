import type GUI from 'lil-gui';
import type { Color, Material, Object3D } from 'three';
import type Instance from '../core/Instance';
import type FeatureCollection from '../entities/FeatureCollection';
import Helpers from '../helpers/Helpers';
import EntityInspector from './EntityInspector';

type HasMaterial = Object3D & { material: Material };

function hasMaterial(obj: Object3D): obj is HasMaterial {
    if (obj == null) {
        return false;
    }

    const hasMat = obj as HasMaterial;
    if (hasMat.material != null) {
        return true;
    }

    return false;
}

function applyToMaterial(
    root: Object3D,
    entity: FeatureCollection,
    callback: (material: Material) => void,
) {
    root.traverse(object => {
        if (hasMaterial(object) && object.userData.parentEntity === entity) {
            callback(object.material);
        }
    });
}

class FeatureCollectionInspector extends EntityInspector<FeatureCollection> {
    /** Toggle the wireframe rendering of the features. */
    wireframe: boolean;
    /** Toggle the frozen property of the features. */
    frozen: boolean;
    /** Store the CRS code of this.featureCollection */
    dataProjection: string;
    showGrid: boolean;

    /**
     * Creates an instance of FeatureCollectionInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param featureCollection - The inspected Features.
     */
    constructor(parentGui: GUI, instance: Instance, featureCollection: FeatureCollection) {
        super(parentGui, instance, featureCollection, {
            visibility: true,
            boundingBoxColor: true,
            boundingBoxes: true,
            opacity: true,
        });

        this.wireframe = false;
        this.frozen = this.entity.frozen ?? false;
        this.dataProjection = this.entity.dataProjection ?? '';

        this.showGrid = false;

        this.addController(this, 'dataProjection').name('Data projection');
        this.addController(this, 'wireframe')
            .name('Wireframe')
            .onChange(v => this.toggleWireframe(v));
        this.addController(this.entity, 'materialCount').name('Materials');
    }

    /**
     * @param tile - The tile to decorate.
     * @param add - If true, bounding box is added, otherwise it is removed.
     * @param color - The bounding box color.
     */

    addOrRemoveBoundingBox(tile: Object3D, add: boolean, color: Color) {
        if (add && 'boundingBox' in tile && tile.visible) {
            Helpers.addBoundingBox(tile, color);
        } else {
            Helpers.removeBoundingBox(tile);
        }
    }

    toggleWireframe(value: boolean) {
        applyToMaterial(this.rootObject, this.entity, material => {
            if ('wireframe' in material) {
                material.wireframe = value;
            }
        });
        this.notify(this.entity);
    }
}

export default FeatureCollectionInspector;
