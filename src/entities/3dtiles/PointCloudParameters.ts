/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Color } from 'three';
import type ColorimetryOptions from '../../core/ColorimetryOptions';
import type ColorMap from '../../core/ColorMap';
import type { Classification, Mode } from '../../renderer/PointCloudMaterial';

export type WellKnown3DTilesPointCloudAttributes = 'intensity' | 'classification';

/**
 * Maps attribute names found in the batch table with well-known names expected by Giro3D
 * for generating point cloud geometries and shader uniform names.
 *
 * Keys are well-known attributes, and values are attribute names in the batch table.
 *
 * ```
 * const customMapping = {
 *  'classification': 'THE_CATEGORY_OF_POINTS',
 *  'intensity': 'MY_CUSTOM_INTENSITY_VALUE'
 * }
 * ```
 */
export type PointCloudBatchTableAttributeMapping = Record<
    WellKnown3DTilesPointCloudAttributes,
    string
>;

export const DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING: PointCloudBatchTableAttributeMapping = {
    classification: 'classification',
    intensity: 'intensity',
};

type PointCloudParameters = {
    colorimetry: ColorimetryOptions;
    pointSize: number;
    pointCloudMode: Mode;
    pointCloudColorMap: ColorMap;
    classifications: Classification[];
    overlayColor: Color | null;
    attributeMapping: PointCloudBatchTableAttributeMapping;
};

export default PointCloudParameters;
