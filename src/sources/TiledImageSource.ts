import { type Texture, UnsignedByteType, Vector2 } from 'three';
import { TileRange } from 'ol';
import type UrlTile from 'ol/source/UrlTile';
import type TileGrid from 'ol/tilegrid/TileGrid.js';
import type Projection from 'ol/proj/Projection';
import type Extent from '../core/geographic/Extent';
import OpenLayersUtils from '../utils/OpenLayersUtils';
import TextureGenerator from '../utils/TextureGenerator';
import ImageSource, {
    type GetImageOptions,
    ImageResult,
    type ImageSourceOptions,
} from './ImageSource';
import type ImageFormat from '../formats/ImageFormat';
import type { TileCoord } from 'ol/tilecoord';
import ConcurrentDownloader from './ConcurrentDownloader';
import { MemoryTracker } from '../renderer';
import EmptyTexture from '../renderer/EmptyTexture';

const MIN_LEVEL_THRESHOLD = 2;
const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

const tmp = {
    dims: new Vector2(),
    tileRange: new TileRange(0, 0, 0, 0),
};

export interface TiledImageSourceOptions extends ImageSourceOptions {
    /**
     * The underlying OpenLayers source.
     */
    source: UrlTile;
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
     * The optional HTTP request timeout, in milliseconds.
     *
     * @defaultValue 5000
     */
    httpTimeout?: number;
    /**
     * How many retries to execute when an HTTP request ends up in error.
     * @defaultValue 3
     */
    retries?: number;
}

/**
 * An image source powered by OpenLayers to load tiled images.
 * Supports all subclasses of the OpenLayers [TileSource](https://openlayers.org/en/latest/apidoc/module-ol_source_Tile-TileSource.html).
 *
 * If the tiles of the source are in a format that is not supported directly by the browser,
 * i.e not JPG/PNG/WebP, then you must pass a decoder with the `format` constructor option.
 *
 * To filter out no-data pixels, you may pass the `noDataValue` option in the constructor.
 *
 * @example
 *
 * // To create a source based on the Stamen OpenLayers source, with the 'toner' style.
 * const source = new TiledImageSource(\{
 *      source: new Stamen(\{ layer: 'toner' \})
 * \});
 *
 * // To create a WMS source that downloads TIFF images, eliminating all pixels that have the
 * // value -9999 and replacing them with transparent pixels.
 * const source = new TiledImageSource(\{
 *      source: new TileWMS(\{
 *          url: 'http://example.com/wms',
 *          params: \{
 *              LAYERS: 'theLayer',
 *              FORMAT: 'image/tiff',
 *          \},
 *          projection: 'EPSG:3946',
 *          crossOrigin: 'anonymous',
 *          version: '1.3.0',
 *      \}),
 *      format: new GeoTIFFFormat(),
 *      noDataValue: -9999,
 * \});
 */
export default class TiledImageSource extends ImageSource {
    readonly isTiledImageSource: boolean = true;
    readonly source: UrlTile;
    readonly format: ImageFormat;
    readonly olprojection: Projection;
    readonly noDataValue: number;
    private readonly _tileGrid: TileGrid;
    private readonly _getTileUrl: (coord: TileCoord, _: number, proj: Projection) => string;
    private readonly _sourceExtent: Extent;
    private readonly _downloader: ConcurrentDownloader;

