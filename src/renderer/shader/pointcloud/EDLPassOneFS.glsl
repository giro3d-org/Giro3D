#include <packing>
uniform sampler2D depthTexture;
uniform vec2 resolution;
uniform float strength;
uniform float cameraNear;
uniform float cameraFar;

uniform int n;
uniform int directions;
uniform float radius;

varying vec2 vUv;

float readDepth (float fragCoordZ) {
    float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
    return log2(viewZToOrthographicDepth(viewZ, cameraNear, cameraFar));
}

// inspiration from https://tel.archives-ouvertes.fr/tel-00438464/document and Potree
void main() {
    float fragCoordZ = texture2D(depthTexture, vUv).x;
    if (fragCoordZ == 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    float zp = readDepth(fragCoordZ);
    float s = 0.0;

    const int max_k = 16;
    const int max_n = 4;

    float step = 2.0 * 3.1415926 / float(directions);

    for (int i = 0; i < max_k; i++) {
        if (i == directions) {
            // workaround for loop index cannot be compared with non-constant expression
            break;
        }

        for (int j = 1; j <= max_n; j++) {
            if (j > n) {
                // workaround for loop index cannot be compared with non-constant expression
                break;
            }

            float distance = radius * float(j);
            float rad = float(i) * step;

            vec2 offset = vec2(
                cos(rad) * distance,
                sin(rad) * distance) / resolution;

            float fz = texture2D(depthTexture, vUv + offset).x;
            float zq = readDepth(fz);

            s += max(0.0, -(zq - zp) / distance);
        }
    }
    s = s / float(directions) / float(n);

    float A = 300.0 * strength;

    s = exp(-s * A);

    gl_FragColor = vec4(s, s, s, 1.0);
}
