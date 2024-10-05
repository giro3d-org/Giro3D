uniform sampler2D depthTexture;
uniform sampler2D colorTexture;

varying vec2 vUv;

uniform float m43;
uniform float m33;
uniform vec2 resolution;
uniform mat4 invPersMatrix;

uniform float threshold;
uniform bool showRemoved;

vec3 unproject (vec2 ptex, float d)
{
    vec2 pndc = ptex * 2.0 - 1.0;
    vec3 pray = (invPersMatrix * vec4(pndc, 1.0, 1.0)).xyz;
    return d * pray;
}


float zView(float depth) {
    // http://www.derschmale.com/2014/01/26/reconstructing-positions-from-the-depth-buffer/
    float zndc = 2.0 * depth - 1.0;
    return - m43 / (zndc + m33);
}

void main() {
   float depth = texture2D(depthTexture, vUv).x;

    if (depth < 1.0) {
        float sectors[8];
        for (int i=0; i<8; i++) {
            sectors[i] = -1.0;
        }

        vec3 p0 = unproject(gl_FragCoord.xy / resolution, -zView(depth));
        vec3 v = -normalize(p0);

        const int kernelSize = 7;
        for (int i=-kernelSize; i<=kernelSize; i++) {
            for (int j=-kernelSize; j<=kernelSize; j++) {
                if (i == 0 && j == 0) {
                    continue;
                }
                float d = texture2D(
                    depthTexture,
                    vUv + vec2(float(i) / resolution.x, float(j) / resolution.y)).x;

                if (d == 1.0) {
                    continue;
                }

                vec2 coord = (gl_FragCoord.xy + vec2(i, j)) / resolution;
                vec3 pij = unproject(coord, - zView(d));
                vec3 c = normalize(pij - p0);
                float test = dot(v, c);

                if (i >= 0) {
                    if(abs(float(j)) <= abs(float(i))) {
                        if (j >= 0) {
                            sectors[0] = max(sectors[0], test);
                        }
                        if (j <= 0) {
                            sectors[7] = max(sectors[7], test);
                        }
                    }
                    if(abs(float(j)) >= abs(float(i))) {
                        if (j >= 0) {
                            sectors[1] = max(sectors[1], test);
                        }
                        if (j <= 0) {
                            sectors[6] = max(sectors[6], test);
                        }
                    }
                }
                if (i <= 0) {
                    if(abs(float(j)) <= abs(float(i))) {
                        if (j >= 0) {
                            sectors[3] = max(sectors[3], test);
                        }
                        if (j <= 0) {
                            sectors[4] = max(sectors[4], test);
                        }
                    }
                    if(abs(float(j)) >= abs(float(i))) {
                        if (j >= 0) {
                            sectors[2] = max(sectors[2], test);
                        }
                        if (j <= 0) {
                            sectors[5] = max(sectors[5], test);
                        }
                    }
                }
            }
        }

        float m = 0.0;
        for (int i=0; i< 8 ;i++) {
            m += (1.0 + sectors[i]) * 0.5;
        }
        m /= 8.0;

        if (m < threshold) {
            gl_FragColor = texture2D(colorTexture, vUv);
            gl_FragDepth = depth;
        } else if (showRemoved) {
            gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
            gl_FragDepth = 1.0;
        } else {
            gl_FragColor.a = 0.0;
            gl_FragDepth = 1.0;
        }
    } else {
        gl_FragColor.a = 0.0;
        gl_FragDepth = 1.0;
    }
}
