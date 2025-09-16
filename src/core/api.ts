/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type * as cache from './Cache';
import type ColorimetryOptions from './ColorimetryOptions';
import type ColorMap from './ColorMap';
import type ColorMapMode from './ColorMapMode';
import type Context from './Context';
import type ContourLineOptions from './ContourLineOptions';
import type Disposable from './Disposable';
import type ElevationProvider from './ElevationProvider';
import type ElevationRange from './ElevationRange';
import type ElevationSample from './ElevationSample';
import type * as features from './FeatureTypes';
import type * as geographic from './geographic/api';
import type GraticuleOptions from './GraticuleOptions';
import type Instance from './Instance';
import type {
    EntityEventPayload,
    FrameEventPayload,
    InstanceEvents,
    InstanceOptions,
    PickObjectsAtOptions,
} from './Instance';
import type * as layer from './layer/api';
import type MainLoop from './MainLoop';
import type { RenderingState } from './MainLoop';
import type MemoryUsage from './MemoryUsage';
import type { GetMemoryUsageContext, MemoryUsageReport } from './MemoryUsage';
import type OffsetScale from './OffsetScale';
import type OperationCounter from './OperationCounter';
import type { OperationCounterEvents } from './OperationCounter';
import type * as picking from './picking/api';
import type PointCloud from './PointCloud';
import type { PointCloudEventMap, PointCloudOptions } from './PointCloud';
import type Progress from './Progress';
import type Rect from './Rect';
import type TerrainOptions from './TerrainOptions';
import type { Vector2Array, Vector3Array, Vector4Array, VectorArray } from './VectorArray';

import { type aggregateElevationProviders } from './ElevationProvider';
import GetElevationOptions from './GetElevationOptions';
import GetElevationResult from './GetElevationResult';
import {
    DEFAULT_ENABLE_STITCHING,
    DEFAULT_ENABLE_TERRAIN,
    DEFAULT_MAP_SEGMENTS,
} from './TerrainOptions';

export {
    aggregateElevationProviders,
    cache,
    ColorimetryOptions,
    ColorMap,
    ColorMapMode,
    Context,
    ContourLineOptions,
    DEFAULT_ENABLE_STITCHING,
    DEFAULT_ENABLE_TERRAIN,
    DEFAULT_MAP_SEGMENTS,
    Disposable,
    ElevationProvider,
    ElevationRange,
    ElevationSample,
    EntityEventPayload,
    features,
    FrameEventPayload,
    geographic,
    GetElevationOptions,
    GetElevationResult,
    GetMemoryUsageContext,
    GraticuleOptions,
    Instance,
    InstanceEvents,
    InstanceOptions,
    layer,
    MainLoop,
    MemoryUsage,
    MemoryUsageReport,
    OffsetScale,
    OperationCounter,
    OperationCounterEvents,
    picking,
    PickObjectsAtOptions,
    PointCloud,
    PointCloudEventMap,
    PointCloudOptions,
    Progress,
    Rect,
    RenderingState,
    TerrainOptions,
    Vector2Array,
    Vector3Array,
    Vector4Array,
    VectorArray,
};
