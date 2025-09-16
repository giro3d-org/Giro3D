/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type Atmosphere from './Atmosphere';
import AxisGrid, {
    type TickOrigin as AxisGridOrigin,
    type Style as AxisGridStyle,
    type Ticks as AxisGridTicks,
    type Volume as AxisGridVolume,
} from './AxisGrid';
import Entity, { type EntityEventMap, type EntityUserData } from './Entity';
import Entity3D, { type Entity3DEventMap } from './Entity3D';
import FeatureCollection, { type MeshUserData } from './FeatureCollection';
import type Globe from './Globe';
import type {
    GlobeConstructorOptions,
    GlobeTerrainOptions,
    defaultGlobeSubdivisionStrategy,
} from './Globe';
import type Glow from './Glow';
import type Map from './Map';
import {
    DEFAULT_MAP_BACKGROUND_COLOR,
    DEFAULT_SUBDIVISION_THRESHOLD,
    allLayersLoadedSubdivisionStrategy,
    defaultMapSubdivisionStrategy,
    type LayerCompareFn,
    type MapConstructorOptions,
    type MapEventMap,
    type MapSubdivisionStrategy,
} from './Map';
import MapLightingOptions, { MapLightingMode } from './MapLightingOptions';
import OrientedImageCollection, {
    type ImageOrientation,
    type OrientedImageCollectionOptions,
    type OrientedImageCollectionPickResult,
    type OrientedImageCollectionSource,
    type OrientedImageSource,
} from './OrientedImageCollection';
import PointCloud, { PointCloudOptions, UnsupportedAttributeError } from './PointCloud';
import Shape, * as shape from './Shape';
import SphericalPanorama, * as sphericalPanorama from './SphericalPanorama';
import Tiles3D, {
    DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING,
    WellKnown3DTilesPointCloudAttributes,
    type PointCloudBatchTableAttributeMapping,
    type Tiles3DOptions,
    type Tiles3DPickResult,
} from './Tiles3D';

export {
    Atmosphere,
    AxisGrid,
    AxisGridOrigin,
    AxisGridStyle,
    AxisGridTicks,
    AxisGridVolume,
    DEFAULT_MAP_BACKGROUND_COLOR,
    DEFAULT_SUBDIVISION_THRESHOLD,
    DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING,
    Entity,
    Entity3D,
    Entity3DEventMap,
    EntityEventMap,
    EntityUserData,
    FeatureCollection,
    Globe,
    GlobeConstructorOptions,
    GlobeTerrainOptions,
    Glow,
    ImageOrientation,
    LayerCompareFn,
    Map,
    MapConstructorOptions,
    MapEventMap,
    MapLightingMode,
    MapLightingOptions,
    MapSubdivisionStrategy,
    MeshUserData,
    OrientedImageCollection,
    OrientedImageCollectionOptions,
    OrientedImageCollectionPickResult,
    OrientedImageCollectionSource,
    OrientedImageSource,
    PointCloud,
    PointCloudBatchTableAttributeMapping,
    PointCloudOptions,
    Shape,
    SphericalPanorama,
    Tiles3D,
    Tiles3DOptions,
    Tiles3DPickResult,
    UnsupportedAttributeError,
    WellKnown3DTilesPointCloudAttributes,
    allLayersLoadedSubdivisionStrategy,
    defaultGlobeSubdivisionStrategy,
    defaultMapSubdivisionStrategy,
    shape,
    sphericalPanorama,
};
