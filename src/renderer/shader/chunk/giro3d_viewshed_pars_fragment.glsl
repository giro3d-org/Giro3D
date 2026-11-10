varying vec3 viewshed_vVisWorld;

uniform vec3 nearFarBias;
uniform vec4 visibleColor;
uniform vec4 occludedColor;
uniform vec3 origin;

#if defined(VIEWSHED_CUBEMAP)
uniform samplerCube visibilityMap;

void applyCubeViewshed(vec3 observer, vec3 fragmentPos) {
    vec3 dir = fragmentPos - observer;
    float dist = distance(fragmentPos, observer);
    float near = nearFarBias.x;
    float far = nearFarBias.y;
    float bias = nearFarBias.z;
    float range = far - near;

    float depth = textureCube(visibilityMap, dir).r;
    float pixelDistance = near + (depth * range) + bias;

    bool visible = dist <= pixelDistance;
    vec4 tint = visible ? visibleColor : occludedColor;

    gl_FragColor.rgb = mix(gl_FragColor.rgb, tint.rgb / 255.0, tint.a);
}
#endif

#if defined(VIEWSHED_FRUSTUM)
uniform mat4 viewProjection;
uniform sampler2D visibilityMap;

void applyFrustumViewshed(vec3 observer, vec3 fragmentPos) {
    vec4 clipPos = viewProjection * vec4(fragmentPos, 1.0);
    vec3 normalizedPos = clipPos.xyz / clipPos.w;
    vec2 uv = normalizedPos.xy * 0.5 + 0.5;

    // Check whether fragment is inside frustum.
    bool insideFrustum = clipPos.w > 0.0 &&
        normalizedPos.z >= -1.0 && normalizedPos.z <= 1.0 &&
        uv.x >= 0.0 && uv.x <= 1.0 &&
        uv.y >= 0.0 && uv.y <= 1.0;

    if (insideFrustum) {
        float near = nearFarBias.x;
        float far = nearFarBias.y;
        float bias = nearFarBias.z;
        float range = far - near;

        float dist = length(fragmentPos - origin);
        float depth = texture2D(visibilityMap, uv).r;
        float stored = near + (depth * range) + bias;
        bool visible = dist <= stored;
        vec4 tint = visible ? visibleColor : occludedColor;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, tint.rgb / 255.0, tint.a);
    }
}
#endif




