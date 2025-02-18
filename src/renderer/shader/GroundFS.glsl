varying vec3 c0;
varying vec3 c1;
uniform float opacity;

void main (void) {
	gl_FragColor = vec4(c1, 1.0 - c0 / 4.0);
	gl_FragColor.a *= opacity;
}