varying vec3 vWorldPosition;

void main() {
    vec4 worldPosition = modelMatrix * vec4(cameraPosition + position, 1.0);

    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(cameraPosition + position, 1.0);
}
