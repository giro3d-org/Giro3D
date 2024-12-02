import type Feature from 'ol/Feature';
import type { Color, ColorRepresentation, Material, SpriteMaterial, Texture } from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

function isColor(o: unknown): o is Color {
    return (o as Color)?.isColor ?? false;
}

function hasUUID(obj: unknown): obj is { uuid: string } {
    if (obj == null) {
        return false;
    }
    if (typeof obj !== 'object') {
        return false;
    }
    return 'uuid' in obj && typeof obj.uuid === 'string';
}

/**
 * The units used to define line width. If `"pixels"`, the line has a constant width expressed in
 * pixels. If `"world"`, the line has a variable apparent width expressed in CRS units, depending on
 * the distance from the camera to the line.
 */
export type LineWidthUnit = 'pixels' | 'world';

export const DEFAULT_POINT_COLOR = 'white';
/**
 * The default point size, in pixels.
 */
export const DEFAULT_POINT_SIZE = 64;

export const DEFAULT_LINE_COLOR = '#4d69bf';
export const DEFAULT_LINE_WIDTH = 1;
export const DEFAULT_LINE_WIDTH_UNITS: LineWidthUnit = 'pixels';

export const DEFAULT_SURFACE_COLOR = '#87c6fa';

export type BaseStyle = {
    /**
     * The opacity of the style.
     * @defaultValue 1
     */
    opacity?: number;
    /**
     * Determine if [depth test](https://threejs.org/docs/#api/en/materials/Material.depthTest) is enabled.
     */
    depthTest?: boolean;
    /**
     * The [render order](https://threejs.org/docs/?q=objec#api/en/core/Object3D.renderOrder) of objects with this style.
     *
     * Note: this value is **relative** to the host entity's own render order. For example, if a feature
     * has a render order of 3, and the entity has a render order of 10, then the actual render order
     * of the displayed mesh will be 13.
     */
    renderOrder?: number;
};

/**
 * Fill style for vector features.
 */
export type FillStyle = BaseStyle & {
    /**
     * The fill color.
     * @defaultValue {@link DEFAULT_SURFACE_COLOR}
     */
    color?: ColorRepresentation;
};

/**
 * Stroke style for vector features.
 */
export type StrokeStyle = BaseStyle & {
    /**
     * The color of the line.
     * @defaultValue {@link DEFAULT_LINE_COLOR}
     */
    color?: ColorRepresentation;
    /**
     * The line width. If {@link lineWidthUnits} is `world`, the width is expressed in CRS units
     * (typically meters). Otherwise the line width is expressed in pixels.
     * @defaultValue {@link DEFAULT_LINE_WIDTH}
     */
    lineWidth?: number;
    /**
     * Specifies how the line width is interpreted.If `"pixels"`, the width is expressed in pixels,
     * and if `"world"`, the width is expressed in world units (typically meters).
     * @defaultValue {@link DEFAULT_LINE_WIDTH_UNITS}
     */
    lineWidthUnits?: LineWidthUnit;
};

/**
 * Point style for vector features.
 */
export type PointStyle = BaseStyle & {
    /**
     * The color of the point.
     * @defaultValue {@link DEFAULT_POINT_COLOR}
     */
    color?: ColorRepresentation;
    /**
     * The image to use for the point. May be either a THREE.js texture
     * or a URL to a remote image file.
     * @defaultValue `undefined`
     */
    image?: Texture | string | null;
    /**
     * The size of points, in pixels.
     * @defaultValue {@link DEFAULT_POINT_SIZE}
     */
    pointSize?: number;
    /**
     * If enabled, point size decreases with distance.
     * See the THREE.js [documentation](https://threejs.org/docs/?q=sprite#api/en/materials/SpriteMaterial.sizeAttenuation) for more information.
     * @defaultValue `false`
     */
    sizeAttenuation?: boolean;
};

/**
 * Returns a fill style where every property is defined, if necessary with default values.
 * @param style - The partial style to process. If undefined, the default style is returned.
 */
export function getFullFillStyle(style?: Partial<FillStyle>): Required<FillStyle> {
    const opacity = style?.opacity ?? 1;
    const color = style?.color ?? DEFAULT_SURFACE_COLOR;
    const depthTest = style?.depthTest ?? true;
    const renderOrder = style?.renderOrder ?? 0;

    return { opacity, color, depthTest, renderOrder };
}

/**
 * Returns a point style where every property is defined, if necessary with default values.
 * @param style - The partial style to process. If undefined, the default style is returned.
 */
