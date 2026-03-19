/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import AggregateFeatureSource, { AggregateFeatureSourceOptions } from './AggregateFeatureSource';
import AggregateImageSource from './AggregateImageSource';
import AggregatePointCloudSource, {
    AggregatePointCloudSourceOptions,
} from './AggregatePointCloudSource';
import COPCSource, { COPCSourceOptions } from './COPCSource';
import {
    FeatureSource,
    FeatureSourceBase,
    FeatureSourceEventMap,
    GetFeatureRequest,
    GetFeatureResult,
} from './FeatureSource';
import FileFeatureSource, { FileFeatureSourceOptions } from './FileFeatureSource';
import GeoTIFFSource, {
    type ChannelMapping,
    type GeoTIFFCacheOptions,
    type GeoTIFFSourceOptions,
} from './GeoTIFFSource';
import ImageSource, {
    type CustomContainsFn,
    type GetImageOptions,
    type ImageResponse,
    type ImageResult,
    type ImageSourceEvents,
    type ImageSourceOptions,
} from './ImageSource';
import * as las from './las/api';
import LASSource, { LASSourceOptions } from './LASSource';
import {
    GetNodeDataOptions,
    PointCloudAttribute,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudNodeData,
    PointCloudSource,
    PointCloudSourceBase,
    PointCloudSourceEventMap,
} from './PointCloudSource';
import PotreeSource, { PotreeSourceOptions } from './PotreeSource';
import StaticFeatureSource, { StaticFeaturesSourceOptions } from './StaticFeatureSource';
import StaticImageSource, {
    type StaticImageSourceEvents,
    type StaticImageSourceOptions,
} from './StaticImageSource';
import StreamableFeatureSource, {
    StreamableFeatureSourceOptions,
    StreamableFeatureSourceQueryBuilder,
    StreamableFeatureSourceGetter,
    StreamableFeatureSourceLoadingStrategy,
    defaultLoadingStrategy,
    tiledLoadingStrategy,
    wfsBuilder,
    ogcApiFeaturesBuilder,
} from './StreamableFeatureSource';
import TiledImageSource, { type TiledImageSourceOptions } from './TiledImageSource';
import UrlImageSource, { type UrlImageSourceOptions } from './UrlImageSource';
import VectorSource, { type VectorSourceOptions } from './VectorSource';
import VectorTileSource, { type VectorTileSourceOptions } from './VectorTileSource';
import VideoSource, { type VideoSourceEvents, type VideoSourceOptions } from './VideoSource';
import WmsSource, { type WmsSourceOptions } from './WmsSource';
import WmtsSource, { type WmtsFromCapabilitiesOptions, type WmtsSourceOptions } from './WmtsSource';

/**
 * Data sources.
 */
export {
    AggregateImageSource,
    AggregateFeatureSource,
    AggregateFeatureSourceOptions,
    AggregatePointCloudSource,
    AggregatePointCloudSourceOptions,
    StreamableFeatureSourceGetter,
    StreamableFeatureSourceLoadingStrategy,
    ogcApiFeaturesBuilder,
    defaultLoadingStrategy,
    tiledLoadingStrategy,
    wfsBuilder,
    COPCSource,
    COPCSourceOptions,
    ChannelMapping,
    CustomContainsFn,
    FeatureSource,
    FeatureSourceBase,
    FeatureSourceEventMap,
    FileFeatureSource,
    FileFeatureSourceOptions,
    GeoTIFFCacheOptions,
    GeoTIFFSource,
    GeoTIFFSourceOptions,
    GetFeatureRequest,
    GetFeatureResult,
    GetImageOptions,
    GetNodeDataOptions,
    ImageResponse,
    ImageResult,
    ImageSource,
    ImageSourceEvents,
    ImageSourceOptions,
    LASSource,
    LASSourceOptions,
    PointCloudAttribute,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudNodeData,
    PointCloudSource,
    PointCloudSourceBase,
    PointCloudSourceEventMap,
    PotreeSource,
    PotreeSourceOptions,
    StaticFeatureSource,
    StaticFeaturesSourceOptions,
    StaticImageSource,
    StaticImageSourceEvents,
    StaticImageSourceOptions,
    StreamableFeatureSource,
    StreamableFeatureSourceOptions,
    StreamableFeatureSourceQueryBuilder,
    TiledImageSource,
    TiledImageSourceOptions,
    VectorSource,
    VectorSourceOptions,
    VectorTileSource,
    VectorTileSourceOptions,
    UrlImageSource,
    UrlImageSourceOptions,
    VideoSource,
    VideoSourceEvents,
    VideoSourceOptions,
    WmsSource,
    WmsSourceOptions,
    WmtsFromCapabilitiesOptions,
    WmtsSource,
    WmtsSourceOptions,
    las,
};
