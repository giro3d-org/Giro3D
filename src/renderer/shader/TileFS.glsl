#include <giro3d_precision_qualifiers>
#include <giro3d_fragment_shader_header>
#include <giro3d_common>

#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
#include <fog_pars_fragment>

/**
 * Map tile fragment shader.
 */

/**
 * Rendering states are modes that change the kind of data that the fragment shader outputs.
 * - FINAL : the FS outputs the regular object's color and aspect. This is the default.
 * - PICKING : the FS outputs (ID, Z, U, V) as Float32 color
 */
const int STATE_FINAL = 0;
const int STATE_PICKING = 1;

varying vec2        vUv; // The input UV
varying vec3        wPosition; // The input world position
varying vec3        vViewPosition;

uniform int         renderingState; // Current rendering state (default is STATE_FINAL)
uniform int         uuid;           // The ID of the tile mesh (used for the STATE_PICKING rendering state)

uniform float       opacity;        // The entire map opacity
uniform vec4        backgroundColor; // The background color
uniform vec3        brightnessContrastSaturation; // Brightness/contrast/saturation for the entire map

#include <giro3d_colormap_pars_fragment>
#include <giro3d_outline_pars_fragment>
#include <giro3d_graticule_pars_fragment>
#include <giro3d_compose_layers_pars_fragment>
#include <giro3d_contour_line_pars_fragment>

#if defined(ENABLE_ELEVATION_RANGE)
uniform vec2        elevationRange; // Optional elevation range for the whole tile. Not to be confused with elevation range per layer.
#endif

#if defined(ENABLE_HILLSHADING)
uniform Hillshading hillshading;
#endif

uniform vec2        tileDimensions; // The dimensions of the tile, in CRS units

#if defined(ELEVATION_LAYER)
uniform sampler2D   elevationTexture;
uniform LayerInfo   elevationLayer;
uniform ColorMap    elevationColorMap;  // The elevation layer's optional color map
#endif

void applyHillshading(float hillshade) {
    // Hillshading expects an sRGB color space, so we have to convert the color
    // temporarily to sRGB, then back to sRGB-linear. Otherwise the result
    // looks washed out and lacks contrast.
    gl_FragColor = sRGBTransferOETF(gl_FragColor);
    gl_FragColor.rgb *= hillshade;
    gl_FragColor = sRGBToLinear(gl_FragColor);
}

