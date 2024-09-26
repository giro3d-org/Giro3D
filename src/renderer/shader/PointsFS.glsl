#include <giro3d_precision_qualifiers>
#include <giro3d_fragment_shader_header>
#include <giro3d_common>

#include <common>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
#include <fog_pars_fragment>

varying vec4 vColor;
uniform vec3 brightnessContrastSaturation;

void main() {
    #include <clipping_planes_fragment>

    if (vColor.a < 0.001) {
        discard;
    }

    // circular point rendering
    if (length(gl_PointCoord - 0.5) > 0.5){
        discard;
    }

    gl_FragColor = vec4(adjustBrightnessContrastSaturation(vColor.rgb, brightnessContrastSaturation), vColor.a);

    #include <colorspace_fragment>
    #include <fog_fragment>
    #include <logdepthbuf_fragment>
}
