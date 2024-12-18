#include <giro3d_precision_qualifiers>
#include <giro3d_common>
#include <giro3d_terrain_pars_vertex>

#include <common>
#include <normal_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>

// Outputs
varying vec2        vUv;
varying vec3        vWorldPosition; // World space position
varying vec3        vWorldNormal; // World space normal
varying vec3        vViewPosition;

// This is used for computing an equivalent of gl_FragCoord.z that is as high precision as possible.
// Some platforms compute gl_FragCoord at a lower precision which makes the manually computed value better for
// depth-based postprocessing effects. Reproduced on iPad with A10 processor / iPadOS 13.3.1.
varying vec2        vHighPrecisionZW;

void main() {
    vUv = uv;

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

    #include <begin_vertex>

    #include <giro3d_terrain_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>

    vWorldNormal = normal;
    vViewPosition = -mvPosition.xyz;

    #include <worldpos_vertex>
    #include <shadowmap_vertex>
    #include <fog_vertex>

    vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vHighPrecisionZW = gl_Position.zw;
}
