#include <giro3d_precision_qualifiers>
#include <giro3d_fragment_shader_header>
#include <giro3d_common>

#include <common>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
#include <fog_pars_fragment>

varying vec4 vColor;
uniform vec3 brightnessContrastSaturation;

const float HALF_LENGTH = 0.5;
const vec2 POINT_CENTER = vec2(HALF_LENGTH, HALF_LENGTH);
const float HALF_LENGTH_SQUARED = HALF_LENGTH * HALF_LENGTH;

float sqLength(in vec2 v) {
    return v.x * v.x + v.y * v.y;
}

void main() {
    if (vColor.a < 0.001) {
        discard;
        return;
    }

    // circular point rendering
    if (sqLength(gl_PointCoord - POINT_CENTER) > HALF_LENGTH_SQUARED){
        discard;
        return;
    }

    #include <clipping_planes_fragment>

    gl_FragColor = vec4(adjustBrightnessContrastSaturation(vColor.rgb, brightnessContrastSaturation), vColor.a);

    #include <colorspace_fragment>
    #include <fog_fragment>
    #include <logdepthbuf_fragment>
}
