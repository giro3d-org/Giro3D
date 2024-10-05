uniform sampler2D depthTexture;
uniform sampler2D textureColor;
uniform sampler2D textureEDL;

varying vec2 vUv;
uniform float opacity;

void main() {
    float edl = texture2D(textureEDL, vUv).r;
    // edl is 0 => no neighbours, so disable EDL to avoid drawing a black
    // circle around individual points
    vec4 source = texture2D(textureColor, vUv);
    if (edl == 0.0) {
        gl_FragColor = vec4(source.rgb, source.a);
    } else {
        gl_FragColor = vec4(source.rgb * edl, source.a);
    }
    gl_FragDepth = texture2D(depthTexture, vUv).r;
}