    /**
     * @param options - The options.
     */
    constructor(options: TiledImageSourceOptions) {
        super({
            ...options,
            flipY: options.flipY ?? options.format?.flipY ?? false,
            is8bit:
                options.is8bit ??
                (options.format?.dataType ?? UnsignedByteType) === UnsignedByteType,
        });

        this.isTiledImageSource = true;
        this.type = 'TiledImageSource';

        this.source = options.source;
        this.format = options.format;
        this._downloader = new ConcurrentDownloader({
            retry: options.retries ?? DEFAULT_RETRIES,
            timeout: options.httpTimeout ?? DEFAULT_TIMEOUT,
        });

        const projection = this.source.getProjection();
        this.olprojection = projection;
        const tileGrid: TileGrid = this.source.getTileGridForProjection(projection);
        // Cache the tilegrid because it is constant
        this._tileGrid = tileGrid;
        this._getTileUrl = this.source.getTileUrlFunction();
        this.noDataValue = options.noDataValue;
        this._sourceExtent =
            options.extent ??
            OpenLayersUtils.fromOLExtent(tileGrid.getExtent(), projection.getCode());
    }

    getExtent() {
        return this._sourceExtent;
    }

    getCrs() {
        return this.olprojection.getCode();
    }

    adjustExtentAndPixelSize(
        requestExtent: Extent,
        requestWidth: number,
        requestHeight: number,
        margin = 0,
    ): { extent: Extent; width: number; height: number } {
        const size = Math.min(requestWidth, requestHeight);
        const zoom = this.getZoomLevel(requestExtent, size);

        const resolution = this._tileGrid.getResolution(zoom);

        const pixelWidth = resolution;
        const pixelHeight = resolution;

        const marginExtent = requestExtent
            .withMargin(pixelWidth * margin, pixelHeight * margin)
            .intersect(this._sourceExtent);

        const dimensions = marginExtent.dimensions(tmp.dims);
        const width = Math.round(dimensions.x / pixelWidth);
        const height = Math.round(dimensions.y / pixelHeight);

        return {
            extent: marginExtent,
            width,
            height,
        };
    }

    /**
     * Selects the best zoom level given the provided image size and extent.
     *
     * @param extent - The target extent.
     * @param size - The size in pixels of the target extent.
     * @returns The ideal zoom level for this particular extent.
     */
    private getZoomLevel(extent: Extent, size: number): number {
        const minZoom = this._tileGrid.getMinZoom();
        const maxZoom = this._tileGrid.getMaxZoom();

        function round1000000(n: number) {
            return Math.round(n * 1000000) / 1000000;
        }

        const dims = extent.dimensions(tmp.dims);
        const targetResolution = round1000000(dims.x / size);
        const minResolution = this._tileGrid.getResolution(minZoom);

        if (targetResolution / minResolution > MIN_LEVEL_THRESHOLD) {
            // The minimum zoom level has more than twice the resolution
            // than requested. We cannot use this zoom level as it would
            // trigger too many tile requests to fill the extent.
            return null;
        }

        if (minZoom === maxZoom) {
            return minZoom;
        }

        if (targetResolution > minResolution) {
            return minZoom;
        }

        // Let's determine the best zoom level for the target tile.
        let distance = +Infinity;
        let result = minZoom;
        for (let z = minZoom; z <= maxZoom; z++) {
            const sourceResolution = round1000000(this._tileGrid.getResolution(z));

            const thisDistance = Math.abs(sourceResolution - targetResolution);
            if (thisDistance < distance) {
                distance = thisDistance;
                result = z;
            }
        }

        return result;
    }

    getImages(options: GetImageOptions) {
        const { extent, width, height, signal } = options;

        signal?.throwIfAborted();

        if (extent.crs() !== this.getCrs()) {
            throw new Error('invalid CRS');
        }

        const zoomLevel = this.getZoomLevel(extent, Math.min(width, height));
        if (zoomLevel == null) {
            return [];
        }
        const tileRange = this._tileGrid.getTileRangeForExtentAndZ(
            OpenLayersUtils.toOLExtent(extent),
            zoomLevel,
        );

        const images = this.loadTiles(
            tileRange,
            this.getCrs(),
            zoomLevel,
            options.createReadableTextures,
            signal,
        );

        return images;
    }

