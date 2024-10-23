uniform sampler2D depthTexture;

varying vec2 vUv;

void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    gl_FragDepth = texture2D(depthTexture, vUv).r;
}
