/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { get as getProjection } from 'ol/proj';

import type Extent from '../core/geographic/Extent';
import type ImageFormat from '../formats/ImageFormat';
import type { UrlImageSourceOptions } from './UrlImageSource';

import CoordinateSystem from '../core/geographic/CoordinateSystem';
import UrlImageSource from './UrlImageSource';

/**
 * Constructor options for {@link WmsSourceOptions}.
 */
export interface WmsSourceOptions extends Omit<UrlImageSourceOptions, 'urlTemplate' | 'crs'> {
    /**
     * The URL to the WMS service.
     */
    url: string;
    /**
     * The projection to use in GetMap requests.
     */
    projection: string;
    /**
     * The name of the WMS layer, or layers to use.
     */
    layer: string | string[];
    /**
     * The image format (e.g `image/png`).
     * @defaultValue 'image/png'
     */
    imageFormat?: string;
    /**
     * The optional no-data value.
     */
    noDataValue?: number;
    /**
     * The optional image decoder.
     * @defaultValue undefined
     */
    format?: ImageFormat;
    /**
     * The optional extent of the source. Not required, except for some performance optimizations.
     */
    extent?: Extent;
    /**
     * The list of WMS styles to use.
     * @defaultValue undefined
     */
    styles?: string[];
    /**
     * Additional params to pass to the WMS service.
     */
    params?: Record<string, unknown>;
    /**
     * The WMS version to use.
     * @defaultValue '1.3.0'
     */
    version?: '1.3.0' | '1.1.1';
    /**
     * Enable transparency on requests.
     * @defaultValue true
     */
    transparent?: boolean;
}

/**
 * Create a GetMap URL template from the provided WMS parameters.
 * @internal
 */
export function createGetMapTemplate(params: {
    url: string;
    layer: string | string[];
    projection: string;
    imageFormat?: string;
    transparent?: boolean;
    styles?: string[];
    params?: Record<string, unknown>;
    version?: '1.3.0' | '1.1.1';
}): string {
    const layerList = Array.isArray(params.layer) ? params.layer : [params.layer];
    const styleList = params.styles != null ? params.styles.join(',') : '';

    const version = params.version ?? '1.3.0';

    const url = new URL(params.url);
    url.searchParams.append('SERVICE', 'WMS');
    url.searchParams.append('VERSION', version);
    url.searchParams.append('REQUEST', 'GetMap');
    url.searchParams.append('LAYERS', layerList.join(','));
    url.searchParams.append('STYLES', styleList);

    switch (version) {
        case '1.1.1':
            {
                url.searchParams.append('SRS', params.projection);
                url.searchParams.append('BBOX', '{minx},{miny},{maxx},{maxy}');
            }
            break;
        case '1.3.0':
            {
                url.searchParams.append('CRS', params.projection);
                const proj = getProjection(params.projection);
                const axisOrder = proj?.getAxisOrientation();
                switch (axisOrder) {
                    case 'neu':
                        url.searchParams.append('BBOX', '{miny},{minx},{maxy},{maxx}');
                        break;
                    default:
                        url.searchParams.append('BBOX', '{minx},{miny},{maxx},{maxy}');
                        break;
                }
            }
            break;
    }

    url.searchParams.append('WIDTH', '{width}');
    url.searchParams.append('HEIGHT', '{height}');
    url.searchParams.append('FORMAT', params.imageFormat ?? 'image/png');

    const transparent = params.transparent ?? true;
    url.searchParams.append('TRANSPARENT', `${transparent}`);

    if (params.params != null) {
        for (const [key, value] of Object.entries(params.params)) {
            if (key != null && value != null) {
                url.searchParams.append(key, `${value}`);
            }
        }
    }

    return decodeURIComponent(url.toString());
}

/**
 * An image source that is backed by a one or more [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) layer(s).
 * Note: this is a convenient class that simplifies the usage of {@link UrlImageSource}.
 * ```js
 * const source = new WmsSource({
 *      url: 'http://example.com/wms',
 *      projection: 'EPSG:3857',
 *      layer: 'myLayer',
 *      imageFormat: 'image/png',
 * });
 * ```
 */
export default class WmsSource extends UrlImageSource {
    public readonly isWmsSource = true as const;
    public override readonly type: string = 'WmsSource' as const;

    private readonly _initialOptions: WmsSourceOptions;

    /**
     * Creates a {@link WmsSource} from the specified parameters.
     *
     * @param options - The options.
     */
    public constructor(options: WmsSourceOptions) {
        super({
            ...options,
            urlTemplate: createGetMapTemplate(options),
            crs: CoordinateSystem.get(options.projection),
        });
        this._initialOptions = options;
    }

    /**
     * Sets the `TIME` parameter of the tile requests, and refreshes the source.
     * If `date` is undefined, temporal requests are disabled.
     */
    public setTime(date?: Date): void {
        const options: WmsSourceOptions = {
            ...this._initialOptions,
            params: {
                ...this._initialOptions.params,
                TIME: date?.toISOString(),
            },
        };

        this.setUrlTemplate(createGetMapTemplate(options));
    }
}

export function isWmsSource(obj: unknown): obj is WmsSource {
    return (obj as WmsSource).isWmsSource === true;
}
