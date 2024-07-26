#define M_PI    3.1415926535897932384626433832795

// Pixel formats
const int PIXEL_FORMAT_RGBA = 1023;
const int PIXEL_FORMAT_RG = 1030;

// Texture types
const int TEXTURE_TYPE_FLOAT = 1015;
const int TEXTURE_TYPE_UINT8 = 1009;

// Converts a RG / Float color into a RGBA / Unsigned byte color
vec4 convert_RG_Float_RGBA_UnsignedByte(const in vec4 color, const in float _precision, const in float offset) {
    float f = (color.r + offset) / _precision;

    vec4 result;

    // https://stackoverflow.com/a/12553149/2704779
    result.b = floor(f / 256.0 / 256.0);
    result.g = floor((f - result.b * 256.0 * 256.0) / 256.0);
    result.r = floor(f - result.b * 256.0 * 256.0 - result.g * 256.0);
    // now we have a vec3 with the 3 components in range [0..255]. Let's normalize it!
    result /= 255.0;
    result.a = color.g;

    return result;
}

struct Hillshading {
    float zenith;     // Zenith of sunlight, in degrees (0 - 90)
    float azimuth;    // Azimuth on sunlight, in degrees (0 - 360)
    float intensity;  // The global lighting intensity
    float zFactor;    // The factor to apply to slopes.
};

const int BLENDING_MODE_NONE = 0;
const int BLENDING_MODE_NORMAL = 1;
const int BLENDING_MODE_ADDITIVE = 2;
const int BLENDING_MODE_MULTIPLICATIVE = 3;

/**
 * Describe a color layer's attributes.
 */
struct LayerInfo {
    vec4        offsetScale; // The offset/scale tuple.
    vec4        color;       // Includes opacity/visible as alpha component
    vec2        textureSize; // The size, in pixels, of the atlas section mapping to this layer.
    int         mode;        // The layer mode (normal, mask)
    #if defined(ENABLE_ELEVATION_RANGE)
    vec2        elevationRange; // Optional elevation range for the layer. Any fragment above or below this range will be ignored.
    #endif
    vec3        brightnessContrastSaturation;
    int         blendingMode;
};

struct NoDataOptions {
    float       replacementAlpha;
    float       radius;
    bool        enabled;
};

float linearTransfer(float v) {
    return (v < 0.04045) ? v * 0.0773993808 : pow(v * 0.9478672986 + 0.0521327014, 2.4);
}

vec4 sRGBToLinear( in vec4 srgb ) {
    float r = linearTransfer(srgb.r);
    float g = linearTransfer(srgb.g);
    float b = linearTransfer(srgb.b);
    return vec4(r, g, b, srgb.a);
}

float getElevationAlpha(vec4 c) {
    // Elevation textures are in the RG Format, so the transparency/no-data
    // information is actually in the green channel rather than the alpha channel.
    return c.g;
}

/**
 * Returns the elevation value at the specified coordinate, or the default value if the pixel is transparent (no-data).
 */
float getElevationOrDefault(sampler2D tex, vec2 uv, float defaultValue) {
    vec4 c = texture2D(tex, uv);
    float alpha = getElevationAlpha(c);
    if (alpha == 0.0) {
        return defaultValue;
    }
    return c.r;
}

bool isNoData(sampler2D tex, vec2 uv) {
    float alpha = getElevationAlpha(texture2D(tex, uv));
    if (abs(alpha) < 0.001) {
        return true;
    }

    return false;
}

float getElevation(sampler2D tex, vec2 uv) {
    vec4 c = texture2D(tex, uv);
    return c.r;
}

vec4 blend(vec4 fore, vec4 back) {
    if (fore.a == 0. && back.a == 0.) {
        return vec4(0);
    }
    float alpha = fore.a + back.a * (1.0 - fore.a);
    vec3 color = (fore.rgb * fore.a) + back.rgb * (back.a * (1.0 - fore.a)) / alpha;

    return vec4(color, alpha);
}

