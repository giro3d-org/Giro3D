#if defined(ENABLE_GRATICULE)
struct Graticule {
    float thickness; // 1 = default
    // xOffset, yOffset, xStep, yStep
    vec4 position;
    vec4  color; // Stores both the color and opacity
};

uniform Graticule graticule;

float getGraticuleOpacity(float coordinate, float offset, float step, float thickness) {
    float dist = mod(coordinate + offset, step);

    float halfThickness = graticule.thickness / 2.0;
    float falloffWidth = graticule.thickness / 10.0;
    float fallofStart = halfThickness - falloffWidth;

    if (dist <= halfThickness) {
        float opacity = 1.0;
        if (dist > fallofStart) {
            float normalizedBorderDistance = 1.0 - ((dist - fallofStart) / falloffWidth);
            opacity *= normalizedBorderDistance;
        } else if (dist <= falloffWidth) {
            float normalizedBorderDistance = 1.0 - ((falloffWidth - dist) / falloffWidth);
            opacity *= normalizedBorderDistance;
        }

        return opacity;
    }

    return 0.0;
}

void drawGraticule(vec2 coordinate, Graticule graticule) {
    vec4 pos = graticule.position;
    float xOffset = pos[0];
    float yOffset = pos[1];
    float xStep = pos[2];
    float yStep = pos[3];

    if (xStep > 0. && yStep > 0.) {
        float xOpacity = getGraticuleOpacity(coordinate.x, xOffset, xStep, graticule.thickness);
        float yOpacity = getGraticuleOpacity(coordinate.y, yOffset, yStep, graticule.thickness);

        float opacity = graticule.color.a * max(xOpacity, yOpacity);

        vec4 finalColor = vec4(graticule.color.rgb, opacity);
        gl_FragColor = blend(finalColor, gl_FragColor);
    }
}
#endif