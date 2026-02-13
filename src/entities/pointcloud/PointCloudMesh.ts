/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
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

import type Disposable from '../../core/Disposable';
import type Extent from '../../core/geographic/Extent';
import type PointCloudMaterial from '../../renderer/PointCloudMaterial';

import { enablePointCloudPostProcessing } from '../../renderer/RenderPipeline';
import { nonNull } from '../../utils/tsutils';

export interface PointCloudEventMap extends Object3DEventMap {
    'visibility-changed': unknown;
    dispose: unknown;
}

/** Options for constructing {@link PointCloudMesh} */
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
class PointCloudMesh<M extends PointCloudMaterial = PointCloudMaterial>
    extends Points<BufferGeometry, M>
    implements EventDispatcher<PointCloudEventMap>, Disposable
{
    public readonly isPointCloud: boolean = true;
    public override readonly type = 'PointCloud';

    public extent?: Extent;
    public textureSize: Vector2;
    public disposed: boolean;

    public static isPointCloud(obj: unknown): obj is PointCloudMesh {
        return (obj as PointCloudMesh)?.isPointCloud;
    }

    public get lod(): number {
        if (PointCloudMesh.isPointCloud(this.parent)) {
            return this.parent.lod + 1;
        } else {
            return 0;
        }
    }

    public constructor(opts: PointCloudOptions<M>) {
        super(opts.geometry, opts.material);

        enablePointCloudPostProcessing(this);

        this.extent = opts.extent ?? undefined;
        this.textureSize = opts.textureSize;
        this.disposed = false;
    }

    public canProcessColorLayer(): boolean {
        return true;
    }

    public getExtent(): Extent {
        return nonNull(this.extent);
    }

    public dispose(): void {
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

export { PointCloudMesh };
