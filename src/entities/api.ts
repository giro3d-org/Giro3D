/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type Atmosphere from './Atmosphere';
import type { AtmosphereOptions } from './Atmosphere';
import type DrapedFeatureCollection from './DrapedFeatureCollection';
import type {
    MapLike as DrapedFeatureCollectionMapLike,
    DrapedFeatureCollectionOptions,
} from './DrapedFeatureCollection';
import type Globe from './Globe';
import type { GlobeOptions, GlobeTerrainOptions, defaultGlobeSubdivisionStrategy } from './Globe';
import type Glow from './Glow';
import type { GlowOptions } from './Glow';
import type Map from './Map';

import AxisGrid, {
    type AxisGridOptions,
    type TickOrigin as AxisGridOrigin,
    type Style as AxisGridStyle,
    type Ticks as AxisGridTicks,
    type Volume as AxisGridVolume,
} from './AxisGrid';
import Entity, { type EntityEventMap, type EntityUserData } from './Entity';
import Entity3D, { type Entity3DEventMap, type Entity3DOptions } from './Entity3D';
import FeatureCollection, {
    type MeshUserData,
    type FeatureCollectionOptions,
} from './FeatureCollection';
import {
    DEFAULT_MAP_BACKGROUND_COLOR,
    DEFAULT_SUBDIVISION_THRESHOLD,
    allLayersLoadedSubdivisionStrategy,
    defaultMapSubdivisionStrategy,
    type LayerCompareFn,
    type MapOptions,
    type MapEventMap,
    type MapSubdivisionStrategy,
} from './Map';
import MapLightingOptions, { MapLightingMode } from './MapLightingOptions';
import OrientedImageCollection, {
    type OrientedImageCollectionOptions,
    type OrientedImageCollectionPickResult,
    type OrientedImageCollectionSource,
    type OrientedImageSource,
} from './OrientedImageCollection';
import OrientedPanoramaCollection, {
    type OrientedPanoramaCollectionOptions,
    type OrientedPanoramaCollectionPickResult,
    type OrientedPanoramaCollectionSource,
    type OrientedPanoramaSource,
} from './OrientedPanoramaCollection';
import PointCloud, {
    PointCloudOptions,
    UnsupportedAttributeError,
    ActiveAttribute,
    ActiveAttributeDefinition,
} from './PointCloud';
import Shape, { ShapeOptions, ShapeExportOptions, ShapeFontWeight, ShapePickResult } from './Shape';
import SphericalPanorama, { SphericalPanoramaOptions } from './SphericalPanorama';
import Tiles3D, {
    DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING,
    WellKnown3DTilesPointCloudAttributes,
    type PointCloudBatchTableAttributeMapping,
    type Tiles3DOptions,
    type Tiles3DPickResult,
} from './Tiles3D';

export {
    Atmosphere,
    AtmosphereOptions,
    AxisGrid,
    AxisGridOptions,
    ActiveAttribute,
    ActiveAttributeDefinition,
    AxisGridOrigin,
    AxisGridStyle,
    AxisGridTicks,
    AxisGridVolume,
    DEFAULT_MAP_BACKGROUND_COLOR,
    DEFAULT_SUBDIVISION_THRESHOLD,
    DEFAULT_TILES3D_POINTCLOUD_ATTRIBUTE_MAPPING,
    Entity,
    DrapedFeatureCollectionMapLike,
    Entity3D,
    Entity3DOptions,
    Entity3DEventMap,
    EntityEventMap,
    DrapedFeatureCollection,
    DrapedFeatureCollectionOptions,
    EntityUserData,
    FeatureCollection,
    FeatureCollectionOptions,
    Globe,
    GlobeOptions,
    GlobeTerrainOptions,
    Glow,
    GlowOptions,
    LayerCompareFn,
    Map,
    MapOptions,
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
    OrientedPanoramaCollection,
    OrientedPanoramaCollectionOptions,
    OrientedPanoramaCollectionPickResult,
    OrientedPanoramaCollectionSource,
    OrientedPanoramaSource,
    PointCloud,
    PointCloudBatchTableAttributeMapping,
    PointCloudOptions,
    Shape,
    ShapeOptions,
    ShapeExportOptions,
    ShapeFontWeight,
    ShapePickResult,
    SphericalPanorama,
    SphericalPanoramaOptions,
    Tiles3D,
    Tiles3DOptions,
    Tiles3DPickResult,
    UnsupportedAttributeError,
    WellKnown3DTilesPointCloudAttributes,
    allLayersLoadedSubdivisionStrategy,
    defaultGlobeSubdivisionStrategy,
    defaultMapSubdivisionStrategy,
};