vec4 applyBlending(vec4 fore, vec4 back, int blendingMode) {
    if (blendingMode == BLENDING_MODE_NORMAL) {
        return blend(fore, back);
    } else if (blendingMode == BLENDING_MODE_ADDITIVE) {
        vec3 rgb = clamp((fore.rgb * fore.a) + (back.rgb * back.a), 0.0, 1.0);
        return vec4(rgb, 1.0);
    } else if (blendingMode == BLENDING_MODE_MULTIPLICATIVE) {
        vec3 rgb = clamp(fore.rgb * back.rgb, 0.0, 1.0);
        return vec4(rgb, 1.0);
    } else {
        return fore;
    }
}

vec3 desaturate(vec3 color, float factor) {
    vec3 lum = vec3(0.299, 0.587, 0.114);
    vec3 gray = vec3(dot(lum, color));
    return mix(color, gray, factor);
}

// This version of atan is numerically stable around zero
// See https://stackoverflow.com/a/27228836
// This is used to circumvent a bug on Mac devices where this computation would produce visual artifacts.
float atan2(in float y, in float x) {
    return x == 0.0 ? sign(y) * M_PI / 2. : atan(y, x);
}

vec2 computeElevationDerivatives(vec2 dimensions, vec2 uv, sampler2D tex, float elevationFactor, vec4 offsetScale) {
    ivec2 texSize = textureSize(tex, 0);
    // Compute pixel dimensions, in normalized coordinates.
    // Since textures are not necessarily square, we must compute both width and height separately.
    float width = 1.0 / float(texSize.x);
    float height = 1.0 / float(texSize.y);

    // Now compute the elevations for the 8 neigbouring pixels
    // +---+---+---+
    // | a | b | c |
    // +---+---+---+
    // | d | e | f |
    // +---+---+---+
    // | g | h | i |
    // +---+---+---+
    // Note: 'e' is the center of the sample. We don't use it for derivative computation.
    float a = elevationFactor * getElevation(tex, uv + vec2(-width, height));
    float b = elevationFactor * getElevation(tex, uv + vec2( 0.0, height));
    float c = elevationFactor * getElevation(tex, uv + vec2( width, height));
    float d = elevationFactor * getElevation(tex, uv + vec2(-width, 0.0));
    float f = elevationFactor * getElevation(tex, uv + vec2( width, 0.0));
    float g = elevationFactor * getElevation(tex, uv + vec2(-width, -height));
    float h = elevationFactor * getElevation(tex, uv + vec2( 0.0, -height));
    float i = elevationFactor * getElevation(tex, uv + vec2( width, -height));

    float cellWidth = dimensions.x / (offsetScale.z * float(texSize.x));
    float cellHeight = dimensions.y / (offsetScale.w * float(texSize.y));
    float dzdx = ((c + 2.0 * f + i) - (a + 2.0 * d + g)) / (8.0 * cellWidth);
    float dzdy = ((g + 2.0 * h + i) - (a + 2.0 * b + c)) / (8.0 * cellHeight);

    return vec2(dzdx, dzdy);
}

/**
 * Returns the slope given the derivatives (X and Y derivatives)
 */
float calcSlope( vec2 derivatives ) {
    // https://desktop.arcgis.com/en/arcmap/10.3/tools/spatial-analyst-toolbox/how-slope-works.htm
    return atan(sqrt(derivatives.x * derivatives.x + derivatives.y * derivatives.y)); // In radians
}

/**
 * Returns the aspect (azimuth from the light source)
 */
float calcAspect ( vec2 derivatives ) {
    // https://desktop.arcgis.com/en/arcmap/10.3/tools/spatial-analyst-toolbox/how-aspect-works.htm
    float aspect = atan2(derivatives.y, -derivatives.x);
    if(aspect < 0.0){
        aspect = M_PI * 0.5 - aspect;
    } else if (aspect > M_PI * 0.5) {
        aspect = 2.0 * M_PI - aspect + M_PI * 0.5;
    } else {
        aspect = M_PI * 0.5 - aspect;
    }
    return aspect; // In radians
}

