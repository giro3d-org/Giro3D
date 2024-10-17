import { type Feature } from 'ol';
import { type Geometry } from 'ol/geom';
import { Texture, UnsignedByteType, type TextureDataType } from 'three';
import OffsetScale from '../OffsetScale';
import ColorLayer from './ColorLayer';
import type { LayerOptions, LayerUserData, Target } from './Layer';

/**
 * Modes of the mask layer.
 */
enum MaskMode {
    /**
     * The mask is applied normally: transparents parts of the mask make the map transparent.
     */
    Normal = 1,
    /**
     * The mask is inverted: transparents parts of the mask make the map opaque.
     */
    Inverted = 2,
}

const EMPTY_TEXTURE = new Texture();
const DEFAULT_PITCH = OffsetScale.identity();

export interface MaskLayerOptions extends LayerOptions {
    /**
     * How to interpret the mask.
     */
    maskMode?: MaskMode;
}

/**
 * A {@link ColorLayer} that can be used to mask parts of
 * a map. The source can be any source supported by the color layers.
 *
 */
class MaskLayer<UserData extends LayerUserData = LayerUserData> extends ColorLayer<UserData> {
    private _maskMode: MaskMode;
    /**
     * Read-only flag to check if a given object is of type MaskLayer.
     */
    readonly isMaskLayer: boolean = true;

    /**
     * Creates a mask layer.
     * It should be added in a `Map` to be displayed in the instance.
     * See the example for more information on layer creation.
     *
     * @param options - The layer options.
     */
    constructor(options: MaskLayerOptions) {
        super(options);
        this.isMaskLayer = true;
        this.type = 'MaskLayer';
        this._maskMode = options.maskMode ?? MaskMode.Normal;
    }

    /**
     * Gets or set the mask mode.
     */
    get maskMode() {
        return this._maskMode;
    }

    set maskMode(v) {
        this._maskMode = v;
    }

    override getRenderTargetDataType(): TextureDataType {
        return UnsignedByteType;
    }

    applyEmptyTextureToNode(target: Target) {
        const material = target.node.material;

        if (!material.hasColorLayer(this)) {
            material.pushColorLayer(this, target.extent);
        }

        // We cannot remove the layer from the material, contrary to what is done for
        // other layer types, because since this layer acts as a mask, it must be defined
        // for the entire map.
        material.setColorTextures(this, {
            texture: EMPTY_TEXTURE,
            pitch: DEFAULT_PITCH,
        });
    }

    override getVectorFeaturesAtCoordinate(): Feature<Geometry>[] {
        return [];
    }

    override getVectorFeaturesInExtent(): Feature<Geometry>[] {
        return [];
    }
}

function isMaskLayer(obj: unknown): obj is MaskLayer {
    return (obj as MaskLayer)?.isMaskLayer;
}

export default MaskLayer;

export { isMaskLayer, MaskMode };
