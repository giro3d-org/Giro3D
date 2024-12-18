const int HILLSHADE_DISABLED = 0;
const int HILLSHADE_SIMPLE = 1;
const int HILLSHADE_PHYSICAL = 2;

struct Hillshading {
    int   mode;       // One of HILLSHADE_DISABLED, HILLSHADE_SIMPLE, HILLSHADE_PHYSICAL

    float zFactor;    // The factor to apply to slopes.

    // HILLSHADE_SIMPLE specific parameters
    float intensity;  // The global lighting intensity
    float zenith;     // Zenith of sunlight, in degrees (0 - 90)
    float azimuth;    // Azimuth on sunlight, in degrees (0 - 360)
};

uniform Hillshading hillshading;

vec3 hillshade(in vec2 derivatives, in float zenith, in float azimuth, float intensity) {
    float slope = calcSlope(derivatives);
    float aspect = calcAspect(derivatives);
    float zenith_rad = hillshading.zenith * M_PI / 180.0; // in radians
    float azimuth_rad = hillshading.azimuth * M_PI / 180.0; // in radians
    float diffuse = ((cos(zenith_rad) * cos(slope)) + (sin(zenith_rad) * sin(slope) * cos(azimuth_rad - aspect)));

    diffuse = clamp(diffuse, 0., 1.);
    diffuse = mix(1., diffuse, intensity);

    return vec3(diffuse, diffuse, diffuse);
}