/**
 * Linear map between [min1, max1] and [min2, max2]
 */
float map(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

float calcHillshade(vec2 tileDimensions, Hillshading hillshading, vec4 offsetScale, sampler2D tex, vec2 uv){
    // https://desktop.arcgis.com/en/arcmap/10.3/tools/spatial-analyst-toolbox/how-hillshade-works.htm
    vec2 derivatives = computeElevationDerivatives(tileDimensions, uv, tex, hillshading.zFactor, offsetScale);
    float slope = calcSlope(derivatives);
    float aspect = calcAspect(derivatives);
    float zenith_rad = hillshading.zenith * M_PI / 180.0; // in radians
    float azimuth_rad = hillshading.azimuth * M_PI / 180.0; // in radians
    float hillshade = ((cos(zenith_rad) * cos(slope)) + (sin(zenith_rad) * sin(slope) * cos(azimuth_rad - aspect)));

    hillshade = clamp(hillshade, 0., 1.);

    return mix(1., hillshade, hillshading.intensity);
}

vec2 clamp01(vec2 uv) {
    return vec2(
        clamp(uv.x, 0., 1.),
        clamp(uv.y, 0., 1.));
}

vec2 computeUv(vec2 uv, vec2 offset, vec2 scale) {
    return vec2(
        uv.x * scale.x + offset.x,
        uv.y * scale.y + offset.y);
}

float squaredDistance(vec2 a, vec2 b) {
    vec2 c = a - b;
    return dot(c, c);
}

/**
 * Returns the value of the valid pixel closest to uv.
 */
vec4 getNearestPixel(sampler2D tex, vec2 uv, int alphaChannel, float radius, float alpha) {
    const int SAMPLES = 64;
    const float fSAMPLES = float(SAMPLES);

    vec4 result = vec4(0, 0, 0, 0);
    float nearest = 9999.;
    float sqRadius = radius * radius;

    // This brute force approach produces very good visual results, but is quite costly.
    // Collect all the samples, then use only the closest valid sample to the requested position.
    for(int x = 0; x < SAMPLES; ++x) {
        for(int y = 0; y < SAMPLES; ++y) {
            float u = float(x) / fSAMPLES;
            float v = float(y) / fSAMPLES;

            vec2 samplePosition = vec2(u, v);

            vec4 color = texture2D(tex, samplePosition);

            // Is it a valid sample ?
            if(color[alphaChannel] == 1.) {
                // We don't need the absolute distance, since we are only interested
                // in the closest point: we avoid a costly square root computation.
                float dist = squaredDistance(samplePosition, uv);

                if (dist < nearest && dist <= sqRadius) {
                    nearest = dist;
                    result.rgb = color.rgb;
                    result[alphaChannel] = alpha;
                }
            }
        }
    }

    return result;
}

/*
 * Sample the texture, filling no-data (transparent) pixels with neighbouring
 * valid pixels.
 * Note: a pixel is considered no-data if its alpha channel is less than 1.
 * This way, if a bilinear interpolation touches a no-data pixel, it's also considered no-data.
 */
vec4 texture2DFillNodata(sampler2D tex, vec2 uv, NoDataOptions options, int alphaChannel) {
    vec4 value = texture2D(tex, uv);

    // Due to how no-data is determined here, we don't support non 1-bit alpha.
    if(value[alphaChannel] == 1.) {
        return value;
    }

    return getNearestPixel(tex, uv, alphaChannel, options.radius, options.replacementAlpha);
}

const int INTERPRETATION_RAW = 0;
const int INTERPRETATION_SCALED = 2;
const int INTERPRETATION_COMPRESS_TO_8BIT = 3;

struct Interpretation {
    int mode;
    bool negateValues;
    float min; // only for INTERPRETATION_SCALED
    float max; // only for INTERPRETATION_SCALED
};

vec4 grayscaleToRGB(vec4 c, Interpretation interpretation) {
    if (interpretation.mode == INTERPRETATION_RAW) {
        return c.rrrg;
    }

    return c.rrra;
}

const int OUTPUT_MODE_COLOR = 0;
const int OUTPUT_MODE_ELEVATION = 1;

/**
 * Decodes the raw color according to the specified interpretation.
 */
vec4 decodeInterpretation(vec4 raw, Interpretation interpretation) {
    vec4 result = raw;
    if (interpretation.mode == INTERPRETATION_SCALED) {
        float min = interpretation.min;
        float max = interpretation.max;
        float scale = max - min;
        result = vec4(
            min + raw.r * scale,
            min + raw.g * scale,
            min + raw.b * scale,
            raw.a);
    } else if (interpretation.mode == INTERPRETATION_COMPRESS_TO_8BIT) {
        float min = interpretation.min;
        float max = interpretation.max;
        float scale = 1.0 / (max - min);
        vec3 srgb = vec3(
            (raw.r - min) * scale,
            (raw.g - min) * scale,
            (raw.b - min) * scale);

        result = sRGBToLinear(vec4(srgb, raw.a));
    }

    if (interpretation.negateValues) {
        // Note that we don't flip the alpha channel
        return vec4(-result.r, -result.g, -result.b, result.a);
    }

    return result;
}

/**
 * Describes a color map.
 * Color maps are a way to change the color of a texture by
 * mapping the pixel's grayscale color into a value of the lookup table (LUT).
 * The pixel color acts like a UV value, that is then scaled with the min/max values
 * and mapped to the LUT texture.
 * Note: due to limitations in GLSL, the actual LUT texture must be in a separate uniform.
 */
struct ColorMap {
    int         mode;
    float       min;
    float       max;
    float       offset; // The V offset in the color map atlas texture.
};

const int COLORMAP_MODE_DISABLED = 0;
const int COLORMAP_MODE_ELEVATION = 1;
const int COLORMAP_MODE_SLOPE = 2;
const int COLORMAP_MODE_ASPECT = 3;

vec4 sampleColorMap(in float t, in float min, in float max, in sampler2D lut, in float v) {
    t = clamp(t, min, max);
    t = map(t, min, max, 0., 1.);
    return texture2D(lut, vec2(t, v));
}

vec4 computeColorMap(
    vec2 tileDimensions,
    LayerInfo layer,
    sampler2D sampledTexture,
    ColorMap colorMap,
    sampler2D lut,
    vec2 rawUv
) {
    float value;

    vec2 uv = computeUv(rawUv, layer.offsetScale.xy, layer.offsetScale.zw);

    if (colorMap.mode == COLORMAP_MODE_ELEVATION) {
        value = getElevation(sampledTexture, uv);
    } else {
        vec2 derivatives = computeElevationDerivatives(tileDimensions, uv, sampledTexture, 1.0, layer.offsetScale);
        if (colorMap.mode == COLORMAP_MODE_SLOPE) {
            value = calcSlope(derivatives);
        } else if (colorMap.mode == COLORMAP_MODE_ASPECT) {
            value = calcAspect(derivatives);
        }
        value *= 180.0 / M_PI; // Convert radians to degrees
    }

    vec4 rgba = sampleColorMap(value, colorMap.min, colorMap.max, lut, colorMap.offset);
    float a = texture2D(sampledTexture, uv).a;
    return vec4(rgba.rgb, rgba.a * a);
}

vec3 adjustBrightnessContrastSaturation(
    vec3 rgb,
    vec3 brightnessContrastSaturation
) {
    rgb = (rgb - 0.5) * brightnessContrastSaturation.y + 0.5;
    rgb += brightnessContrastSaturation.x;

    float luminance = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(luminance), rgb, brightnessContrastSaturation.z);
}