void main() {
    #include <clipping_planes_fragment>

    // Step 0 : discard fragment in trivial cases of transparency
    if (opacity == 0.) {
        discard;
    }

    float height = 0.;

#if defined(ELEVATION_LAYER)
    vec2 elevUv = computeUv(vUv, elevationLayer.offsetScale.xy, elevationLayer.offsetScale.zw);
    height = getElevation(elevationTexture, elevUv);
#endif

#if defined(ENABLE_ELEVATION_RANGE)
    if (clamp(height, elevationRange.x, elevationRange.y) != height) {
        discard;
    }
#endif

    // Step 1 : discard fragment if the elevation texture is transparent
#if defined(DISCARD_NODATA_ELEVATION)
#if defined(ELEVATION_LAYER)
    // Let's discard transparent pixels in the elevation texture
    // Important note : if there is no elevation texture, all fragments are discarded
    // because the default value for texture pixels is zero.
    if (isNoData(elevationTexture, elevUv)) {
        discard;
    }
#else
    // No elevation layer present, discard completely.
    discard;
#endif
#endif

    // Step 2 : start with the background color
    gl_FragColor = backgroundColor;

#if defined(ELEVATION_LAYER)
    // Step 3 : if the elevation layer has a color map, use it as the background color.
    if (elevationColorMap.mode != COLORMAP_MODE_DISABLED) {
        vec4 rgba = computeColorMap(
            tileDimensions,
            elevationLayer,
            elevationTexture,
            elevationColorMap,
            colorMapAtlas,
            vUv);
        gl_FragColor = blend(rgba, gl_FragColor);
    }
#endif

    float hillshade = 1.;

#if defined(ELEVATION_LAYER)
    // Step 5 : compute shading
#if defined(ENABLE_HILLSHADING)
    hillshade = calcHillshade(
        tileDimensions,
        hillshading,
        elevationLayer.offsetScale,
        elevationTexture,
        elevUv
    );
#endif
#endif

// Shading can be applied either:
// - before the color layers (i.e only the background pixels will be shaded)
// - or after the color layers (i.e all pixels will be shaded).
#if defined(APPLY_SHADING_ON_COLORLAYERS)
#else
    applyHillshading(hillshade);
#endif

    // Step 4 : process all color layers (either directly sampling the atlas texture, or use a color map).
    // Note: this was originally an included chunk (giro3d_compose_layers_pars_fragment), but due to
    // the limitation described by https://github.com/mrdoob/three.js/issues/28020,
    // we have to inline the code so that it can be patched from the material.
#if VISIBLE_COLOR_LAYER_COUNT
    float maskOpacity = 1.;

    LayerInfo layer;
    ColorMap colorMap;
    vec4 rgba;
    vec4 blended;
    vec2 range;

    #pragma unroll_loop_start
    for ( int i = 0; i < COLOR_LAYERS_LOOP_END; i++ ) {
        layer = layers[UNROLLED_LOOP_INDEX];
        if (layer.color.a > 0.) {
            colorMap = layersColorMaps[UNROLLED_LOOP_INDEX];

        // If we are using an atlas texture, then all color layers will get their pixels from this shared texture.
        #if defined(USE_ATLAS_TEXTURE)
            rgba = computeColorLayer(tileDimensions, atlasTexture, colorMapAtlas, layer, colorMap, vUv);
        // Otherwise each color layer will get their pixels from their own texture.
        #else
            // We have to unroll the loop because we are accessing an array of samplers without a constant index (i.e UNROLLED_LOOP_INDEX)
            rgba = computeColorLayer(tileDimensions, colorTextures[UNROLLED_LOOP_INDEX], colorMapAtlas, layer, colorMap, vUv);
        #endif

        // Let's blend the layer color to the composited color.
        #if defined(ENABLE_LAYER_MASKS)
            if (layer.mode == LAYER_MODE_MASK) {
                // Mask layers do not contribute to the composition color.
                // instead, they contribute to the overall opacity of the map.
                maskOpacity *= rgba.a;
                blended = gl_FragColor;
            } else if (layer.mode == LAYER_MODE_MASK_INVERTED) {
                maskOpacity *= (1. - rgba.a);
                blended = gl_FragColor;
            } else if (layer.mode == LAYER_MODE_NORMAL) {
                blended = applyBlending(rgba, gl_FragColor, layer.blendingMode);
            }
        #else
            blended = applyBlending(rgba, gl_FragColor, layer.blendingMode);
        #endif

#if defined(ENABLE_ELEVATION_RANGE)
            range = layer.elevationRange;
            if (clamp(height, range.x, range.y) == height) {
                gl_FragColor = blended;
            }
#else
            gl_FragColor = blended;
#endif
        }
    }
    #pragma unroll_loop_end

    gl_FragColor.a *= maskOpacity;
#endif

    if (gl_FragColor.a <= 0.0) {
        discard;
    }

#if defined(ELEVATION_LAYER)
    // Contour lines
    #include <giro3d_contour_line_fragment>
#endif

#if defined(APPLY_SHADING_ON_COLORLAYERS)
    applyHillshading(hillshade);
#endif

    gl_FragColor.a *= opacity;

    // Step 6 : apply backface processing.
    if (!gl_FrontFacing) {
        // Display the backside in a desaturated, darker tone, to give visual feedback that
        // we are, in fact, looking at the map from the "wrong" side.
        gl_FragColor.rgb = desaturate(gl_FragColor.rgb, 1.) * 0.5;
    }

    // Step 7 : draw tile outlines
    #include <giro3d_outline_fragment>

    #include <giro3d_graticule_fragment>

    #include <logdepthbuf_fragment>

    // Final step : process rendering states.
    if (gl_FragColor.a <= 0.) {
        // The fragment is transparent, discard it to short-circuit rendering state evaluation.
        discard;
    } else if (renderingState == STATE_FINAL) {
        gl_FragColor.rgb = adjustBrightnessContrastSaturation(gl_FragColor.rgb, brightnessContrastSaturation);
        #include <colorspace_fragment>
        #include <fog_fragment>
    } else if (renderingState == STATE_PICKING) {
        float id = float(uuid);
        float z = height;
        float u = vUv.x;
        float v = vUv.y;
        // Requires a float32 render target
        gl_FragColor = vec4(id, z, u, v);
    }
}