    private async fetchData(url: string, signal: AbortSignal) {
        try {
            const response = await this._downloader.fetch(url, { signal });

            // If the response is 204 No Content for example, we have nothing to do.
            // This happens when a tile request is valid, but points to a region with no data.
            // Note: we let the HTTP handler do the logging for us in case of 4XX errors.
            if (response.status !== 200) {
                return null;
            }

            const blob = await response.blob();

            return blob;
        } catch (e) {
            if (e?.name === 'AbortError') {
                throw e;
            }
            console.error(e);
            return null;
        }
    }

    /**
     * Loads the tile once and returns a reusable promise containing the tile texture.
     *
     * @param id - The id of the tile.
     * @param url - The URL of the tile.
     * @param extent - The extent of the tile.
     * @param createDataTexture - Create readable textures.
     * @returns The tile texture, or null if there is no data.
     */
    private async loadTile(
        id: string,
        url: string,
        extent: Extent,
        createDataTexture: boolean,
        signal: AbortSignal,
    ) {
        const blob = await this.fetchData(url, signal);

        if (!blob) {
            return new ImageResult({
                texture: new EmptyTexture(),
                extent,
                id,
            });
        }

        let texture: Texture;
        let min;
        let max;
        if (this.format) {
            let width: number;
            let height: number;
            if (this._tileGrid) {
                const tileSize = this._tileGrid.getTileSize(0);
                width = tileSize as number;
                height = tileSize as number;
            }
            const decoded = await this.format.decode(blob, {
                noDataValue: this.noDataValue,
                width,
                height,
            });

            texture = decoded.texture;
            min = decoded.min;
            max = decoded.max;
        } else {
            texture = await TextureGenerator.decodeBlob(blob, {
                createDataTexture,
                flipY: true,
            });
            texture.flipY = false;
        }
        texture.generateMipmaps = false;
        texture.name = 'TiledImageSource - tile';

        MemoryTracker.track(texture, texture.name);

        return new ImageResult({
            texture,
            extent,
            id,
            min,
            max,
        });
    }

    /**
     * Check if the tile actually intersect with the extent.
     *
     * @param extent - The extent to test.
     * @returns `true` if the tile must be processed, `false` otherwise.
     */
    private shouldLoad(extent: Extent): boolean {
        // Use the custom contain function if applicable
        if (this.containsFn) {
            return this.containsFn(extent);
        }

        const convertedExtent = extent.clone().as(this.getCrs());

        return convertedExtent.intersectsExtent(this._sourceExtent);
    }

    /**
     * Loads all tiles in the specified tile range.
     *
     * @param tileRange - The tile range.
     * @param crs - The CRS of the extent.
     * @param zoom - The zoom level.
     * @param createDataTexture - Creates readable textures.
     */
    private loadTiles(
        tileRange: TileRange,
        crs: string,
        zoom: number,
        createDataTexture: boolean,
        signal: AbortSignal,
    ) {
        const source = this.source;
        const tileGrid = this._tileGrid;

        const fullTileRange = tileGrid.getFullTileRange(zoom);

        const promises = [];

        for (let i = tileRange.minX; i <= tileRange.maxX; i++) {
            for (let j = tileRange.minY; j <= tileRange.maxY; j++) {
                if (!fullTileRange.containsXY(i, j)) {
                    continue;
                }
                const tile = source.getTile(zoom, i, j, undefined, undefined);
                const coord = tile.tileCoord;
                const olExtent = tileGrid.getTileCoordExtent(coord);
                const tileExtent = OpenLayersUtils.fromOLExtent(olExtent, crs);
                const id = `${coord[0]}-${coord[1]}-${coord[2]}`;
                // Don't bother loading tiles that are not in the layer
                if (this.shouldLoad(tileExtent)) {
                    const url = this._getTileUrl(coord, 1, this.olprojection);
                    const request = () =>
                        this.loadTile(id, url, tileExtent, createDataTexture, signal);
                    promises.push({ id, request });
                }
            }
        }

        return promises;
    }
}
