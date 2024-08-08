import { type PixelFormat, type TextureDataType, RGBAFormat, FloatType } from 'three';
import { type Feature } from 'ol';
import Layer, {
    type LayerOptions,
    type LayerEvents,
    type LayerNode,
    type LayerNodeMaterial,
    type TextureAndPitch,
    type LayerUserData,
    type Target,
} from './Layer';
import type Coordinates from '../geographic/Coordinates';
import Extent from '../geographic/Extent';
import type ElevationRange from '../ElevationRange';
import { Mode as InterpretationMode } from './Interpretation';
import type VectorSource from '../../sources/VectorSource';
import type PickOptions from '../picking/PickOptions';
import { type MapPickResult } from '../picking/PickTilesAt';
import { type VectorPickFeature } from '../picking/PickResult';
import OpenLayersUtils from '../../utils/OpenLayersUtils';
import type PickableFeatures from '../picking/PickableFeatures';
import type ColorimetryOptions from '../ColorimetryOptions';
import { defaultColorimetryOptions } from '../ColorimetryOptions';

export interface ColorLayerEvents extends LayerEvents {
    /** When the layer opacity changes */
    'opacity-property-changed': { opacity: number };
    /** When the layer brightness changes */
    'brightness-property-changed': { brightness: number };
    /** When the layer contrast changes */
    'contrast-property-changed': { contrast: number };
    /** When the layer saturation changes */
    'saturation-property-changed': { saturation: number };
    /** When the layer elevationRange property changes */
    'elevationRange-property-changed': { range: ElevationRange };
}

export interface ColorLayerOptions extends LayerOptions {
    /**
     * An optional elevation range to limit the display of this layer.
     * This is only useful if there is also an elevation layer on the map.
     */
    elevationRange?: ElevationRange;
    /**
     * The opacity of the layer. Default is 1 (opaque).
     */
    opacity?: number;
}

/**
 * A layer that produces color images, such as vector data, or satellite imagery.
 */
