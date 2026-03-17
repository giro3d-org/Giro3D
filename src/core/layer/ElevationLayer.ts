/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { PixelFormat, Texture, TextureDataType } from 'three';

import { FloatType, NoColorSpace, RGFormat } from 'three';

import type TileMesh from '../../entities/tiles/TileMesh';
import type ElevationRange from '../ElevationRange';
import type Extent from '../geographic/Extent';
import type { LayerEvents, LayerOptions, LayerUserData, Target, TextureAndPitch } from './Layer';

import { isFiniteNumber } from '../../utils/predicates';
import { nonNull } from '../../utils/tsutils';
import Layer from './Layer';

interface TextureWithMinMax extends Texture {
    min?: number;
    max?: number;
}

export interface ElevationLayerOptions extends LayerOptions {
    /**
     * The minimal/maximal elevation values of this layer.
     * If unspecified, the layer will attempt to compute an approximation using downsampled data.
     */
    minmax?: ElevationRange;
}

/**
 * A layer that provides elevation data to display terrains.
 */
export class ElevationLayer<UserData extends LayerUserData = LayerUserData> extends Layer<
    LayerEvents,
    UserData
> {
    public minmax: { min: number; max: number; isDefault?: boolean };
    /**
     * Read-only flag to check if a given object is of type ElevationLayer.
     */
    public readonly isElevationLayer: boolean = true;

    /**
     * Creates an elevation layer.
     * See the example for more information on layer creation.
     *
     * @param options - The layer options.
     */
    public constructor(options: ElevationLayerOptions) {
        super({
            ...options,
            noDataOptions: options.noDataOptions ?? {
                replaceNoData: false,
            },
            computeMinMax: options.computeMinMax ?? true,
            // If min/max is not provided, we *have* to preload images
            // to compute the min/max during preprocessing.
            preloadImages: options.preloadImages ?? options.minmax == null,
        });

        if (options.minmax) {
            this.minmax = options.minmax;
        } else {
            this.minmax = { min: 0, max: 0, isDefault: true };
        }
        this.type = 'ElevationLayer';
    }

    public getRenderTargetDataType(): TextureDataType {
        return FloatType;
    }

    public getRenderTargetPixelFormat(): PixelFormat {
        // Elevation textures need two channels:
        // - The elevation values
        // - A bitmask to indicate no-data values
        // The closest format that suits those needs is the RGFormat,
        // although we have to be aware that the bitmask is not located
        // in the alpha channel, but in the green channel.
        return RGFormat;
    }

    protected override adjustExtent(extent: Extent): Extent {
        // If we know the extent of the source/layer, we can additionally
        // crop the margin extent to ensure it does not overflow the layer extent.
        // This is necessary for elevation layers as they do not use an atlas.
        const thisExtent = this.getExtent();
        if (thisExtent && extent.intersectsExtent(thisExtent)) {
            extent.intersect(thisExtent);
        }

        return extent;
    }

    protected override async onInitialized(): Promise<void> {
        // Compute a min/max approximation using the background images that
        // are already present on the composer.
        if (this.minmax == null || this.minmax.isDefault === true) {
            const extent = nonNull(
                this.getExtent(),
                'neither this layer nor the source has an extent',
            );
            const { min, max } = nonNull(this._composer).getMinMax(extent);
            this.minmax = { min, max };
        }
    }

    public override unregisterNode(node: TileMesh): void {
        super.unregisterNode(node);

        node.removeElevationTexture();

        node.material.removeElevationLayer();
    }

    private getMinMax(texture: TextureWithMinMax): { min: number; max: number } {
        const min = isFiniteNumber(texture.min) ? texture.min : this.minmax.min;
        const max = isFiniteNumber(texture.max) ? texture.max : this.minmax.max;

        // Refine the min/max values using the new texture.
        this.minmax.min = Math.min(min, this.minmax.min);
        this.minmax.max = Math.max(max, this.minmax.max);

        return { min, max };
    }

    protected applyTextureToNode(textureAndPitch: TextureAndPitch, target: Target): void {
        const { texture, pitch } = textureAndPitch;
        const { min, max } = this.getMinMax(texture);

        const value = {
            texture,
            pitch,
            min,
            max,
        };

        const node = target.node as TileMesh;

        if (!node.material.hasElevationLayer(this)) {
            node.material.pushElevationLayer(this);
        }

        node.setElevationTexture(this, {
            ...value,
            renderTarget: nonNull(target.renderTarget).object,
        });
    }

    protected applyEmptyTextureToNode(target: Target): void {
        (target.node as TileMesh).removeElevationTexture();
    }

    protected override onTextureCreated(texture: Texture): void {
        // Elevation textures not being color textures, they must not be
        // subjected to colorspace transformations that would alter their values.
        // See https://threejs.org/docs/#manual/en/introduction/Color-management
        texture.colorSpace = NoColorSpace;
    }
}

/**
 * Returns `true` if the given object is a {@link ElevationLayer}.
 */
export function isElevationLayer(obj: unknown): obj is ElevationLayer {
    return typeof obj === 'object' && (obj as ElevationLayer)?.isElevationLayer;
}

export default ElevationLayer;
