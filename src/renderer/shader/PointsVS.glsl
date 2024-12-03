#include <giro3d_precision_qualifiers>
#include <giro3d_common>

#include <common>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#include <fog_pars_vertex>

#define EPSILON 1e-6

uniform float size;

uniform uint pickingId;
uniform int mode;
uniform float opacity;
uniform vec4 overlayColor;
attribute vec3 color;

struct PointCloudColorMap {
    float min;
    float max;
    sampler2D lut;
};

uniform PointCloudColorMap colorMap;

#if defined(INTENSITY)
// INTENSITY_TYPE is a define macro
attribute INTENSITY_TYPE intensity;
#endif

#if defined(CLASSIFICATION)
struct Classification {
    vec3 color;
    bool visible;
};

uniform Classification[256] classifications;
attribute uint classification;
#endif

#if defined(NORMAL_OCT16)
attribute vec2 oct16Normal;
#elif defined(NORMAL_SPHEREMAPPED)
attribute vec2 sphereMappedNormal;
#endif

uniform sampler2D overlayTexture;
uniform int decimation;
uniform float hasOverlayTexture;
uniform vec4 offsetScale;
uniform vec2 extentBottomLeft;
uniform vec2 extentSize;

varying vec4 vColor;

// see https://web.archive.org/web/20150303053317/http://lgdv.cs.fau.de/get/1602
// and implementation in PotreeConverter (BINPointReader.cpp) and potree (BinaryDecoderWorker.js)
#if defined(NORMAL_OCT16)
vec3 decodeOct16Normal(vec2 encodedNormal) {
    vec2 nNorm = 2. * (encodedNormal / 255.) - 1.;
    vec3 n;
    n.z = 1. - abs(nNorm.x) - abs(nNorm.y);
    if (n.z >= 0.) {
        n.x = nNorm.x;
        n.y = nNorm.y;
    } else {
        n.x = sign(nNorm.x) - sign(nNorm.x) * sign(nNorm.y) * nNorm.y;
        n.y = sign(nNorm.y) - sign(nNorm.y) * sign(nNorm.x) * nNorm.x;
    }
    return normalize(n);
}
#elif defined(NORMAL_SPHEREMAPPED)
// see http://aras-p.info/texts/CompactNormalStorage.html method #4
// or see potree's implementation in BINPointReader.cpp
vec3 decodeSphereMappedNormal(vec2 encodedNormal) {
    vec2 fenc = 2. * encodedNormal / 255. - 1.;
    float f = dot(fenc,fenc);
    float g = 2. * sqrt(1. - f);
    vec3 n;
    n.xy = fenc * g;
    n.z = 1. - 2. * f;
    return n;
}
#endif

#ifdef DEFORMATION_SUPPORT
uniform int enableDeformations;
struct Deformation {
    mat4 transformation;
    vec3 vec;
    vec2 origin;
    vec2 influence;
    vec4 colors;
};

uniform Deformation deformations[NUM_TRANSFO];
#endif

void main() {
    if (decimation > 1 && gl_VertexID % decimation != 0) {
        // Move the vertex out of the render area to prevent calling the fragment shader for
        // this point, saving a lot of GPU processing time when millions of points are displayed.
        gl_PointSize = 0.0;
        gl_Position = vec4(-9999.0, -9999.0, -9999.0, 0.0);
        return;
    }

#if defined(NORMAL_OCT16)
    vec3  normal = decodeOct16Normal(oct16Normal);
#elif defined(NORMAL_SPHEREMAPPED)
    vec3 normal = decodeSphereMappedNormal(sphereMappedNormal);
#elif defined(NORMAL)
    // nothing to do
#else
    // default to color
    vec3 normal = color;
#endif

    if (pickingId > uint(0)) {
        // In picking mode, we simply output the point id in the red channel and the object id in the green channel.
        // No need to encode them because we are rendering to a float texture.
        vColor = vec4(float(gl_VertexID), float(pickingId), 0, 1);
#if defined(INTENSITY)
    } else if (mode == MODE_INTENSITY) {
        vColor = sampleColorMap(float(intensity), colorMap.min, colorMap.max, colorMap.lut, 0.0);
        vColor.a *= opacity;
#endif
    } else if (mode == MODE_NORMAL) {
        vColor = vec4(abs(normal), opacity);
    } else if (mode == MODE_TEXTURE) {
        vec2 pp = (modelMatrix * vec4(position, 1.0)).xy;
        // offsetScale is from bottomleft
        pp.x -= extentBottomLeft.x;
        pp.y -= extentBottomLeft.y;
        pp *= offsetScale.zw / extentSize;
        pp += offsetScale.xy;
        vec3 textureColor = texture2D(overlayTexture, pp).rgb;
        vColor = vec4(mix(textureColor, overlayColor.rgb, overlayColor.a), opacity * hasOverlayTexture);
    } else if (mode == MODE_ELEVATION) {
        float z = (modelMatrix * vec4(position, 1.0)).z;
        vColor = sampleColorMap(z, colorMap.min, colorMap.max, colorMap.lut, 0.0);
        vColor.a *= opacity;
#if defined(CLASSIFICATION)
    } else if (mode == MODE_CLASSIFICATION) {
        Classification classif = classifications[classification];
        vColor.rgb = classif.color;
        vColor.a = classif.visible ? opacity : 0.0;
#endif
    } else {
        // default to color mode

        // We need to convert to linear color space because the colors are in sRGB and they
        // are not automatically converted to sRGB-linear. This is due to the fact that those
        // colors come from a vertex buffer and not from a texture (automatically converted)
        // or a single color uniform (also automatically converted).
        vec4 linear = sRGBToLinear(vec4(color, 1.0));
        vColor = vec4(mix(linear.rgb, overlayColor.rgb, overlayColor.a), opacity);
    }

    mat4 mvMatrix = modelViewMatrix;

    #ifdef DEFORMATION_SUPPORT
    if (!pickingMode) {
        vColor = enableDeformations > 0 ?
            vec4(0.0, 1.0, 1.0, 1.0):
            vec4(1.0, 0.0, 1.0, 1.0);
    }
    if (enableDeformations > 0) {
        vec4 mPosition = modelMatrix * vec4(position, 1.0);
        float minDistance = 1000.0;
        int bestChoice = -1;
        for (int i = 0; i < NUM_TRANSFO; i++) {
            if (i >= enableDeformations) {
                break;
            }
            vec2 v = deformations[i].vec.xy;
            float length = deformations[i].vec.z;
            float depassement_x =
                length * (deformations[i].influence.x - 1.0);

            vec2 diff = mPosition.xy - origin[i];
            float distance_x = dot(diff, v);

            if (-depassement_x <= distance_x &&
                    distance_x <= (length + depassement_x)) {
                vec2 normal = vec2(-v.y, v.x);
                float d = abs(dot(diff, normal));
                if (d < minDistance && d <= deformations[i].influence.y) {
                    minDistance = d;
                    bestChoice = i;
                }
            }
        }

        if (bestChoice >= 0) {
            // override modelViewMatrix
            mvMatrix = deformations[bestChoice].transformation;
            vColor = mix(
                deformations[bestChoice].color,
                vec4(color, 1.0),
                0.5);
        }
    }
    #endif

    #include <begin_vertex>
    #include <project_vertex>

    if (size > 0.) {
        gl_PointSize = size;
    } else {
        gl_PointSize = clamp(-size / gl_Position.w, 3.0, 10.0);
    }

    #include <fog_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
}