class ColorLayer<UserData extends LayerUserData = LayerUserData>
    extends Layer<ColorLayerEvents, UserData>
    implements PickableFeatures<VectorPickFeature, MapPickResult<VectorPickFeature>>
{
    private _opacity: number;
    /**
     * Read-only flag to check if a given object is of type ColorLayer.
     */
    readonly isColorLayer: boolean = true;
    readonly isPickableFeatures = true;
    private _elevationRange: ElevationRange;
    private _colorimetry: ColorimetryOptions = defaultColorimetryOptions();

    /**
     * Creates a color layer.
     * See the example for more information on layer creation.
     *
     * @param options - The layer options.
     */
    constructor(options: ColorLayerOptions) {
        super(options);
        this.type = 'ColorLayer';
        this._elevationRange = options.elevationRange;
        this._opacity = options.opacity ?? 1;
    }

    /**
     * Gets the elevation range of this layer, if any.
     */
    get elevationRange(): ElevationRange {
        return this._elevationRange;
    }

    /**
     * Sets the elevation range of this layer. Setting it to null removes the elevation range.
     */
    set elevationRange(range: ElevationRange | null) {
        this._elevationRange = range;
        this.dispatchEvent({ type: 'elevationRange-property-changed', range });
    }

    /**
     * Gets or sets the opacity of this layer.
     */
    get opacity() {
        return this._opacity;
    }

    set opacity(v) {
        if (this._opacity !== v) {
            this._opacity = v;
            this.dispatchEvent({ type: 'opacity-property-changed', opacity: v });
        }
    }

    /**
     * Gets the colorimetry parameters of this layer.
     */
    get colorimetry() {
        return this._colorimetry;
    }

    /**
     * Gets or sets the brightness of this layer.
     */
    get brightness() {
        return this._colorimetry.brightness;
    }

    set brightness(v) {
        if (this._colorimetry.brightness !== v) {
            this._colorimetry.brightness = v;
            this.dispatchEvent({ type: 'brightness-property-changed', brightness: v });
        }
    }

    /**
     * Gets or sets the contrast of this layer.
     */
    get contrast() {
        return this._colorimetry.contrast;
    }

    set contrast(v) {
        if (this._colorimetry.contrast !== v) {
            this._colorimetry.contrast = v;
            this.dispatchEvent({ type: 'contrast-property-changed', contrast: v });
        }
    }

    /**
     * Gets or sets the saturation of this layer.
     */
    get saturation() {
        return this._colorimetry.saturation;
    }

    set saturation(v) {
        if (this._colorimetry.saturation !== v) {
            this._colorimetry.saturation = v;
            this.dispatchEvent({ type: 'saturation-property-changed', saturation: v });
        }
    }

    protected updateMaterial(material: LayerNodeMaterial) {
        if (material.hasColorLayer(this)) {
            // Update material parameters
            material.setLayerVisibility(this, this.visible);
            material.setLayerOpacity(this, this.opacity);
            material.setLayerElevationRange(this, this._elevationRange);
            material.setColorimetry(
                this,
                this._colorimetry.brightness,
                this._colorimetry.contrast,
                this._colorimetry.saturation,
            );
        }
    }

    getRenderTargetDataType(): TextureDataType {
        switch (this.interpretation.mode) {
            case InterpretationMode.ScaleToMinMax:
                return FloatType;
            default:
                return this.source.datatype;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    getRenderTargetPixelFormat(): PixelFormat {
        return RGBAFormat;
    }

    // eslint-disable-next-line class-methods-use-this
    protected canFetchImages(target: Target): boolean {
        return target.node.canProcessColorLayer();
    }

    unregisterNode(node: LayerNode) {
        super.unregisterNode(node);
        const material = node.material;
        if (material) {
            if (material.indexOfColorLayer(this) !== -1) {
                material.removeColorLayer(this);
            }
        }
    }

    protected applyTextureToNode(result: TextureAndPitch, target: Target) {
        const material = target.node.material;

        if (!material.hasColorLayer(this)) {
            material.pushColorLayer(this, target.extent);
        }

        target.node.material.setColorTextures(this, result);
    }

    protected applyEmptyTextureToNode(target: Target) {
        target.node.material.removeColorLayer(this);
    }

    pickFeaturesFrom(pickedResult: MapPickResult, options?: PickOptions): VectorPickFeature[] {
        const vectorOptions: any = {
            radius: options.radius ?? 0,
        };

        if (vectorOptions.radius > 0) {
            const tileExtent = pickedResult.object.extent.as(pickedResult.coord.crs).dimensions();
            vectorOptions.xTileRes = tileExtent.x / pickedResult.entity.imageSize.x;
            vectorOptions.yTileRes = tileExtent.y / pickedResult.entity.imageSize.y;
        }

        return this.getVectorFeaturesAtCoordinate(pickedResult.coord, vectorOptions).map(
            feature => ({
                isVectorPickFeature: true,
                layer: this,
                feature,
            }),
        );
    }

    /**
     * Returns all features at some coordinates, with an optional hit tolerance radius.
     *
     * @param coordinate - Coordinates
     * @param options - Options
     * @returns Array of features at coordinates (can be empty)
     */
    getVectorFeaturesAtCoordinate(
        coordinate: Coordinates,
        options?: {
            /**
             * Radius in pixels.
             * Pixels inside the radius around the given coordinates will be checked for features.
             */
            radius?: number;
            /** Tile resolution (m/px) - only required if radius is greater than 0 */
            xTileRes?: number;
            /** Tile resolution (m/px) - only required if radius is greater than 0 */
            yTileRes?: number;
        },
    ): Feature[] {
        const layerProjection = this.getExtent()?.crs();
        if (!layerProjection) return [];

        const radius = options?.radius ?? 0;

        if (radius > 0) {
            if (!Number.isFinite(options.xTileRes) || !Number.isFinite(options.yTileRes)) {
                console.warn(
                    'Calling getVectorFeaturesAtCoordinate with radius but no tile resolution, this will return nothing',
                );
                return [];
            }

            const results: Feature[] = [];
            const radiusSqr = radius ** 2;

            // First, define a square extent around the point
            // We might get more features than wanted, so we'll need to filter them afterwards.
            const e = new Extent(
                coordinate.crs,
                coordinate.x - options.xTileRes * radius,
                coordinate.x + options.xTileRes * radius,
                coordinate.y - options.yTileRes * radius,
                coordinate.y + options.yTileRes * radius,
            );
            const features = this.getVectorFeaturesInExtent(e);

            const coordinateLayer = coordinate.as(layerProjection);
            const coord = [coordinateLayer.x, coordinateLayer.y];
            for (const feat of features) {
                // Check the feature is really in the picking circle
                if (feat.getGeometry().intersectsCoordinate(coord)) {
                    results.push(feat);
                    continue;
                }

                const closestPoint = feat.getGeometry().getClosestPoint(coord);
                const distX = Math.abs(closestPoint[0] - coord[0]) / options.xTileRes;
                const distY = Math.abs(closestPoint[1] - coord[1]) / options.yTileRes;
                const distSqr = distX ** 2 + distY ** 2;
                if (distSqr <= radiusSqr) {
                    results.push(feat);
                    continue;
                }
            }
            return results;
        }

        if ((this.source as VectorSource).isVectorSource && this.visible) {
            const coordinateLayer = coordinate.as(layerProjection);
            const coord = [coordinateLayer.x, coordinateLayer.y];
            const olSource = (this.source as VectorSource).source;
            return olSource.getFeaturesAtCoordinate(coord);
        }

        return [];
    }

    /**
     * Get all features whose bounding box intersects the provided extent.
     * Note that this returns an array of all features intersecting the given extent in random order
     * (so it may include features whose geometries do not intersect the extent).
     *
     * @param extent - Extent
     * @returns Array of features intersecting the extent (can be empty)
     */
    getVectorFeaturesInExtent(extent: Extent): Feature[] {
        if ((this.source as VectorSource).isVectorSource && this.visible) {
            const layerProjection = this.getExtent()?.crs();
            if (!layerProjection) return [];

            const extentLayer = extent.as(layerProjection);
            const olExtent = OpenLayersUtils.toOLExtent(extentLayer);
            const olSource = (this.source as VectorSource).source;
            return olSource.getFeaturesInExtent(olExtent);
        }
        return [];
    }
}

/**
 * Returns `true` if the given object is a {@link ColorLayer}.
 */
export function isColorLayer(obj: unknown): obj is ColorLayer {
    return typeof obj === 'object' && (obj as ColorLayer)?.isColorLayer;
}

export default ColorLayer;
