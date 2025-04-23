// The elevation offset to apply to vertices
float elevation = 0.0;

#if defined(GLOBE)
    // Nothing to do
#else
    // In flat mode, the vertex shader does the terrain deformation on the Z-axis,
    // since this axis is the same as the local up vector.
    transformed.z = 0.0;
#endif

#if defined(TERRAIN_DEFORMATION)
#if defined(ELEVATION_LAYER)
if(elevationLayer.offsetScale.z > 0.) {
    vec2 vVv = computeUv(vUv, elevationLayer.offsetScale.xy, elevationLayer.offsetScale.zw);

    elevation = getElevation(elevationTexture, vVv);

#if defined(GLOBE)
    // Disabled: stitching does not work well we curved surfaces (globes)
#elif defined(STITCHING)
    /*
        Stitching aims to eliminate visible cracks between neighbouring tiles, that are caused
        by slight discrepancies in elevation and a different level of detail (LOD).

        This process contains 2 steps : XY-stitching and Z-stitching.

        XY-stitching
        ============

        XY-stitching works on the horizontal plane and is used to weld seams for neighbour tiles
        that have a different levels.

        The smallest tile (with the highest level) has a higher vertex density along the seam.
        Meaning that some vertices will not have an equivalent vertex in the neighbour, leading
        to visible cracks.

        In this figure, XY-stitching moves vertex A along the seam to the position of B.
        A and B have now exactly the same position in space, and the crack is removed.

        +------B------+------+      +------A+B----+------+
        |      |             |      |    / |             |
        |      |             |      | /    |             |
        +------A             +  =>  +      |             |
        |      |             |      |      |             |
        |      |             |      |      |             |
        +------+------+------+      +------+------+------+

        Note : XY-stitching only moves intermediate vertices of the seams, not corner vertices.

        Z-stitching
        ============

        Z-stitching is used to reconcile the variations in elevation (on the Z-axis) between the
        neighbouring seams, due to the fact that elevation pixels may have slightly different
        values on each side of the seam.
    */

    // Locate the vertex (is it on a seam, on a corner, or an inner vertex ?)
    int location = locateVertex(uv);

    // Don't perform stitching on vertices that are not on borders
    if (location != INNER_VERTEX) {
        vec3 vertexOffset;
        vec2 uvOffset;

        // Is there XY-stiching ?
        if (computeXYStitchingOffsets(
                vUv,
                location,
                vertexOffset,
                uvOffset)) {

            // move the UV and the vertex to perform XY-stitching
            vUv -= uvOffset;
            transformed -= vertexOffset;

            // sanitize the UV to fight off potential rounding errors (we don't want the UV to
            // be outside the unit square)
            vUv = clamp01(vUv);

            // The vertex has moved, maybe now it location has changed (from seam to corner)
            location = locateVertex(vUv);
        }

        // Get the elevation of our vertex in our texture
        vec2 elevUv = computeUv(vUv, elevationLayer.offsetScale.xy, elevationLayer.offsetScale.zw);
        float currentElevation = getElevation(elevationTexture, elevUv);

        // Then apply Z-stitching
        elevation = computeZStitchedElevation(vUv, location, currentElevation);
    }
#endif // STITCHING
}
#endif // ELEVATION_LAYER

#if defined(ENABLE_SKIRTS)
    bool isBottomVertex = vUv.x <= -999.0 && vUv.y <= -999.0;
    // Skirt bottom vertices must not be affected by terrain
    // deformation since they have a pre-defined height.
    if (isBottomVertex) {
        elevation = skirtElevation;
    }
#endif

#if defined(GLOBE)
    vec3 upVector = objectNormal;
#else
    vec3 upVector = vec3(0, 0, 1);
#endif
    transformed.xyz += upVector * elevation * elevationScaling;
#endif // TERRAIN_DEFORMATION
