import TileWMS from 'ol/source/TileWMS';
import type Extent from '../core/geographic/Extent';
import type ImageFormat from '../formats/ImageFormat';
import type { ImageSourceOptions } from './ImageSource';
import TiledImageSource from './TiledImageSource';

export interface WmsSourceOptions extends ImageSourceOptions {
    /**
     * The URL to the WMS service.
     */
    url: string;
    /**
     * The projection of the layer.
     */
    projection: string;
    /**
     * The name of the WMS layer, or layers to use.
     */
    layer: string | string[];
    /**
     * The image format (e.g `image/png`).
     */
    imageFormat: string;
    /**
     * The optional no-data value.
     */
    noDataValue?: number;
    /**
     * The optional image decoder.
     */
    format?: ImageFormat;
    /**
     * The optional extent of the source. If not provided, it will be computed from the source.
     */
    extent?: Extent;
    /**
     * Additional params to pass to the WMS service.
     */
    params?: Record<string, unknown>;
}

/**
 * An image source that is backed by a one or more [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) layer(s).
 * Note: this is a convenient class that simplifies the usage of {@link TiledImageSource}.
 * ```js
 * const source = new WmsSource({
 *      url: 'http://example.com/wms',
 *      projection: 'EPSG:3857',
 *      layer: 'myLayer',
 *      imageFormat: 'image/png',
 * });
 * ```
 */
export default class WmsSource extends TiledImageSource {
    /**
     * Creates a {@link WmsSource} from the specified parameters.
     *
     * @param options - The options.
     */
    constructor(options: WmsSourceOptions) {
        super({
            requestPriority: options.requestPriority,
            source: new TileWMS({
                url: options.url,
                projection: options.projection,
                params: {
                    ...options.params,
                    LAYERS: Array.isArray(options.layer) ? options.layer : [options.layer],
                    FORMAT: options.imageFormat,
                },
            }),
        });
    }
}
