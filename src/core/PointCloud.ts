/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    Points,
    type BufferGeometry,
    type EventDispatcher,
    type Material,
    type Object3DEventMap,
    type Vector2,
} from 'three';
import type PointCloudMaterial from '../renderer/PointCloudMaterial';
import { enablePointCloudPostProcessing } from '../renderer/RenderPipeline';
import { nonNull } from '../utils/tsutils';
import type Disposable from './Disposable';
import type Extent from './geographic/Extent';

export interface PointCloudEventMap extends Object3DEventMap {
    'visibility-changed': unknown;
    dispose: unknown;
}

/** Options for constructing {@link PointCloud} */
export interface PointCloudOptions<M extends Material = Material> {
    /** Geometry */
    geometry: BufferGeometry;
    /** Material */
    material: M;
    /** Texture size */
    textureSize: Vector2;
    extent?: Extent;
}

/**
 * A point cloud object with geospatial properties.
 *
 */
class PointCloud<M extends PointCloudMaterial = PointCloudMaterial>
    extends Points<BufferGeometry, M>
    implements EventDispatcher<PointCloudEventMap>, Disposable
{
    readonly isPointCloud: boolean = true;
    override readonly type = 'PointCloud';

    extent?: Extent;
    textureSize: Vector2;
    disposed: boolean;

    static isPointCloud(obj: unknown): obj is PointCloud {
        return (obj as PointCloud)?.isPointCloud;
    }

    get lod(): number {
        if (PointCloud.isPointCloud(this.parent)) {
            return this.parent.lod + 1;
        } else {
            return 0;
        }
    }

    constructor(opts: PointCloudOptions<M>) {
        super(opts.geometry, opts.material);

        enablePointCloudPostProcessing(this);

        this.extent = opts.extent ?? undefined;
        this.textureSize = opts.textureSize;
        this.disposed = false;
    }

    private getPointValue(pointIndex: number, attribute: string): number | undefined {
        if (this.geometry.hasAttribute(attribute)) {
            const buffer = this.geometry.getAttribute(attribute).array;

            return buffer[pointIndex];
        }

        return undefined;
    }

    /**
     * Returns the intensity of the specified point.
     *
     * @param pointIndex - The index of the point.
     * @returns The intensity value for the specified point, or `undefined` if this point cloud does not support intensities.
     */
    getIntensity(pointIndex: number): number | undefined {
        return this.getPointValue(pointIndex, 'intensity');
    }

    /**
     * Returns the classification number of the specified point.
     *
     * @param pointIndex - The index of the point.
     * @returns The classification number for the specified point, or `undefined` if this point cloud does not support classifications.
     */
    getClassification(pointIndex: number): number | undefined {
        return this.getPointValue(pointIndex, 'classification');
    }

    canProcessColorLayer(): boolean {
        return true;
    }

    getExtent() {
        return nonNull(this.extent);
    }

    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        // @ts-expect-error Points does not transmit proper event map to parent
        this.dispatchEvent({ type: 'dispose' });
        this.geometry.dispose();
        this.material.dispose();
    }
}

export default PointCloud;
