#include <logdepthbuf_pars_fragment>

varying float intensity;
uniform vec3 glowColor;
uniform float opacity;

void main()
{
    #include <logdepthbuf_fragment>
    vec4 glow = vec4(glowColor.rgb, opacity);
    gl_FragColor = glow * intensity;
}
