/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { BatchTable, PNTSScene, Tile } from '3d-tiles-renderer';
import type { BufferAttribute, BufferGeometry, TypedArray } from 'three';

import {
    Float32BufferAttribute,
    FloatType,
    Int16BufferAttribute,
    Int32BufferAttribute,
    Int8BufferAttribute,
    IntType,
    MathUtils,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
    Uint8BufferAttribute,
    Vector2,
    Vector4,
} from 'three';

import type Extent from '../../core/geographic/Extent';
import type { LayerNode } from '../../core/layer/Layer';
import type PointCloudParameters from './PointCloudParameters';
import type { WellKnown3DTilesPointCloudAttributes } from './PointCloudParameters';

import PointCloudMaterial from '../../renderer/PointCloudMaterial';
import { enablePointCloudPostProcessing } from '../../renderer/RenderPipeline';

export function isPNTSScene(obj: object): obj is PNTSScene {
    return (obj as PNTSScene).isPoints && 'batchTable' in obj;
}

/**
 * A plugin that applies some post-processing to point-based scenes.
 */
export default class PointCloudPlugin {
    private readonly _parameters: PointCloudParameters;

    public constructor(parameters: PointCloudParameters) {
        this._parameters = parameters;
    }

    private processBufferAttribute(
        geometry: BufferGeometry,
        batchTable: BatchTable,
        sourceAttribute: string,
        targetAttribute: WellKnown3DTilesPointCloudAttributes,
    ): void {
        const count = batchTable.count;
        const array = batchTable.getPropertyArray(sourceAttribute) as TypedArray;

        if (array == null) {
            // Attribute not present in the batch table.
            return;
        }

        let bufferAttribute: BufferAttribute;
        const itemSize = array.length / count;

        if (array instanceof Uint8Array || array instanceof Uint8ClampedArray) {
            bufferAttribute = new Uint8BufferAttribute(array, itemSize, false);
            bufferAttribute.gpuType = IntType;
        } else if (array instanceof Uint16Array) {
            bufferAttribute = new Uint16BufferAttribute(array, itemSize, false);
            bufferAttribute.gpuType = IntType;
        } else if (array instanceof Uint32Array) {
            bufferAttribute = new Uint32BufferAttribute(array, itemSize, false);
            bufferAttribute.gpuType = IntType;
        } else if (array instanceof Int8Array) {
            bufferAttribute = new Int8BufferAttribute(array, itemSize, false);
            bufferAttribute.gpuType = IntType;
        } else if (array instanceof Int16Array) {
            bufferAttribute = new Int16BufferAttribute(array, itemSize, false);
            bufferAttribute.gpuType = IntType;
        } else if (array instanceof Int32Array) {
            bufferAttribute = new Int32BufferAttribute(array, itemSize, false);
            bufferAttribute.gpuType = IntType;
        } else if (array instanceof Float32Array) {
            bufferAttribute = new Float32BufferAttribute(array, itemSize, false);
            bufferAttribute.gpuType = FloatType;
        } else if (array instanceof Float64Array) {
            bufferAttribute = new Float32BufferAttribute(new Float32Array(array), itemSize, false);
            bufferAttribute.gpuType = FloatType;
        } else {
            throw new Error('invalid array type');
        }

        geometry.setAttribute(targetAttribute, bufferAttribute);
    }

    public updateMaterial(material: PointCloudMaterial): void {
        material.size = this._parameters.pointSize;
        material.colorMap = this._parameters.pointCloudColorMap;
        material.classifications = this._parameters.classifications;
        material.mode = this._parameters.pointCloudMode;

        material.brightness = this._parameters.colorimetry.brightness;
        material.contrast = this._parameters.colorimetry.contrast;
        material.saturation = this._parameters.colorimetry.saturation;

        if (this._parameters.overlayColor != null) {
            material.overlayColor = new Vector4(
                this._parameters.overlayColor.r,
                this._parameters.overlayColor.g,
                this._parameters.overlayColor.b,
                1,
            );
        } else {
            material.overlayColor = new Vector4(0, 0, 0, 0);
        }

        material.updateUniforms();
    }

    public processTileModel(scene: PNTSScene, tile: Tile): void {
        if (isPNTSScene(scene)) {
            const batchTable = scene.batchTable;

            const mapping = this._parameters.attributeMapping;

            this.processBufferAttribute(
                scene.geometry,
                batchTable,
                mapping['intensity'],
                'intensity',
            );
            this.processBufferAttribute(
                scene.geometry,
                batchTable,
                mapping['classification'],
                'classification',
            );

            const material = new PointCloudMaterial({ mode: this._parameters.pointCloudMode });
            scene.material = material;

            material.setupFromGeometry(scene.geometry);

            this.updateMaterial(material);

            // For compatibility with point-cloud post processing
            enablePointCloudPostProcessing(scene);

            if (scene.geometry.boundingBox == null) {
                scene.geometry.computeBoundingBox();
            }

            // Let's make this point cloud compatible with the LayerNode
            // interface so that it can receive coloring from a color layer.
            // Normally, we would be using a PointCloud mesh type, but we cannot
            // change the type of the mesh here since the plugin cannot return
            // any value, so we will be patching the default Points mesh instead.

            // @ts-expect-error scene is not a LayerNode
            const layerNode = scene as LayerNode;
            layerNode.lod = tile.__depth;

            // Let's compute a texture size from the point density.
            // We asssume that the point density is homogenous and that the shape
            // is rougly cube-shaped so that we can assign the same size in both dimensions.
            const pointCount = scene.geometry.getAttribute('position').count;
            const pixels = MathUtils.clamp(Math.round(Math.sqrt(pointCount)), 32, 512);
            layerNode.textureSize = new Vector2(pixels, pixels);

            // This optimization mechanism does not apply to point clouds
            layerNode.canProcessColorLayer = (): boolean => true;

            // We will handle manually the disposal of nodes, without
            // letting the layer listening to the dispose event.
            layerNode.disposed = false;

            // The local bounding box that will be later used to compute the world space
            // bounding box and eventually the extent provided by getExtent().
            layerNode.userData.boundingBox = scene.geometry.boundingBox;

            layerNode.getExtent = (): Extent => {
                // Note that this extent must be computed once the object
                // has been added to the hierarchy (since we need the world matrix),
                // so we cannot do that here.
                return layerNode.userData.extent as Extent;
            };
        }
    }
}
