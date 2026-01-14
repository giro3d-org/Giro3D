/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Options related to how *no-data* pixels are treated. No-data pixels are pixels that should be
 * ignored for processing or visualization.
 */
export default interface NoDataOptions {
    /**
     * Enables no-data replacement. The algorithm is similar to the
     * [GDALFillNodata()](https://gdal.org/api/gdal_alg.html#_CPPv414GDALFillNodata15GDALRasterBandH15GDALRasterBandHdiiPPc16GDALProgressFuncPv)
     * function in the GDAL library. The main difference is that the distance is in CRS units rather
     * than pixels.
     *
     * This algorithm replaces any no-data pixel by the nearest valid pixel color, within
     * {@link maxSearchDistance}. The alpha value of the replaced pixel is specified by
     * {@link alpha}. No-data pixels that are outside the distance are replaced by transparent
     * black.
     *
     * The main use cases are:
     * - Hole filling: any hole that is smaller than {@link maxSearchDistance} will be filled
     * with values at the edge of the hole. In this case {@link alpha} should be `1`. Typically
     * used for color and mask layers to remove small holes and other similar artifacts, or to
     * smooth irregular edges.
     * - Geometry smoothing. For elevation layers that contain no-data pixels, the geometry of the
     * map will show steep walls at the boundary between valid and no-data pixels. In this case, we
     * want to replace no-data pixels with nearest pixels while still making them transparent.
     * Typically used for elevation layers. In this case, {@link alpha} should be `0`, and
     * {@link maxSearchDistance} should be set to either a big value (far enough from the dataset's
     * edges), or `+Infinity`.
     */
    replaceNoData: boolean;
    /**
     * (only if {@link replaceNoData} is enabled) The maximum distance (in CRS units) to search in
     * all directions to find values to interpolate from.
     */
    maxSearchDistance?: number;
    /**
     * (only if {@link replaceNoData} is enabled) When a no-data pixel is replaced by a valid value,
     * its alpha channel is replaced by this value.
     */
    alpha?: number;
}