export function getFullPointStyle(style?: Partial<PointStyle>): Required<PointStyle> {
    const opacity = style?.opacity ?? 1;
    const color = style?.color ?? DEFAULT_POINT_COLOR;
    const pointSize = style?.pointSize ?? DEFAULT_POINT_SIZE;
    const sizeAttenuation = style?.sizeAttenuation ?? false;
    // Contrary to lines and surface, it makes sense to disable depth test by
    // default for floating symbols.
    const depthTest = style?.depthTest ?? false;
    const image = style?.image ?? null;
    const renderOrder = style?.renderOrder ?? 0;

    return {
        opacity,
        color,
        sizeAttenuation,
        pointSize,
        depthTest,
        image,
        renderOrder,
    };
}

/**
 * Returns a stroke style where every property is defined, if necessary with default values.
 * @param style - The partial style to process. If undefined, then the default style is returned.
 */
export function getFullStrokeStyle(style?: Partial<StrokeStyle>): Required<StrokeStyle> {
    const color = style?.color ?? DEFAULT_LINE_COLOR;
    const lineWidth = style?.lineWidth ?? DEFAULT_LINE_WIDTH;
    const opacity = style?.opacity ?? 1;
    const lineWidthUnits = style?.lineWidthUnits ?? 'pixels';
    const depthTest = style?.depthTest ?? true;
    const renderOrder = style?.renderOrder ?? 0;

    return { color, lineWidth, opacity, lineWidthUnits, depthTest, renderOrder };
}

function hash(
    obj: boolean | string | number | Texture | Color | undefined | null,
): string | number {
    if (obj == null) {
        return 'undefined';
    }

    switch (typeof obj) {
        case 'string':
            return obj;
        case 'number':
            return obj;
        case 'boolean':
            return obj ? 'true' : 'false';
    }

    if (isColor(obj)) {
        return obj.getHexString();
    }
    if (hasUUID(obj)) {
        return obj.uuid;
    }

    throw new Error('unimplemented hashable type:' + typeof obj);
}

/**
 * Returns a string that uniquely identify this style.
 */
export function hashStyle(
    prefix: string,
    style: Required<PointStyle | StrokeStyle | FillStyle>,
): string {
    const items = [];
    for (const [k, v] of Object.entries(style)) {
        items.push(`${k}=${hash(v)}`);
    }

    return `${prefix}::${items.sort().join(',')}`;
}

export type FeatureStyle = {
    /**
     * The fill style to apply to `Polygon`s and `MultiPolygon`s geometries.
     */
    fill?: FillStyle;
    /**
     * The stroke style to apply to `LineString`s, `MultiLineString`s, `Polygon`s and `MultiPolygon`s.
     */
    stroke?: StrokeStyle;
    /**
     * The style to apply to `Point`s and `MultiPoint`s.
     */
    point?: PointStyle;
};

/**
 * This callback is called just after a source data has been converted to a THREE.js Mesh, to
 * style individual meshes from OpenLayers
 * [Feature](https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html)s.
 *
 * @param feature - the feature to style
 * @returns The style of the current feature
 */
export type FeatureStyleCallback = (feature: Feature) => FeatureStyle;

/**
 * This callback can be used to generate elevation for a given OpenLayer
 * [Feature](https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html) (typically from its properties).
 *
 * - If a single number is returned, it will be used for all vertices in the geometry.
 * - If an array is returned, each value will be used to determine the height of the corresponding vertex in the geometry.
 * Note that the cardinality of the array must be the same as the number of vertices in the geometry.
 */
export type FeatureElevationCallback = (feature: Feature) => Array<number> | number;

/**
 * Callback used to generate extrusion to [ol.Feature](https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html).
 *
 * If one number is returned, it will be used for all vertices. If an array is returned, its
 * cardinality must match the number of vertices and each value will be used for each vertex in
 * order.
 */
export type FeatureExtrusionOffsetCallback = (feature: Feature) => number | number[];

/**
 * Generator function for surfaces.
 */
export type SurfaceMaterialGenerator<
    S extends FillStyle = FillStyle,
    M extends Material = Material,
> = (style: Required<S>) => M;

/**
 * Generator function for lines.
 */
export type LineMaterialGenerator<
    S extends StrokeStyle = StrokeStyle,
    M extends LineMaterial = LineMaterial,
> = (style: Required<S>) => M;

/**
 * Generator function for points.
 */
export type PointMaterialGenerator<
    S extends PointStyle = PointStyle,
    M extends SpriteMaterial = SpriteMaterial,
> = (style: Required<S>) => M;
