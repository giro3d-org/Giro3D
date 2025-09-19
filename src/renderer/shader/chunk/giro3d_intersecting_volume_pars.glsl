#ifdef INTERSECTING_VOLUMES_SUPPORT
struct IntersectingVolume {
    mat4 viewToBoxNc;
    vec3 color;
};

struct IntersectingVolumes {
    int count;
    IntersectingVolume volumes[MAX_INTERSECTING_VOLUMES_COUNT];
};

uniform IntersectingVolumes intersectingVolumes;

void applyIntersectingVolumes(const vec4 viewPosition, inout vec4 color) {
    for (int i = 0; i < intersectingVolumes.count; i++) {
        vec4 volumeNc = intersectingVolumes.volumes[i].viewToBoxNc * viewPosition;
        volumeNc.xyz /= volumeNc.w;
        volumeNc.xyz = abs(volumeNc.xyz);
        if (volumeNc.x < 1.0 && volumeNc.y < 1.0 && volumeNc.z < 1.0) {
            color = vec4(intersectingVolumes.volumes[i].color, 1);
            return;
        }
    }
}
#endif