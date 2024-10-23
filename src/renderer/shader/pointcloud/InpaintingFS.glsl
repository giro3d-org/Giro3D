uniform sampler2D depthTexture;
uniform sampler2D colorTexture;

varying vec2 vUv;

uniform float m43;
uniform float m33;
uniform vec2 resolution;
uniform float depth_contrib;
uniform float opacity;

uniform bool enableZAttenuation;
uniform float zAttMax;
uniform float zAttMin;

float zview(float depth) {
    // http://www.derschmale.com/2014/01/26/reconstructing-positions-from-the-depth-buffer/
    float zndc = 2.0 * depth - 1.0;
    return - m43 / (zndc + m33);
}

void main() {
    float depth = texture2D(depthTexture, vUv).x;
    gl_FragDepth = depth;

    // non empty pixel
    if (depth < 1.0) {
        gl_FragColor = texture2D(colorTexture, vUv);
        return;
    }

    // empty pixel
    {
        float total_weight = 0.0;
        vec4 averageColor = vec4(0.0, 0.0, 0.0, 0.0);
        float averageDepth = 0.;
        const int kernel = 3;
        for (int i=-kernel; i<=kernel; i++) {
            for (int j=-kernel; j<=kernel; j++) {
                if (i == 0 && j == 0) continue;
                vec2 uv = vUv + vec2(float(i) / resolution.x, float(j) / resolution.y);
                float d = texture2D(depthTexture, uv).x;

                if (d < 1.0) {
                    if (enableZAttenuation) {
                        float z = -zview(d);
                        // attenuation according to distance
                        float zAttenuation = clamp((zAttMax - z) / (zAttMax - zAttMin), 0.0, 1.0); // I wish smoothstep was supported...
                        if (abs(float(i))+abs(float(j)) > (float(kernel) * 2.0 * zAttenuation)) {
                            continue;
                        }
                    }
                    float r_ij = sqrt(float(i*i + j*j));
                    float weight_ij = (float(kernel) - r_ij * 1.0)
                        * (1.0 - min(1.0, abs(d - depth) / depth_contrib));
                    if (weight_ij > 0.0) {
                        averageColor += weight_ij * texture2D(colorTexture, uv);
                        averageDepth += weight_ij * d;
                        total_weight += weight_ij;
                    }
                }
            }
        }

        if (total_weight > 0.0) {
            gl_FragColor = averageColor / total_weight;
            gl_FragDepth = averageDepth / total_weight;
        } else {
            gl_FragColor.a = 0.0;
            discard;
        }
    }
}
