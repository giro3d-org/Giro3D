#include <logdepthbuf_pars_vertex>
#define EPSILON 1e-6

uniform bool atmoIN;
varying float intensity;

void main()
{
    vec3 normalES    = normalize( normalMatrix * normal );
    vec3 normalCAMES = normalize( normalMatrix * cameraPosition );

    float angle = dot(normalES, normalCAMES);

    if(atmoIN) {
        intensity = pow(1.0 - angle, 0.8);
    } else {
        intensity = pow(0.666 - angle, 4.0);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position,  1.0 );

    #include <logdepthbuf_vertex>
}
